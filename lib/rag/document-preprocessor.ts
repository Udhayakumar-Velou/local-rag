import { PDFParse } from 'pdf-parse';
import { createWorker } from 'tesseract.js';
import type { Worker } from 'tesseract.js';
import { execFileSync } from 'child_process';
import path from 'path';
import fs from 'fs';

export type PreprocessedSourceType =
  | 'pdf-text'
  | 'pdf-ocr'
  | 'image-ocr'
  | 'csv-table'
  | 'json-structured'
  | 'plain-text';

export interface PreprocessedPage {
  pageNumber: number;
  text: string;
  sourceType: PreprocessedSourceType;
  metadata?: Record<string, any>;
}

export interface PreprocessedDocument {
  fileName: string;
  fileType: string;
  fileSize: number;
  pages: PreprocessedPage[];
  totalCharacters: number;
}

// Reusable Tesseract worker singleton to avoid worker startup latency
let cachedWorker: Worker | null = null;
let workerInitializing: Promise<Worker | null> | null = null;

async function getOcrWorker(): Promise<Worker | null> {
  if (cachedWorker) return cachedWorker;
  if (workerInitializing) return workerInitializing;

  workerInitializing = (async () => {
    try {
      const tessDir = path.join(process.cwd(), 'data', 'tessdata');
      const workerScript = path.join(process.cwd(), 'node_modules', 'tesseract.js', 'src', 'worker-script', 'node', 'index.js');
      const hasLocalEng = fs.existsSync(tessDir) && fs.existsSync(path.join(tessDir, 'eng.traineddata'));
      const hasLocalFra = fs.existsSync(tessDir) && fs.existsSync(path.join(tessDir, 'fra.traineddata'));

      const options: any = {
        workerPath: workerScript,
        errorHandler: (err: any) => console.error('[Tesseract Error]:', err),
      };

      if (hasLocalEng) {
        options.langPath = tessDir;
        options.cachePath = tessDir;
        options.gzip = false;
      }

      const langs = hasLocalEng && hasLocalFra ? ['eng', 'fra'] : 'eng';

      const initPromise = createWorker(langs, 1, options);
      const timeoutPromise = new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), 15000),
      );

      const worker = await Promise.race([initPromise, timeoutPromise]);
      if (worker) {
        cachedWorker = worker;
        return worker;
      }
      return null;
    } catch (err) {
      console.error('[OCR Worker Init Error]:', err);
      cachedWorker = null;
      return null;
    } finally {
      workerInitializing = null;
    }
  })();

  return workerInitializing;
}

/**
 * Text normalizer for RAG ingestion:
 * - Strips null bytes and invisible control characters
 * - Normalizes line endings (\r\n -> \n)
 * - Fixes hyphenation at line breaks (e.g. "pre-\nprocessing" -> "preprocessing")
 * - Cleans excessive whitespace while preserving paragraph breaks
 */
export function normalizeText(text: string): string {
  if (!text) return '';

  return (
    text
      // Strip null bytes and ASCII control characters (keep tab, newline)
      .replace(/\0/g, ' ')
      .replace(/[\x01-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')
      // Normalize line breaks
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      // Fix hyphenation across line breaks: "docu-\nment" -> "document"
      .replace(/(\b[a-zA-Z]{2,})-\n([a-zA-Z]{2,}\b)/g, '$1$2')
      // Collapse horizontal whitespace (spaces, tabs)
      .replace(/[ \t]+/g, ' ')
      // Clean up whitespace around line breaks
      .replace(/ *\n */g, '\n')
      // Collapse 3+ consecutive newlines into 2 (clean paragraph breaks)
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  );
}

/**
 * Enterprise Pre-Processing Overlay
 * Converts images, PDFs (digital + scanned), and structured docs into unified text
 * so a pure-text LLM (like Qwen 2.5) can read, search, and reason over them.
 */
export class DocumentPreprocessor {
  /**
   * Main entry point: process any supported buffer (PDF, Image, CSV, JSON, Text)
   */
  public static async process(
    buffer: Buffer,
    fileName: string,
    mimeType?: string,
  ): Promise<PreprocessedDocument> {
    const lowerName = fileName.toLowerCase();
    const effectiveMime = mimeType || this.inferMimeType(lowerName);

    // 1. PDF processing (digital text with scanned-page OCR fallback)
    if (effectiveMime === 'application/pdf' || lowerName.endsWith('.pdf')) {
      return this.processPdf(buffer, fileName);
    }

    // 2. DOCX Word Document Processing
    if (
      effectiveMime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      lowerName.endsWith('.docx')
    ) {
      return this.processDocx(buffer, fileName);
    }

    // 3. Image processing (OCR for screenshots, photos, receipts, diagrams)
    if (
      effectiveMime.startsWith('image/') ||
      /\.(png|jpe?g|webp|gif|bmp|tiff)$/i.test(lowerName)
    ) {
      return this.processImage(buffer, fileName, effectiveMime);
    }

    // 3. Tabular data (CSV)
    if (effectiveMime === 'text/csv' || lowerName.endsWith('.csv')) {
      return this.processCsv(buffer, fileName);
    }

    // 4. Structured JSON
    if (effectiveMime === 'application/json' || lowerName.endsWith('.json')) {
      return this.processJson(buffer, fileName);
    }

    // 5. Default to plain text / markdown / code
    return this.processPlainText(buffer, fileName, effectiveMime);
  }

  /**
   * Process PDF with page-level text extraction and automatic OCR fallback for scanned pages
   */
  private static async processPdf(
    buffer: Buffer,
    fileName: string,
  ): Promise<PreprocessedDocument> {
    const parser = new PDFParse({
      data: new Uint8Array(buffer),
    });

    const result = await parser.getText();
    const pages: PreprocessedPage[] = [];

    // Check which pages might be scanned images (low or zero extractable text)
    const rawPages = Array.isArray(result.pages) && result.pages.length > 0
      ? result.pages
      : [{ text: result.text || '', num: 1 }];

    let renderedImages: any[] | null = null;

    for (const p of rawPages) {
      const pageNum = p.num || pages.length + 1;
      const cleaned = normalizeText(p.text || '');

      // If page has sufficient digital text, use it directly
      if (cleaned.length >= 30) {
        pages.push({
          pageNumber: pageNum,
          text: cleaned,
          sourceType: 'pdf-text',
        });
        continue;
      }

      // Page appears to be scanned or image-only: attempt OCR fallback
      let ocrText = '';
      try {
        if (!renderedImages) {
          const imgParser = new PDFParse({ data: new Uint8Array(buffer) });
          const imgResult = await imgParser.pageToImage();
          renderedImages = imgResult.pages || [];
        }

        const pageImg = renderedImages.find((img) => img.pageNumber === pageNum);
        if (pageImg?.data) {
          const worker = await getOcrWorker();
          if (worker) {
            const ocrRet = await worker.recognize(Buffer.from(pageImg.data));
            ocrText = normalizeText(ocrRet.data.text || '');
          }
        }
      } catch (ocrErr) {
        console.warn(`[Preprocessor] PDF page ${pageNum} OCR fallback skipped:`, ocrErr);
      }

      if (ocrText.length > 0) {
        pages.push({
          pageNumber: pageNum,
          text: `[Scanned Page ${pageNum} - OCR Extracted Text]\n${ocrText}`,
          sourceType: 'pdf-ocr',
        });
      } else {
        pages.push({
          pageNumber: pageNum,
          text: cleaned.length > 0 ? cleaned : `[Page ${pageNum}: Image-only page, selectable text not found]`,
          sourceType: 'pdf-text',
        });
      }
    }

    const totalCharacters = pages.reduce((sum, p) => sum + p.text.length, 0);

    return {
      fileName,
      fileType: 'application/pdf',
      fileSize: buffer.length,
      pages,
      totalCharacters,
    };
  }

  /**
   * Process images (receipts, charts, scanned forms, diagrams) via Tesseract OCR
   */
  public static async processImage(
    buffer: Buffer,
    fileName: string,
    mimeType: string,
  ): Promise<PreprocessedDocument> {
    console.log(`[Preprocessor] Running OCR on image: ${fileName}`);
    let ocrText = '';

    const scriptPath = path.join(process.cwd(), 'scripts', 'extract_image_ocr.js');
    if (fs.existsSync(scriptPath)) {
      const tempPath = path.join(process.cwd(), 'data', 'documents', `temp_${Date.now()}_${path.basename(fileName)}`);
      try {
        fs.writeFileSync(tempPath, buffer);
        const stdout = execFileSync('node', [scriptPath, tempPath], {
          timeout: 25000,
          encoding: 'utf-8',
        });
        ocrText = normalizeText(stdout);
      } catch (err: any) {
        console.warn(`[Preprocessor] Standalone OCR notice on ${fileName}:`, err?.message || err);
      } finally {
        if (fs.existsSync(tempPath)) {
          try {
            fs.unlinkSync(tempPath);
          } catch {}
        }
      }
    }

    if (!ocrText) {
      const worker = await getOcrWorker();
      if (worker) {
        try {
          const ret = await worker.recognize(buffer);
          ocrText = normalizeText(ret.data.text || '');
        } catch (err: any) {
          console.warn(`[Preprocessor] Worker OCR warning on ${fileName}:`, err?.message || err);
        }
      }
    }

    const header = `[Image Document: ${fileName} | Format: ${mimeType} | Size: ${(buffer.length / 1024).toFixed(1)} KB]`;
    const formattedText = ocrText.length > 0
      ? `${header}\n\n--- Extracted Text Content from Image ---\n${ocrText}`
      : `${header}\n\n[Visual Image Asset: ${fileName} - Graphic/design visual elements detected. Primary visual asset: ${fileName}]`;

    return {
      fileName,
      fileType: mimeType,
      fileSize: buffer.length,
      pages: [
        {
          pageNumber: 1,
          text: formattedText,
          sourceType: 'image-ocr',
        },
      ],
      totalCharacters: formattedText.length,
    };
  }

  /**
   * Process CSV into formatted Markdown table
   */
  private static processCsv(
    buffer: Buffer,
    fileName: string,
  ): PreprocessedDocument {
    const raw = buffer.toString('utf-8');
    const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);

    if (lines.length === 0) {
      return {
        fileName,
        fileType: 'text/csv',
        fileSize: buffer.length,
        pages: [{ pageNumber: 1, text: '[Empty CSV file]', sourceType: 'csv-table' }],
        totalCharacters: 0,
      };
    }

    const parseLine = (line: string): string[] => {
      // Basic CSV splitter handling quotes
      const values: string[] = [];
      let current = '';
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"' || char === "'") {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim());
      return values;
    };

    const headers = parseLine(lines[0]);
    const markdownRows: string[] = [];

    // Header row
    markdownRows.push(`| ${headers.join(' | ')} |`);
    markdownRows.push(`| ${headers.map(() => '---').join(' | ')} |`);

    // Data rows
    for (let i = 1; i < lines.length; i++) {
      const row = parseLine(lines[i]);
      markdownRows.push(`| ${row.join(' | ')} |`);
    }

    const markdownTable = `[Tabular Data: ${fileName} | ${lines.length - 1} rows]\n\n${markdownRows.join('\n')}`;

    return {
      fileName,
      fileType: 'text/csv',
      fileSize: buffer.length,
      pages: [
        {
          pageNumber: 1,
          text: markdownTable,
          sourceType: 'csv-table',
        },
      ],
      totalCharacters: markdownTable.length,
    };
  }

  /**
   * Process JSON into structured readable markdown
   */
  private static processJson(
    buffer: Buffer,
    fileName: string,
  ): PreprocessedDocument {
    const raw = buffer.toString('utf-8');
    let formattedText = '';

    try {
      const parsed = JSON.parse(raw);
      formattedText = `[Structured JSON Document: ${fileName}]\n\n\`\`\`json\n${JSON.stringify(parsed, null, 2)}\n\`\`\``;
    } catch {
      formattedText = `[JSON Document: ${fileName}]\n\n${raw}`;
    }

    return {
      fileName,
      fileType: 'application/json',
      fileSize: buffer.length,
      pages: [
        {
          pageNumber: 1,
          text: formattedText,
          sourceType: 'json-structured',
        },
      ],
      totalCharacters: formattedText.length,
    };
  }

  /**
   * Process Word Documents (.docx) by extracting text elements
   */
  private static processDocx(
    buffer: Buffer,
    fileName: string,
  ): PreprocessedDocument {
    try {
      const docsDir = path.join(process.cwd(), 'data', 'documents');
      if (!fs.existsSync(docsDir)) {
        fs.mkdirSync(docsDir, { recursive: true });
      }
      const tempPath = path.join(docsDir, fileName);
      if (!fs.existsSync(tempPath)) {
        fs.writeFileSync(tempPath, buffer);
      }

      const scriptPath = path.join(process.cwd(), 'scripts', 'extract_docx.py');
      const stdout = execFileSync('python3', [scriptPath, tempPath], {
        encoding: 'utf-8',
        maxBuffer: 15 * 1024 * 1024,
      });

      const cleaned = normalizeText(stdout);
      return {
        fileName,
        fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        fileSize: buffer.length,
        pages: [
          {
            pageNumber: 1,
            text: cleaned,
            sourceType: 'plain-text',
          },
        ],
        totalCharacters: cleaned.length,
      };
    } catch (err: any) {
      console.error('[Preprocessor] Error extracting DOCX:', err);
      return {
        fileName,
        fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        fileSize: buffer.length,
        pages: [
          {
            pageNumber: 1,
            text: `[Error reading DOCX file: ${err?.message || 'Unknown extraction error'}]`,
            sourceType: 'plain-text',
          },
        ],
        totalCharacters: 0,
      };
    }
  }

  /**
   * Process plain text or markdown
   */
  private static processPlainText(
    buffer: Buffer,
    fileName: string,
    mimeType: string,
  ): PreprocessedDocument {
    const text = normalizeText(buffer.toString('utf-8'));

    return {
      fileName,
      fileType: mimeType,
      fileSize: buffer.length,
      pages: [
        {
          pageNumber: 1,
          text,
          sourceType: 'plain-text',
        },
      ],
      totalCharacters: text.length,
    };
  }

  public static inferMimeType(fileName: string): string {
    if (fileName.endsWith('.pdf')) return 'application/pdf';
    if (fileName.endsWith('.docx') || fileName.endsWith('.doc'))
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    if (fileName.endsWith('.png')) return 'image/png';
    if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) return 'image/jpeg';
    if (fileName.endsWith('.webp')) return 'image/webp';
    if (fileName.endsWith('.csv')) return 'text/csv';
    if (fileName.endsWith('.json')) return 'application/json';
    if (fileName.endsWith('.md')) return 'text/markdown';
    return 'text/plain';
  }
}

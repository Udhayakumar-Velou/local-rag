import { PDFParse } from 'pdf-parse';
import { createWorker } from 'tesseract.js';

export interface PreprocessedPage {
  pageNumber: number;
  text: string;
  sourceType: 'pdf-text' | 'image-ocr' | 'plain-text';
}

export interface PreprocessedDocument {
  fileName: string;
  fileType: string;
  fileSize: number;
  pages: PreprocessedPage[];
  totalCharacters: number;
}

/**
 * Enterprise Pre-Processing Overlay
 * Converts images, PDFs, and documentation into unified structured text
 * so a pure-text LLM (like Qwen 2.5) can read, search, and reason over them.
 */
export class DocumentPreprocessor {
  /**
   * Main entry point: process any supported buffer (PDF, Image, Text)
   */
  public static async process(
    buffer: Buffer,
    fileName: string,
    mimeType?: string,
  ): Promise<PreprocessedDocument> {
    const lowerName = fileName.toLowerCase();
    const effectiveMime = mimeType || this.inferMimeType(lowerName);

    if (effectiveMime === 'application/pdf' || lowerName.endsWith('.pdf')) {
      return this.processPdf(buffer, fileName);
    }

    if (
      effectiveMime.startsWith('image/') ||
      /\.(png|jpe?g|webp|gif|bmp|tiff)$/i.test(lowerName)
    ) {
      return this.processImage(buffer, fileName, effectiveMime);
    }

    // Default to plain text / markdown / code / CSV
    return this.processPlainText(buffer, fileName, effectiveMime);
  }

  /**
   * Process PDF with page-level text extraction
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

    if (Array.isArray(result.pages) && result.pages.length > 0) {
      for (const p of result.pages) {
        const text = (p.text || '').trim();
        pages.push({
          pageNumber: p.num || pages.length + 1,
          text: text || '[No selectable text found on this page]',
          sourceType: 'pdf-text',
        });
      }
    } else {
      pages.push({
        pageNumber: 1,
        text: (result.text || '').trim(),
        sourceType: 'pdf-text',
      });
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
    const worker = await createWorker('eng');
    const ret = await worker.recognize(buffer);
    await worker.terminate();

    const ocrText = ret.data.text.trim();
    const formattedText = ocrText.length > 0
      ? `[Extracted Image Text from ${fileName}]\n${ocrText}`
      : `[Image ${fileName}: No legible text detected by OCR engine]`;

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
   * Process plain text, markdown, CSV, or code
   */
  private static processPlainText(
    buffer: Buffer,
    fileName: string,
    mimeType: string,
  ): PreprocessedDocument {
    const text = buffer.toString('utf-8').trim();

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

  private static inferMimeType(fileName: string): string {
    if (fileName.endsWith('.pdf')) return 'application/pdf';
    if (fileName.endsWith('.png')) return 'image/png';
    if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) return 'image/jpeg';
    if (fileName.endsWith('.webp')) return 'image/webp';
    if (fileName.endsWith('.csv')) return 'text/csv';
    if (fileName.endsWith('.md')) return 'text/markdown';
    return 'text/plain';
  }
}

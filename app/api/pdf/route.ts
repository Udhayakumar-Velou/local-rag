import fs from 'fs';
import path from 'path';
import { DocumentPreprocessor } from '@/lib/rag/document-preprocessor';
import { RecursiveCharacterTextSplitter } from '@/lib/rag/text-splitter';
import { LocalVectorStore } from '@/lib/rag/vector-store';

export const maxDuration = 60;

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB
const DOCUMENTS_DIR = path.join(process.cwd(), 'data', 'documents');

export async function GET() {
  try {
    const docs = LocalVectorStore.listDocuments();
    const stats = LocalVectorStore.getStats();
    return Response.json({ documents: docs, stats });
  } catch (error) {
    return Response.json(
      { error: 'Failed to retrieve documents' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    // Validate the uploaded file
    if (!(file instanceof File)) {
      return Response.json(
        { error: 'Please upload a file (PDF, Image, Markdown, or Text).' },
        { status: 400 },
      );
    }

    if (file.size === 0) {
      return Response.json(
        { error: 'The uploaded file is empty.' },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return Response.json(
        { error: 'File must be smaller than 25 MB.' },
        { status: 413 },
      );
    }

    // Step 1: Save original file (Amazon S3 equivalent)
    if (!fs.existsSync(DOCUMENTS_DIR)) {
      fs.mkdirSync(DOCUMENTS_DIR, { recursive: true });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const filePath = path.join(DOCUMENTS_DIR, file.name);
    fs.writeFileSync(filePath, buffer);

    // Step 2: Pre-process document/image into unified text (OCR + PDF parser)
    const processedDoc = await DocumentPreprocessor.process(
      buffer,
      file.name,
      file.type,
    );

    if (processedDoc.totalCharacters === 0) {
      return Response.json(
        {
          error:
            'No text could be extracted from this document or image.',
        },
        { status: 422 },
      );
    }

    // Step 3: Chunk text using RecursiveCharacterTextSplitter (chunkSize: 2000, overlap: 400)
    // Mirrors the exact enterprise logic from doc_text_chunk.py
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 2000,
      chunkOverlap: 400,
    });
    const chunks = splitter.splitPages(processedDoc.pages);

    // Step 4: Index into LocalVectorStore (Snowflake Cortex Search equivalent)
    const docId = `doc-${Date.now()}`;
    await LocalVectorStore.addDocument(
      {
        id: docId,
        fileName: file.name,
        fileSize: file.size,
        pageCount: processedDoc.pages.length,
        uploadedAt: new Date().toISOString(),
      },
      chunks,
    );

    return Response.json({
      success: true,
      filename: file.name,
      fileType: processedDoc.fileType,
      pages: processedDoc.pages.length,
      chunksCount: chunks.length,
      characters: processedDoc.totalCharacters,
    });
  } catch (error) {
    console.error('Document pre-processing & indexing error:', error);
    return Response.json(
      {
        error:
          'Could not process this file. Check that the file is valid and try again.',
      },
      { status: 500 },
    );
  }
}

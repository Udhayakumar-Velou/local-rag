import fs from 'fs';
import path from 'path';
import { generateEmbedding, cosineSimilarity } from './embeddings';

export interface StoredDocument {
  id: string;
  fileName: string;
  fileSize: number;
  pageCount: number;
  uploadedAt: string;
}

export interface StoredChunk {
  id: string;
  documentId: string;
  fileName: string;
  pageNumber: number;
  chunkIndex: number;
  content: string;
  embedding: number[];
}

export interface SearchResultItem {
  chunk: StoredChunk;
  score: number;
  confidenceScore: number;
  confidenceLabel: string;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const STORE_FILE = path.join(DATA_DIR, 'vector-store.json');

interface StoreData {
  documents: Record<string, StoredDocument>;
  chunks: StoredChunk[];
}

function loadStore(): StoreData {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(STORE_FILE)) {
      const raw = fs.readFileSync(STORE_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (error) {
    console.error('Failed to read vector store, initializing empty store:', error);
  }
  return { documents: {}, chunks: [] };
}

function saveStore(data: StoreData) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(STORE_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to persist vector store:', error);
  }
}

export class LocalVectorStore {
  /**
   * Add a document and its embedded chunks to the local store
   */
  public static async addDocument(
    doc: StoredDocument,
    rawChunks: Array<{ content: string; pageNumber: number; chunkIndex: number }>,
  ): Promise<StoredChunk[]> {
    const store = loadStore();
    store.documents[doc.id] = doc;

    const newChunks: StoredChunk[] = [];
    for (const raw of rawChunks) {
      const embedding = await generateEmbedding(raw.content);
      const chunk: StoredChunk = {
        id: `${doc.id}-chunk-${raw.chunkIndex}`,
        documentId: doc.id,
        fileName: doc.fileName,
        pageNumber: raw.pageNumber,
        chunkIndex: raw.chunkIndex,
        content: raw.content,
        embedding,
      };
      newChunks.push(chunk);
    }

    // Filter out previous chunks if re-uploading same document
    store.chunks = store.chunks.filter((c) => c.fileName !== doc.fileName);
    store.chunks.push(...newChunks);

    saveStore(store);
    return newChunks;
  }

  public static listDocuments(): StoredDocument[] {
    const store = loadStore();
    return Object.values(store.documents);
  }

  public static getStats() {
    const store = loadStore();
    return {
      documentCount: Object.keys(store.documents).length,
      chunkCount: store.chunks.length,
    };
  }

  /**
   * Search vector index using cosine similarity.
   * Matches the scoring and format of Snowflake Cortex Search.
   */
  public static async search(
    query: string,
    limit: number = 5,
  ): Promise<SearchResultItem[]> {
    const store = loadStore();
    if (store.chunks.length === 0) return [];

    const queryEmbedding = await generateEmbedding(query);

    const scored = store.chunks.map((chunk) => {
      const score = cosineSimilarity(queryEmbedding, chunk.embedding);
      let confidenceScore = 0;
      let confidenceLabel = 'Irrelevant';

      if (score > 0.65) {
        confidenceScore = 3;
        confidenceLabel = 'Strong Relevance';
      } else if (score > 0.45) {
        confidenceScore = 2;
        confidenceLabel = 'Highly Relevant';
      } else if (score > 0.25) {
        confidenceScore = 1;
        confidenceLabel = 'Weak Relevance';
      }

      return {
        chunk,
        score,
        confidenceScore,
        confidenceLabel,
      };
    });

    // Sort descending by similarity score
    scored.sort((a, b) => b.score - a.score);

    // Return top matching chunks above minimum threshold
    return scored.filter((item) => item.score > 0.15).slice(0, limit);
  }

  /**
   * Format search results into the exact context block expected by the LLM,
   * identical to the company's `formatSearchResults` in `searchDocumentCortexSearchRestAPI.tsx`.
   */
  public static formatSearchResults(results: SearchResultItem[]): string {
    if (results.length === 0) return '';

    return results
      .map((item, idx) => {
        const { chunk, confidenceScore, confidenceLabel } = item;
        return `Context document ${idx + 1} | Confidence Score: ${confidenceScore}-${confidenceLabel} | Source filename: ${chunk.fileName} | Page: ${chunk.pageNumber} | Content: ${chunk.content}`;
      })
      .join('\n\n');
  }
}

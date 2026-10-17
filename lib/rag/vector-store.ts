import fs from 'fs';
import path from 'path';
import { generateEmbedding, cosineSimilarity } from './embeddings';

export interface StoredDocument {
  id: string;
  fileName: string;
  fileSize: number;
  pageCount: number;
  uploadedAt: string;
  scope?: 'global' | 'chat';
  conversationId?: string;
}

export interface StoredChunk {
  id: string;
  documentId: string;
  fileName: string;
  pageNumber: number;
  chunkIndex: number;
  content: string;
  embedding: number[];
  scope?: 'global' | 'chat';
  conversationId?: string;
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
   * Supports both global knowledge base and chat-specific attachments.
   */
  public static async addDocument(
    doc: StoredDocument,
    rawChunks: Array<{ content: string; pageNumber: number; chunkIndex: number }>,
    scope: 'global' | 'chat' = 'global',
    conversationId?: string,
  ): Promise<StoredChunk[]> {
    const store = loadStore();
    doc.scope = scope;
    if (conversationId) doc.conversationId = conversationId;

    // Remove any previous duplicate document entries with the same fileName
    for (const [existingId, existingDoc] of Object.entries(store.documents)) {
      if (existingDoc.fileName === doc.fileName) {
        if (scope === 'chat' && existingDoc.conversationId !== conversationId) continue;
        delete store.documents[existingId];
      }
    }

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
        scope,
        conversationId,
      };
      newChunks.push(chunk);
    }

    // Filter out previous chunks if re-uploading same document name within same scope
    store.chunks = store.chunks.filter((c) => {
      if (c.fileName !== doc.fileName) return true;
      if (scope === 'chat' && c.conversationId !== conversationId) return true;
      return false;
    });

    store.chunks.push(...newChunks);

    saveStore(store);
    return newChunks;
  }

  /**
   * List documents. If conversationId is supplied, returns global documents
   * plus documents attached to that specific conversation.
   */
  public static listDocuments(conversationId?: string): StoredDocument[] {
    const store = loadStore();
    const allDocs = Object.values(store.documents);

    if (!conversationId) {
      return allDocs;
    }

    return allDocs.filter(
      (d) => !d.scope || d.scope === 'global' || d.conversationId === conversationId,
    );
  }

  public static getChunksByFile(fileName: string): StoredChunk[] {
    const store = loadStore();
    return store.chunks.filter((c) => c.fileName === fileName);
  }

  public static deleteDocument(idOrFileName: string): boolean {
    const store = loadStore();
    let targetFileName = idOrFileName;

    const docEntry = Object.values(store.documents).find(
      (d) => d.id === idOrFileName || d.fileName === idOrFileName,
    );

    if (docEntry) {
      targetFileName = docEntry.fileName;
      delete store.documents[docEntry.id];
    }

    store.chunks = store.chunks.filter((c) => c.fileName !== targetFileName);
    saveStore(store);

    try {
      const filePath = path.join(process.cwd(), 'data', 'documents', targetFileName);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (err) {
      console.warn('Could not delete physical file:', err);
    }

    return true;
  }

  public static getStats(conversationId?: string) {
    const docs = this.listDocuments(conversationId);
    return {
      documentCount: docs.length,
    };
  }

  /**
   * Search vector index using cosine similarity.
   * Matches the scoring and format of Snowflake Cortex Search.
   * Filters by scope: queries global documents + chat-specific documents for conversationId.
   */
  public static async search(
    query: string,
    limit: number = 5,
    conversationId?: string,
  ): Promise<SearchResultItem[]> {
    const store = loadStore();
    if (store.chunks.length === 0) return [];

    // Filter candidate chunks according to scope and active chat
    const candidateChunks = store.chunks.filter((chunk) => {
      // Global chunks are always searchable
      if (!chunk.scope || chunk.scope === 'global') return true;
      // Chat-scoped chunks only match if conversationId matches
      return conversationId ? chunk.conversationId === conversationId : false;
    });

    if (candidateChunks.length === 0) return [];

    const queryEmbedding = await generateEmbedding(query);

    const scored = candidateChunks.map((chunk) => {
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

    // Filter top matching chunks above threshold
    const matches = scored.filter((item) => item.score > 0.15).slice(0, limit);
    if (matches.length > 0) {
      return matches;
    }

    // Smart Fallback for Document-level queries ("summarize this pdf", "what is this document about", etc.)
    const isDocQuery =
      candidateChunks.length > 0 &&
      (/\b(summar|pdf|doc|file|cv|resume|about|who|what|tell me|overview|explain|read|info)\b/i.test(query) ||
        candidateChunks.length <= 5);

    if (isDocQuery) {
      return candidateChunks.slice(0, limit).map((chunk, index) => ({
        chunk,
        score: Math.max(0.4, 0.65 - index * 0.05),
        confidenceScore: 2,
        confidenceLabel: 'Highly Relevant (Document Overview)',
      }));
    }

    return [];
  }

  /**
   * Format search results into the exact context block expected by the LLM
   */
  public static formatSearchResults(results: SearchResultItem[]): string {
    if (results.length === 0) return '';

    return results
      .map((item, idx) => {
        const { chunk, confidenceScore, confidenceLabel } = item;
        const scopeTag = chunk.scope === 'chat' ? ' (Chat Attachment)' : ' (Global Knowledge Base)';
        return `Context document ${idx + 1} | Confidence Score: ${confidenceScore}-${confidenceLabel} | Source filename: ${chunk.fileName}${scopeTag} | Page: ${chunk.pageNumber} | Content: ${chunk.content}`;
      })
      .join('\n\n');
  }
}

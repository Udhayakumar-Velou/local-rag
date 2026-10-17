/**
 * Recursive character text splitter mirroring LangChain's RecursiveCharacterTextSplitter
 * as used in enterprise document chunking pipelines.
 */

export interface TextSplitterOptions {
  chunkSize?: number;
  chunkOverlap?: number;
  separators?: string[];
}

export interface ChunkWithMetadata {
  content: string;
  pageNumber: number ;
  chunkIndex: number;
}

export class RecursiveCharacterTextSplitter {
  private chunkSize: number;
  private chunkOverlap: number;
  private separators: string[];

  constructor(options: TextSplitterOptions = {}) {
    this.chunkSize = options.chunkSize ?? 2000;
    this.chunkOverlap = options.chunkOverlap ?? 400;
    this.separators = options.separators ?? ['\n\n', '\n', '. ', ' ', ''];
  }

  public splitText(text: string): string[] {
    return this.splitTextRecursive(text, this.separators);
  }

  public splitPages(
    pages: Array<{ text: string; pageNumber: number }>,
  ): ChunkWithMetadata[] {
    const results: ChunkWithMetadata[] = [];
    let chunkIndex = 0;

    for (const page of pages) {
      const cleaned = page.text.replace(/\r\n/g, '\n').trim();
      if (!cleaned) continue;

      const pageChunks = this.splitText(cleaned);
      for (const chunk of pageChunks) {
        const trimmed = chunk.trim();
        if (trimmed.length > 0) {
          results.push({
            content: trimmed,
            pageNumber: page.pageNumber,
            chunkIndex: chunkIndex++,
          });
        }
      }
    }

    return results;
  }

  private splitTextRecursive(text: string, separators: string[]): string[] {
    const finalChunks: string[] = [];
    let separator = separators[separators.length - 1];
    let newSeparators: string[] = [];

    for (let i = 0; i < separators.length; i++) {
      const s = separators[i];
      if (s === '') {
        separator = s;
        break;
      }
      if (text.includes(s)) {
        separator = s;
        newSeparators = separators.slice(i + 1);
        break;
      }
    }

    const splits = separator ? text.split(separator) : Array.from(text);
    const goodSplits: string[] = [];

    for (const s of splits) {
      if (s.length < this.chunkSize) {
        goodSplits.push(s);
      } else {
        if (goodSplits.length > 0) {
          const merged = this.mergeSplits(goodSplits, separator);
          finalChunks.push(...merged);
          goodSplits.length = 0;
        }
        if (newSeparators.length === 0) {
          finalChunks.push(s);
        } else {
          const otherInfo = this.splitTextRecursive(s, newSeparators);
          finalChunks.push(...otherInfo);
        }
      }
    }

    if (goodSplits.length > 0) {
      const merged = this.mergeSplits(goodSplits, separator);
      finalChunks.push(...merged);
    }

    return finalChunks;
  }

  private mergeSplits(splits: string[], separator: string): string[] {
    const docs: string[] = [];
    const currentDoc: string[] = [];
    let total = 0;

    for (const d of splits) {
      const _len = d.length;
      if (
        total + _len + (currentDoc.length > 0 ? separator.length : 0) >
        this.chunkSize
      ) {
        if (currentDoc.length > 0) {
          const doc = currentDoc.join(separator);
          if (doc) docs.push(doc);

          // Keep overlap
          while (
            total > this.chunkOverlap ||
            (total + _len + (currentDoc.length > 0 ? separator.length : 0) >
              this.chunkSize &&
              total > 0)
          ) {
            const popped = currentDoc.shift();
            if (!popped) break;
            total -= popped.length + (currentDoc.length > 0 ? separator.length : 0);
          }
        }
      }
      currentDoc.push(d);
      total += _len + (currentDoc.length > 1 ? separator.length : 0);
    }

    const doc = currentDoc.join(separator);
    if (doc) docs.push(doc);

    return docs;
  }
}

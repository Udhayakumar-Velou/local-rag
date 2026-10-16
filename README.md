# Local RAG Document Search System

A private, offline Retrieval-Augmented Generation (RAG) system for document search and intelligent question-answering. 

This project runs **100% locally on your machine** using Next.js, an OCR pre-processing overlay, LangChain recursive text chunking, a lightweight local vector store, and Ollama with **Qwen 2.5**.

---

## ✨ Features

- **Multimodal Document Ingestion:** Upload and index PDFs, images (PNG, JPG, WebP), and plain text / Markdown files.
- **OCR Pre-Processing Overlay:** Extracts text, numbers, and layout from images and scans using Tesseract OCR, enabling text-only LLMs to understand visual content.
- **Page-Aware Chunking:** Uses LangChain's recursive character text splitting (2,000 characters, 400 overlap) while tracking exact page numbers.
- **Local Vector Search:** Fast cosine similarity search with confidence scoring, persisted locally to disk with zero external database setup.
- **Strictly Grounded Answers:** Generates answers using a single local model (Qwen 2.5) with low temperature and exact source file & page citations.
- **Zero Cost & Private:** No API keys, no external cloud dependencies, no credit cards. All data stays on your machine.

---

## 🏛️ System Architecture

```text
[ Document / Image / PDF ]
          │
          ▼
[ Pre-Processing Overlay (PDF-Parse + Tesseract OCR) ]
          │
          ▼
[ LangChain Recursive Text Splitter (2000 chars / 400 overlap) ]
          │
          ▼
[ Local Vector Store (Embeddings + Cosine Similarity Index) ]
          │
          ▼
[ Context Retrieval (Top-5 Chunks with Confidence Scores) ]
          │
          ▼
[ Ollama: Qwen 2.5 3B (Grounded Answer with Page Citations) ]
```

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js**: v18.18+ or v20+
- **Ollama**: Installed from [ollama.com](https://ollama.com)
- **Computer**: Mac (Apple Silicon recommended) or Linux/Windows with 8 GB+ RAM

### 2. Pull the Local Model
Run in your terminal:
```bash
ollama pull qwen2.5:3b
```

*(Optional) If you want to use a local embedding model:*
```bash
ollama pull snowflake-arctic-embed
```

### 3. Installation
```bash
# Clone the repository
git clone https://github.com/Udhayakumar-Velou/local-rag.git
cd local-rag

# Install dependencies
npm install
```

### 4. Environment Configuration
Copy the sample environment file:
```bash
cp .env.example .env.local
```

Default settings:
```env
OLLAMA_HOST=http://127.0.0.1:11434
CHAT_MODEL=qwen2.5:3b
EMBEDDING_MODEL=snowflake-arctic-embed
```

### 5. Run the Application
```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## 📂 Project Structure

```text
├── app/
│   ├── api/
│   │   ├── chat/route.ts       # Chat endpoint with context retrieval & streaming
│   │   └── pdf/route.ts        # Upload, OCR, chunking & vector indexing route
│   ├── globals.css             # Tailwind CSS styling
│   ├── layout.tsx              # Root application layout
│   └── page.tsx                # Chat UI with Knowledge Base manager
├── data/
│   ├── documents/              # Storage directory for uploaded documents
│   └── vector-store.json       # Persisted vector chunks and metadata
├── lib/
│   └── rag/
│       ├── document-preprocessor.ts  # OCR and document parser overlay
│       ├── text-splitter.ts          # Recursive character text chunker
│       ├── embeddings.ts             # Embeddings generator and cosine similarity
│       └── vector-store.ts           # Local vector store with confidence scoring
├── .env.example                # Example environment variables
├── .gitignore                  # Git ignore rules
└── package.json                # Project dependencies
```

---

## 📖 How It Works

1. **Upload Documents:** Click **+ Upload** or the document icon to upload PDFs, images, or notes.
2. **Pre-Processing:** Digital PDFs are parsed page-by-page; images and scans pass through Tesseract OCR to extract readable text.
3. **Chunking & Indexing:** Text is broken into coherent chunks with overlap and indexed into the local vector store.
4. **Search & Ask:** When you submit a question, the vector store retrieves the most relevant chunks, injects them into the prompt, and Qwen 2.5 streams a response with source citations.

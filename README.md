# RAG Document Search System (Local Enterprise Architecture)

A private, local Retrieval-Augmented Generation (RAG) document search and question-answering system built with **Next.js**, **LangChain text chunking**, an **OCR / Document Pre-Processing Overlay**, a **local Snowflake Cortex-style vector store**, and **Ollama (Qwen 2.5)**.

This project is modeled directly on enterprise document search architectures (like Amazon S3 + Snowflake + Cortex Search), but designed to run **100% locally and completely free with zero credit cards, cloud bills, or external API dependencies**.

---

## 🏛️ Architecture Overview

| Pipeline Layer | Enterprise Production Stack | This Project (100% Free Local) | Purpose |
| :--- | :--- | :--- | :--- |
| **Raw Storage** | Amazon S3 | Local file repository (`data/documents/`) | Stores unaltered original files with metadata provenance. |
| **Pre-Processing Overlay** | AWS Textract / Cloud OCR | `Tesseract.js` + `PDF-Parse` (`lib/rag/document-preprocessor.ts`) | Converts images, scanned docs, and PDFs into clean text/markdown. |
| **Chunking Engine** | LangChain Python Splitter | `RecursiveCharacterTextSplitter` (`lib/rag/text-splitter.ts`) | Splits passages with 2000 character size, 400 overlap, and page tracking. |
| **Embedding Engine** | Snowflake Arctic Embed | Ollama (`snowflake-arctic-embed` or `nomic-embed-text`) | Generates 1024-dimensional dense semantic vectors. |
| **Vector Store & Search** | Snowflake Cortex Search | `LocalVectorStore` (`lib/rag/vector-store.ts`) | Cosine similarity search with Cortex confidence scores (`0-3`). |
| **LLM Generation** | Hosted GPT-4 / Claude | **Ollama (`qwen2.5:3b`)** | Streams strictly grounded answers with document & page citations. |

---

## 🚀 Quick Start

### 1. Prerequisites
- **Node.js**: v18.18+ or v20+
- **Mac / PC**: Apple Silicon (M1/M2/M3/M4) or Linux/Windows with 8 GB+ RAM
- **Ollama**: Installed from [ollama.com](https://ollama.com)

### 2. Pull the Local Model
Run in your terminal:
```bash
ollama pull qwen2.5:3b
```
*(Optional) Pull the embedding model (or the app will use its built-in offline vector fallback):*
```bash
ollama pull snowflake-arctic-embed
```

### 3. Clone and Install
```bash
# Clone your repository
git clone <your-repo-url>
cd <repo-folder>

# Install dependencies
npm install
```

### 4. Configure Environment
Copy the example environment file:
```bash
cp .env.example .env.local
```

Default configuration:
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
│   │   ├── chat/route.ts       # Streaming chat endpoint with RAG context injection
│   │   └── pdf/route.ts        # Document ingestion, OCR, chunking & vector indexing
│   ├── globals.css             # Tailwind dark-mode styling
│   ├── layout.tsx              # Root HTML & body layout
│   └── page.tsx                # Chat UI with Knowledge Base manager & metrics
├── data/
│   ├── documents/              # Local S3 store for original uploaded files
│   └── vector-store.json       # Persisted vector chunks, embeddings & metadata
├── lib/
│   └── rag/
│       ├── document-preprocessor.ts  # Multimodal overlay (OCR + PDF parser)
│       ├── text-splitter.ts          # LangChain recursive character chunker
│       ├── embeddings.ts             # Ollama embeddings & cosine similarity
│       └── vector-store.ts           # Cortex Search emulator with confidence scoring
├── .env.example                # Configuration template
├── .gitignore                  # Git ignore rules
└── package.json                # Project dependencies
```

---

## 🛠️ How It Works

1. **Document Upload & Pre-Processing:**
   - Upload any PDF, image (PNG, JPG, WebP), or Markdown file via the Knowledge Base button in the UI.
   - The **Pre-Processing Overlay** runs OCR on images and extracts text per page for PDFs, preserving page numbers.
2. **Chunking & Storage:**
   - Text is split into 2,000-character chunks with a 400-character overlap using the `RecursiveCharacterTextSplitter`.
   - Each chunk is tagged with its source file name, page number, and chunk index.
3. **Retrieval & Grounding:**
   - When a user asks a question, the vector store finds the top matching chunks using cosine similarity.
   - Chunks are formatted into an enterprise context block with confidence labels:
     `Context document 1 | Confidence Score: 3-Strong Relevance | Source: report.pdf | Page: 4 | Content: ...`
4. **Answer Generation:**
   - The query and retrieved context are sent to `qwen2.5:3b` with a low temperature (`0.1`) and 8K token context window.
   - Answers are streamed with exact page-level citations (e.g. `[report.pdf, Page 4]`).

---

## 📦 Creating a New Git Repository

To push this project to a new Git repository (e.g., on GitHub):

```bash
# 1. Initialize git (if not already initialized)
git init

# 2. Add all template files
git add .

# 3. Create initial commit
git commit -m "Initial commit: Enterprise local RAG system with Qwen 2.5 and OCR overlay"

# 4. Link to your new GitHub repository
git remote add origin https://github.com/<your-username>/<your-repo-name>.git

# 5. Push to main branch
git branch -M main
git push -u origin main
```

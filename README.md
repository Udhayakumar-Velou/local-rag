<div align="center">

# 🧠 Local Document AI & Search (RAG)

### Enterprise-Grade, 100% Private Document Intelligence Running Entirely on Your Local Machine.

[![Next.js](https://img.shields.io/badge/Next.js-16.4-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![Ollama](https://img.shields.io/badge/Ollama-Qwen_2.5_(3B)-white?style=for-the-badge&logo=ollama)](https://ollama.com/)
[![Local Only](https://img.shields.io/badge/Privacy-100%25_Offline-emerald?style=for-the-badge&logo=shield)](https://github.com/)
[![Apple Silicon](https://img.shields.io/badge/Optimized-Mac_M1%2FM2%2FM3-silver?style=for-the-badge&logo=apple)](https://apple.com/)
[![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](LICENSE)

<br />

<p align="center">
  <b>Talk to your PDFs, DOCX files, receipts, notes, and screenshots — completely offline.</b><br />
  No cloud APIs. No recurring subscriptions. No data leaving your laptop.
</p>

</div>

---

## 🌟 Product Highlights

### 🎨 Human-Centric Warm Light UI
Designed with a calming, tactile aesthetic inspired by modern editorial design. Featuring smooth animations, responsive drag-and-drop ingestion, collapsible conversation history, and zero visual clutter.

### 🧠 Single Model Simplicity (Qwen 2.5)
Powered entirely by local **Qwen 2.5 (3B)** with a native **32,768 context window** and a **4,096 token generation ceiling**. Delivers deep multi-page synthesis without needing costly multi-model routing or heavy GPU clusters.

### 👁️ Built-in Offline OCR Pipeline
Understands images, screenshots, scanned receipts, and invoices without requiring heavy multimodal vision model downloads. An integrated Tesseract OCR worker pre-processes visual documents instantly, feeding structured text directly into the retrieval engine.

### ⚡ Real-Time Performance & Token HUD
Always know what your hardware is doing. A non-intrusive live status HUD tracks:
- **`In:`** Exact prompt and injected document context tokens.
- **`Out:`** Tokens generated live at 60 FPS.
- **`tok/s:`** Live generation velocity.
- **`Duration:`** Response latency down to the tenth of a second.

### 🎯 Interactive Page Citations
Every fact and synthesis is backed by verified sources. Clickable citation pills (`[Report.pdf, Page 3]`) open a side preview drawer instantly revealing the exact grounded passage from your knowledge store.

### 📎 Flexible Ingestion: Chat Attachments or Global Knowledge Base
- **Chat Attachments:** Drag and drop files directly into an active conversation for ad-hoc, focused analysis.
- **Global Knowledge Base:** Manage persistent documents accessible across every conversation with one-click indexing and removal.

---

## 🏛️ How It Works

```
 ┌────────────────────────────────────────────────────────┐
 │  📄 Input Documents: PDF, DOCX, Images (PNG/JPG), TXT  │
 └──────────────────────────┬─────────────────────────────┘
                            │
                            ▼
 ┌────────────────────────────────────────────────────────┐
 │  🔍 Document Pre-Processor                             │
 │  • Digital PDFs: pdf-parse page extraction             │
 │  • Images/Scans: Offline Tesseract OCR Worker          │
 │  • Word Docs: python-docx text & table parser          │
 └──────────────────────────┬─────────────────────────────┘
                            │
                            ▼
 ┌────────────────────────────────────────────────────────┐
 │  ✂️ Page-Aware Semantic Chunking                       │
 │  • Recursive character splitting (2,000 chars / 400 ov)│
 │  • Preserves exact source filename & page numbers      │
 └──────────────────────────┬─────────────────────────────┘
                            │
                            ▼
 ┌────────────────────────────────────────────────────────┐
 │  ⚡ Local Vector Store & Retrieval                     │
 │  • Embedding model: snowflake-arctic-embed / nomic     │
 │  • Top-K Cosine similarity with confidence scoring     │
 └──────────────────────────┬─────────────────────────────┘
                            │
                            ▼
 ┌────────────────────────────────────────────────────────┐
 │  💬 Local Synthesis (Ollama: Qwen 2.5 3B)              │
 │  • Max native context window: 32,768                   │
 │  • Grounded answer generation with page citations      │
 └────────────────────────────────────────────────────────┘
```

---

## 📋 Supported File Formats

| Format | File Extensions | Processing Method |
| :--- | :--- | :--- |
| **PDF Documents** | `.pdf` | Direct page-by-page text parsing with fallback OCR |
| **Word Documents** | `.docx` | Paragraph and structured table text extraction |
| **Images & Screenshots** | `.png`, `.jpg`, `.jpeg`, `.webp` | High-speed offline Tesseract OCR worker |
| **Plain Text & Markdown** | `.txt`, `.md` | Direct UTF-8 ingestion and semantic chunking |

---

## 🚀 Quick Start (Under 2 Minutes)

### 1. Prerequisites
- **Node.js** v18.18+ or v20+
- **Ollama** installed from [ollama.com](https://ollama.com)
- 8 GB+ RAM (Runs seamlessly on Apple Silicon Mac M1/M2/M3/M4)

### 2. Pull Local Models
Ensure Ollama is running, then pull the language and embedding models:
```bash
ollama pull qwen2.5:3b
ollama pull snowflake-arctic-embed
```

### 3. Install Dependencies
```bash
git clone https://github.com/Udhayakumar-Velou/local-rag.git
cd local-rag
npm install
```

### 4. Configure Environment
```bash
cp .env.example .env.local
```

Default configuration in `.env.local`:
```env
OLLAMA_HOST=http://127.0.0.1:11434
CHAT_MODEL=qwen2.5:3b
EMBEDDING_MODEL=snowflake-arctic-embed
```

### 5. Launch the Studio
```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser and start asking questions!

---

## 🛡️ Privacy & Security Guarantee

- **Zero Cloud Leakage:** All computation, embedding generation, OCR parsing, and LLM inference happen strictly on `localhost`.
- **Safe by Default:** Uploaded documents (`data/documents/*`) and vector indexes (`data/vector-store.json`) are automatically ignored by `.gitignore`.
- **No Telemetry:** No user analytics or tracking scripts are embedded.

---

## 🛠️ Tech Stack

- **Framework:** Next.js 16 (App Router, Turbopack)
- **AI Streaming:** Vercel AI SDK (`@ai-sdk/react`, `streamText`)
- **Local Engine:** Ollama API (`qwen2.5:3b`)
- **OCR Engine:** Tesseract.js (Offline language packs)
- **Styling:** Tailwind CSS with custom editorial color palette
- **Markdown & Code:** ReactMarkdown, remark-gfm

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for details.

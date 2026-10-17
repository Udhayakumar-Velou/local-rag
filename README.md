<div align="center">

# ᚱ rune · local ai

### Enterprise-Grade, 100% Private Document Intelligence & Workspace Running Locally.

[![Next.js](https://img.shields.io/badge/Next.js-16.4-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![Ollama](https://img.shields.io/badge/Ollama-Qwen_2.5_(3B)-white?style=for-the-badge&logo=ollama)](https://ollama.com/)
[![Local Only](https://img.shields.io/badge/Privacy-100%25_Offline-emerald?style=for-the-badge&logo=shield)](https://github.com/)
[![Apple Silicon](https://img.shields.io/badge/Optimized-Mac_M1%2FM2%2FM3-silver?style=for-the-badge&logo=apple)](https://apple.com/)
[![Supabase](https://img.shields.io/badge/Sync-Supabase_Cloud-3ecf8e?style=for-the-badge&logo=supabase)](https://supabase.com/)
[![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](LICENSE)

<br />

<p align="center">
  <b>Talk to your PDFs, DOCX files, receipts, notes, and screenshots — completely offline.</b><br />
  Featuring project-based workspaces, custom system instructions, and optional encrypted cloud sync.
</p>

</div>

---

## 🌟 Product Highlights

### 📁 Project Workspaces & Hierarchy
Organize complex research, teams, and documents into dedicated **Projects** (e.g., *Linkedin*, *Automation*, *Dare*, *Master Thesis*).
- **Expandable Folder Tree:** Projects expand and collapse with clean indented conversation lists.
- **Hover Quick Actions:** Instantly start a new conversation inside any project (`+`) or open project settings (`⋯`).
- **Context Awareness:** The top navigation bar displays the active project folder badge.

### 🎯 Custom System Instructions Per Project
Assign distinct personas, output rules, or domain instructions to individual projects:
- Custom prompts are automatically injected into the local **Qwen 2.5** system instructions for every chat in that workspace.
- Tailor feedback style (e.g., *"Act as a senior tech recruiter reviewing CVs"* or *"Provide concise bullet points for executive briefings"*).

### 🎨 Editorial Warm Light UI
Designed with a calming, tactile aesthetic inspired by modern editorial design. Featuring smooth animations, responsive drag-and-drop ingestion, clean distraction-free navigation, and zero visual clutter.

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

### ☁️ Optional Supabase Cloud Sync
Sign in with Google OAuth to automatically back up your project workspaces and conversation history across devices.
- **Privacy-First Hybrid Architecture:** LLM inference and embeddings run **100% locally via Ollama**. Only workspace metadata and chat titles sync to your private Supabase database protected by Row Level Security (RLS).

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
 │  • Injected Project Custom Instructions                │
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

Configuration in `.env.local`:
```env
OLLAMA_HOST=http://127.0.0.1:11434
CHAT_MODEL=qwen2.5:3b
EMBEDDING_MODEL=snowflake-arctic-embed

# Optional: Supabase Cloud Sync
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-publishable-key
```

*(If using Supabase Cloud Sync, run the SQL script in `supabase/schema.sql` inside your Supabase SQL Editor).*

### 5. Launch the Studio
```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser and start asking questions!

---

## 🛡️ Privacy & Security Guarantee

- **Zero Cloud Leakage:** All LLM computation, embedding generation, OCR parsing, and document searching happen strictly on `localhost`.
- **Safe by Default:** Uploaded documents (`data/documents/*`) and vector indexes (`data/vector-store.json`) are automatically ignored by `.gitignore`.
- **No Telemetry:** No user analytics or tracking scripts are embedded.

---

## 🛠️ Tech Stack

- **Framework:** Next.js 16 (App Router, Turbopack)
- **AI Streaming:** Vercel AI SDK (`@ai-sdk/react`, `streamText`)
- **Local LLM & Embeddings:** Ollama API (`qwen2.5:3b`, `snowflake-arctic-embed`)
- **Cloud Sync:** Supabase (Auth, PostgreSQL, Row Level Security)
- **OCR Engine:** Tesseract.js (Offline language packs)
- **Styling:** Tailwind CSS with custom editorial color palette
- **Markdown & Code:** ReactMarkdown, remark-gfm

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for details.

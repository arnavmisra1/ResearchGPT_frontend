# Chat with PDFs (ResearchGPT)

An AI-powered RAG (Retrieval-Augmented Generation) application that lets users upload PDFs and have grounded, cited conversations with their content — with in-browser highlighting, auto-generated summaries, and real-time streaming responses.

**🔗 Live demo:** https://research-gpt-frontend.vercel.app

> Note: hosted on free-tier infrastructure. The backend sleeps after inactivity, so the first request may take 30–60 seconds to wake up. Uploaded documents are not permanently persisted on the free tier.

---

## Features

- **Full RAG pipeline** — PDF text extraction, chunking, vector embeddings, and semantic retrieval feed a grounded LLM response for every question, with page-number source citations
- **Real-time streaming answers** — responses stream token-by-token via Server-Sent Events, rather than waiting for a complete response
- **Conversation memory** — follow-up questions correctly use prior context within a document's chat history
- **Multi-document support** — upload and switch between multiple PDFs, each with fully isolated retrieval, chat history, and highlights
- **In-browser PDF viewer & highlighting** — select and highlight text directly on the rendered PDF; highlights persist accurately across sessions, including multi-line selections
- **Auto-generated summaries** — a short summary and key topic tags are generated automatically on upload using structured LLM output
- **Resizable, polished UI** — draggable panel layout, custom dark theme, and comprehensive client- and server-side error handling

## Tech Stack

**Frontend**
- React + Vite
- `react-pdf` (PDF.js) for in-browser rendering
- Native browser Selection API for highlight capture

**Backend**
- FastAPI (Python)
- ChromaDB — vector storage and semantic retrieval
- SQLite — annotations and document summaries
- Server-Sent Events for response streaming

**AI / ML**
- Groq (Llama 3.1) — chat generation, via an OpenAI-compatible client
- Hugging Face Inference API — text embeddings (`sentence-transformers/all-MiniLM-L6-v2`)

**Deployment**
- Vercel — frontend hosting
- Render — backend hosting

## Architecture

```
┌─────────────┐         ┌──────────────┐         ┌─────────────────┐
│   React     │ ───────▶│   FastAPI    │ ───────▶│  Groq (LLM)      │
│  (Vercel)   │◀─────── │  (Render)    │◀─────── │  HF (Embeddings) │
└─────────────┘  SSE    └──────┬───────┘         └─────────────────┘
                                │
                    ┌───────────┴───────────┐
                    │                       │
              ┌─────▼─────┐          ┌──────▼──────┐
              │  ChromaDB  │          │   SQLite    │
              │ (vectors)  │          │(annotations,│
              │            │          │  summaries) │
              └────────────┘          └─────────────┘
```

**How a question is answered:**
1. Uploaded PDF text is extracted and split into overlapping chunks
2. Each chunk is embedded and stored in ChromaDB, scoped to that document
3. On a question, the query is embedded and the most relevant chunks are retrieved
4. Retrieved chunks + conversation history are sent to the LLM as context
5. The answer streams back token-by-token, with source page numbers attached

## Running Locally

**Backend**
```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Mac/Linux
pip install -r requirements.txt
```

Create a `.env` file in `backend/`:
```
GROQ_API_KEY=your_groq_key
HF_API_TOKEN=your_huggingface_token
```

```bash
uvicorn main:app --reload
```

**Frontend**
```bash
cd frontend
npm install
```

Create a `.env.local` file in `frontend/`:
```
VITE_API_URL=http://localhost:8000
```

```bash
npm run dev
```

## Repository Structure

This project is split across two repositories, matching how each half is deployed:

- **Backend:** [chat-with-pdfs-backend](#) — FastAPI application, deployed on Render
- **Frontend:** [chat-with-pdfs-frontend](#) — React application, deployed on Vercel

## Notes on Free-Tier Hosting

This project is deployed entirely on free hosting tiers as a demonstration:
- The backend spins down after periods of inactivity and takes ~30–60s to restart on the next request
- Neither ChromaDB nor SQLite have persistent disk storage on the free tier, so uploaded documents and annotations do not survive a backend restart

For production use, these would be addressed with a paid tier offering persistent storage, or by migrating to managed hosted services for the vector store and database.

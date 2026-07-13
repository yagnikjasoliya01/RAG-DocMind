# DocMind — AI Document Q&A

Upload your documents and chat with them using AI.

## What it does

- Upload PDFs, images, or text files
- Ask questions about your documents in a chat interface
- Get answers with source citations from the original document
- Export chat history as Markdown or PDF

## Tech Stack

- **Frontend** — Next.js, TypeScript
- **Backend** — FastAPI, Python
- **Auth & Storage** — Supabase
- **Vector Store** — ChromaDB
- **LLM** — Groq (Llama 3.3 70B)
- **Embeddings** — Google Gemini
- **Queue** — Celery + Redis

## Run locally

```bash
# 1. Copy env and fill in your keys
cp .env.example .env

# 2. Start backend services
docker compose up --build

# 3. Start frontend
cd frontend
npm install && npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Environment variables

See [`.env.example`](.env.example) for all required keys (Supabase, Google AI, Groq).

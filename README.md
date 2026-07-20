# Aether AI

Aether AI is a production-oriented foundation for an autonomous desktop AI system agent. This initial version establishes the architecture, tooling, configuration, and first working UI/API surfaces without implementing sensitive automation, memory, voice, vision, RAG, or plugin business logic.

## Architecture

- `frontend/` - Tauri, React, TypeScript, Vite, TailwindCSS, shadcn-style UI primitives, Zustand, React Router, React Query, Framer Motion, Monaco-ready structure.
- `backend/` - Python 3.13, FastAPI, Pydantic v2, SQLAlchemy, Alembic, async service boundaries, and clean architecture placeholders.
- `docker/` - Container assets for local infrastructure.
- `docs/` - Architecture, development, security, and operations notes.

## Quick Start

### Prerequisites

- Python 3.13+
- Node.js 22+
- npm 10+
- Rust/Cargo for Tauri desktop builds
- Ollama installed and running locally

```powershell
cd AetherAI
if (Test-Path .venv) { Remove-Item -Recurse -Force .venv }
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -e "./backend[dev]"
cd frontend
npm install
```

Pull the default model used by the backend:

```powershell
ollama pull qwen2.5:7b-instruct
```

Start Ollama in a separate terminal if it is not already running:

```powershell
# Find and kill Ollama processes
Get-Process ollama -ErrorAction SilentlyContinue | Stop-Process -Force

# Wait a moment for the port to be released
Start-Sleep -Seconds 2

# Try again
ollama serve
```

Run the backend in one terminal:

```powershell
cd backend
..\.venv\Scripts\Activate.ps1
uvicorn app.main:create_app --factory --host 127.0.0.1 --port 8001
```

In a second terminal, run the frontend dev server:

```powershell
cd frontend
npm install
npm run dev
```

If you want the desktop app instead of the browser preview, use:

```powershell
npm run dev
```

> The backend health endpoint and frontend production build were both verified successfully in the current workspace.

## Current Scope

Implemented:

- Enterprise-grade project structure.
- First FastAPI health, status, and dashboard endpoints.
- First Tauri/React dashboard experience with routing, stores, services, and reusable UI.
- Provider, agent, tool, memory, workflow, RAG, vision, voice, plugin, security, and logging interfaces.
- Docker Compose for PostgreSQL, Redis, ChromaDB, backend, and frontend.
- A new chat foundation with FastAPI SSE streaming, conversation-oriented schemas, a reusable prompt builder, a modular orchestrator, and an Ollama-ready LLM provider for a self-hosted Qwen 2.5 7B workflow.
- Local ChromaDB-backed semantic memory persistence with conversation memory ingestion and semantic recall.
- SQLite-backed conversation history storage for multi-turn chats and conversation reconstruction.
- A modular web retrieval layer for SearXNG queries, HTML cleanup, and content extraction.

Intentionally deferred:

- Real desktop automation.
- Real browser automation.
- Real long-term memory and vector ingestion.
- Real voice and vision pipelines.
- Real plugin execution.
- Provider-specific LLM calls.


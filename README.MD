# LeadAI Trust Framework (THELEADAI Development)

This monorepo hosts the **THELEADAI** development stack that powers the LeadAI Trust Framework. It brings together:

- A Next.js front-end (`apps/web`) with an AI chatbot experience.
- A FastAPI core service (`apps/core-svc`) that serves projects, scorecards, trends, and admin data.
- A Model Context Protocol (MCP) server (`apps/mcp`) that delivers retrieval-augmented generation (RAG) over company documents.
- A Docker-first infrastructure layer (PostgreSQL, MinIO S3, Redis, Qdrant vector DB) plus Ollama for local LLM chat/embeddings.

The stack runs on Windows-native tooling and PowerShell automation to give you a one-command developer spin-up.

---

## Table of Contents

1. [Stack Overview](#stack-overview)
2. [Prerequisites](#prerequisites)
3. [Local Infrastructure](#local-infrastructure)
4. [Application Services](#application-services)
5. [Using the MCP AI Chatbot](#using-the-mcp-ai-chatbot)
6. [Scripts & Automation](#scripts--automation)
7. [Environment Variables](#environment-variables)
8. [Troubleshooting](#troubleshooting)
9. [Reference Docs](#reference-docs)

---

## Stack Overview

- **Front-end** (`apps/web`): Next.js 14 app with authenticated dashboards, `/health`, and `/chat` for the AI assistant.
- **Core API** (`apps/core-svc`): FastAPI service exposing structured data (projects, scorecards, admin metadata) and backing the UI.
- **MCP / AI Agent** (`apps/mcp`):
  - Express + FastMCP bridge exposing MCP-compatible tool endpoints over HTTP.
  - Integrates Ollama (chat + embeddings) and Qdrant (vector search) to deliver responses with citations.
  - Publishes document resources so any MCP-capable client (Claude Desktop, VS Code, etc.) can connect.
- **Data & Storage**:
  - PostgreSQL 15 (`docker-compose.yml` service `postgres` / container `leadai-postgres`).
  - Redis 7 (`leadai-redis`) for caching and queues.
  - MinIO (S3-compatible) object storage with built-in console (`leadai-minio`).
  - Qdrant vector database (`qdrant_instance`, started via `scripts/start_all.ps1` or standalone Docker).
  - Ollama for local LLM hosting (models: `llama3.1:8b`, `nomic-embed-text` by default).

---

## Prerequisites

- **Windows 11 / PowerShell 7** (scripts target PowerShell; Windows Terminal optional).
- **Docker Desktop** with WSL2 backend enabled.
- **Node.js 18+** and `pnpm` (run `corepack enable` after installing Node).
- **Python 3.11+** with `uv`/`pip` for the FastAPI service virtual environment.
- **Ollama** installed locally (`ollama serve` should listen on `localhost:11434`).
- **Git LFS** if you need to sync binary docs that the chatbot references.
- Optional: Qdrant CLI tools for advanced management.

> Tip: Run `scripts\pre_startup.ps1` after installing prerequisites—it checks Docker, volumes, Ollama, and required ports.

---

## Local Infrastructure

### Option A – Docker Compose

The repo ships with `docker-compose.yml` that provisions:

```yaml
postgres: postgres://xxxxx:xxxxx@localhost:5432/leadai
redis:    redis://localhost:6379
minio:    http://localhost:9000 (console on 9001)
```

Start them with:

```powershell
docker compose up -d            # spins up Postgres, Redis, MinIO
```

### Option B – PowerShell Orchestration

Use `scripts\start_all.ps1` for a complete bring-up:

1. Ensures Docker Desktop is running.
2. Creates persistent volumes (`pgdata`, `minio`, `qdrant-storage`).
3. Starts/rehydrates Docker containers:
   - `leadai_pg` (Postgres, optional toggle `-SkipPostgres`).
   - `leadai_minio` and `leadai_redis` from compose.
   - `qdrant_instance` (HTTP 6333, gRPC 6334).
4. Launches Ollama if needed.
5. Opens dedicated terminals for:
   - FastAPI core service (`uvicorn` on :8001).
   - MCP server (`pnpm --filter ./apps/mcp dev` on :8787).
   - Next.js web (`pnpm --filter ./apps/web dev` on :3000).

Shut everything down with `scripts\stop_all.ps1`.

### Qdrant

If you prefer manual control:

```powershell
docker run -d --name qdrant_instance `
  -p 6333:6333 -p 6334:6334 `
  -v qdrant-storage:/qdrant/storage `
  qdrant/qdrant
```

The MCP server expects `QDRANT_URL=http://localhost:6333`.

---

## Application Services

### Core Service (FastAPI)

```powershell
cd apps/core-svc
python -m venv .venv
. .\.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001
```

Configuration relies on `DATABASE_URL` (set automatically by `start_all.ps1`). The service exposes `/healthz`.

### MCP Server

```powershell
cd apps/mcp
pnpm install
cp .env.example .env  # configure Ollama & Qdrant URLs
pnpm dev              # http://localhost:8787
```

Endpoints follow MCP tool semantics: `POST /tools/ingest.upsert`, `POST /tools/chat.answer`, `GET /tools/admin.status`, etc. Health checks surface Qdrant/Ollama status and the active collection.

### Web App (Next.js)

```powershell
cd apps/web
pnpm install
cp .env.example .env.local
pnpm dev --port 3000
```

Key routes:

- `/` – main dashboard.
- `/chat` – AI assistant front-end consuming MCP server.
- `/health` – diagnostics page confirming Postgres, Redis, MinIO, and Qdrant connectivity.

Ensure `NEXT_PUBLIC_MCP_SERVER_URL` points to the MCP server base URL.

---

## Using the MCP AI Chatbot

1. **Prepare source documents**: place `.pdf`, `.docx`, `.xlsx`, `.txt`, `.csv` files inside directories covered by `MCP_DOC_ROOTS`.
2. **Ingest via MCP**:
   - Scan directories: `POST /tools/ingest.scan`.
   - Upsert documents: `POST /tools/ingest.upsert`.
   - Delete documents: `POST /tools/ingest.delete`.
3. **Chat**:
   - Visit `http://localhost:3000/chat`, choose documents to include, and ask questions.
   - Responses include citations back to the original files via signed MinIO URLs.
4. **External MCP clients**:
   - Point them to `http://localhost:8787`.
   - Tools: `ingest.*`, `retriever.search`, `chat.answer`, `watch.*`.
   - Resources: `/resources/doc?path=...`, `/resources/chunk/<doc_hash>/<chunk_id>`.

See `docs/mcp-chatbot-setup.md` for end-to-end instructions, including recommended Ollama models and heuristics for chunking.

---

## Scripts & Automation

- `scripts/pre_startup.ps1`: Verifies Docker, Ollama, Qdrant volumes, and lists blocking issues before launch.
- `scripts/start_all.ps1`: One-stop orchestration for infrastructure + app processes (described above).
- `scripts/stop_all.ps1`: Stops Docker containers (`leadai_pg`, `qdrant_instance`, etc.) and closes spawned terminals.
- `scripts/backup/*.ps1`: Utilities for exporting/importing database snapshots (add your scripts here).

Run scripts from the repo root (`C:\apps\_TheLeadAI`) with PowerShell.

---

## Environment Variables

| Variable | Component | Default | Notes |
|----------|-----------|---------|-------|
| `DATABASE_URL` | Core API | `postgresql://xxxxxx:xxxxxx@localhost:5432/leadai` | Injected by `start_all.ps1`. |
| `OLLAMA_URL` | MCP | `http://localhost:11434` | Ensure Ollama is serving and models are pulled. |
| `OLLAMA_CHAT_MODEL` | MCP | `llama3.1:8b` | Set in `apps/mcp/.env`. |
| `OLLAMA_EMBED_MODEL` | MCP | `nomic-embed-text` | Must match the embedding dimension (768). |
| `QDRANT_URL` | MCP/Web | `http://localhost:6333` | Qdrant REST endpoint. |
| `QDRANT_COLLECTION` | MCP/Web | `leadai_docs` | Created lazily on first ingest. |
| `NEXT_PUBLIC_MCP_SERVER_URL` | Web | `http://localhost:8787` | Used by `/chat` UI. |
| `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` | Docker | `minioadmin` | Change for production. |

Store secrets outside version control (e.g., `.env`, Windows Credential Manager, or Azure Key Vault).

---

## Troubleshooting

- **Qdrant connection errors**: confirm container is running (`docker ps`), ports 6333/6334 are free, and `QDRANT_URL` matches.
- **Embedding dimension mismatch**: ensure `OLLAMA_EMBED_MODEL` equals the model you pulled (default 768 dims).
- **MinIO access denied**: log into the console at `http://localhost:9001` using `minioadmin/minioadmin`, create the bucket expected by the app, and regenerate credentials.
- **Postgres schema migrations**: run Alembic migrations from `apps/core-svc/alembic` after adjusting the database URL.
- **Ports already in use**: re-run `scripts/pre_startup.ps1` to identify conflicts; supply `-SkipPostgres` if using an external DB.
- **Chatbot missing documents**: confirm the paths fall under `MCP_DOC_ROOTS` and re-run `ingest.upsert`. Use `/tools/admin.status` for ingestion logs.

---

## Reference Docs

- `docs/mcp-chatbot-setup.md` – Detailed MCP + Qdrant + Ollama configuration.
- `docs/LeadAI_dev/` – Product specifications, UI flows, and draft content.
- `scripts/` – Windows automation for local development.
- `apps/core-svc/alembic/` – Database migration history.

> This README replaces the previous ODT-based document to ensure Markdown renders correctly on GitHub and in editors.

Happy building! Let the PowerShell launcher run the heavy lifting while you iterate on the core services and MCP-powered chatbot.

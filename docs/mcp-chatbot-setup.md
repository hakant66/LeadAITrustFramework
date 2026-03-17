# LeadAI MCP Chatbot Setup

This guide walks through standing up the local RAG-powered chatbot that indexes on-premise documents and serves responses via a Model Context Protocol (MCP) server. The stack uses **Ollama** for both generation and embeddings, **Qdrant** for vector storage, and a custom FastMCP bridge inside this repository.

## 1. Prerequisites

| Component | Notes |
|-----------|-------|
| Node.js 18+ / pnpm | `pnpm` already manages the monorepo. Install Node ≥ 18 and run `corepack enable` to get pnpm. |
| Python (optional) | Only required if you need additional document parsers. |
| Ollama | Install from [ollama.com](https://ollama.com) and ensure it runs locally. Pull the models: `ollama pull llama3.1:8b` and `ollama pull nomic-embed-text`. |
| Qdrant | Run via Docker: `docker run -p 6333:6333 -v qdrant_storage:/qdrant/storage qdrant/qdrant`. |
| Documents | Place all `.pdf`, `.docx`, `.xlsx`, `.txt`, `.csv` files under one or more directories that you will allow the ingestion pipeline to scan. |

## 2. Configure environment

Create a `.env` file inside `apps/mcp`:

```bash
cd apps/mcp
cp .env.example .env
```

Update the variables:

- `OLLAMA_URL`: usually `http://localhost:11434`
- `OLLAMA_CHAT_MODEL`: set to `llama3.1:8b`
- `OLLAMA_EMBED_MODEL`: `nomic-embed-text` (768-dimensional)
- `QDRANT_URL`: `http://localhost:6333`
- `QDRANT_API_KEY`: optional if you enabled auth in Qdrant
- `MCP_DOC_ROOTS`: semicolon-separated absolute paths that the MCP server may ingest (e.g. `C:\Users\alex\Documents\LeadAI;D:\Compliance`)

## 3. Install dependencies & build

```bash
pnpm install          # installs all workspace deps, including apps/mcp
pnpm --filter mcp-server build
```

## 4. Run supporting services

```bash
# Start Qdrant (Docker)
docker run -p 6333:6333 -v qdrant_storage:/qdrant/storage qdrant/qdrant

# Start Ollama (if not already running)
ollama serve
```

## 5. Start the MCP server

```bash
cd apps/mcp
pnpm dev   # or pnpm start after building
```

The server listens on `http://localhost:7443` (configurable via `PORT`) and exposes the following tool endpoints:

- `POST /tools/ingest.scan`
- `POST /tools/ingest.upsert`
- `POST /tools/ingest.delete`
- `POST /tools/retriever.search`
- `POST /tools/chat.answer`
- `POST /tools/watch.enable`
- `POST /tools/watch.disable`
- `GET  /tools/admin.status`

Resources are published under:

- `GET /resources/doc?path=<abs-path>`
- `GET /resources/chunk/<doc_hash>/<chunk_id>`

Even though the API is HTTP-based, the surface mirrors common MCP tool semantics, so any MCP client can wrap these calls. The `apps/web` UI integrates directly using fetch.

## 6. Index documents

Examples using `httpie`:

```bash
# Find all documents under a folder
http POST :7443/tools/ingest.scan globs:='["C:/data/leadai/**/*.pdf","C:/data/leadai/**/*.docx"]'

# Ingest/refresh the returned paths
http POST :7443/tools/ingest.upsert paths:='["C:/data/leadai/policies/security_policy.pdf"]'

# Remove a document
http POST :7443/tools/ingest.delete paths:='["C:/data/leadai/policies/deprecated_policy.pdf"]'
```

## 7. Use the chatbot UI

1. Add the MCP server URL to the Next.js environment:

   ```ini
   # apps/web/.env.local
   NEXT_PUBLIC_MCP_SERVER_URL=http://localhost:7443
   ```

2. Start the web app:

   ```bash
   cd apps/web
   pnpm dev
   ```

3. Visit `http://localhost:3000/chat` to access the chatbot. You can:
   - Ingest new documents directly from the UI.
   - Ask questions and receive answers with citations back to the original files.

## 8. External MCP clients

Because the server exposes tool-like contracts, you can connect other MCP-aware clients (e.g. Claude Desktop, VS Code MCP extensions) by pointing them at `http://localhost:7443` and mapping tool names. See the MCP client documentation for the exact adapter syntax.

## 9. Operational tips

- **Document updates**: re-run `ingest.upsert` on the modified file; the doc hash ensures chunks are refreshed.
- **Collection resets**: `curl -X DELETE http://localhost:6333/collections/leadai_docs` followed by a re-ingest if you need a clean slate.
- **Monitoring**: `GET /tools/admin.status` returns Ollama/Qdrant health and collection name.
- **Watchers**: `watch.enable` wires chokidar to directories to log changes (hook real callbacks as needed).

## 10. Troubleshooting

| Symptom | Resolution |
|---------|------------|
| `Embedding dimension mismatch` | Ensure `OLLAMA_EMBED_MODEL` and `OLLAMA_EMBED_DIMENSION` align with the model you pulled (e.g. `nomic-embed-text` → 768). |
| `Path ... is outside allowed roots` | Update `MCP_DOC_ROOTS` to include the folders you want to index. |
| Qdrant `404` on collection | The server creates the collection lazily. Check Docker logs to ensure Qdrant is running and accessible. |
| Ollama request failures | Confirm `ollama serve` is running and the model is pulled (`ollama list`). |

With the pipeline in place you can keep documents synced locally, query them from the web UI, and attach the same MCP server to other tools. Adjust chunk sizes and overlap in `/tools/ingest.upsert` if you need different context windows for your model.

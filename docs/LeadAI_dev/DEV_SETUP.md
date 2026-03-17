DEV_SETUP.md
LeadAI Trust Framework — Local Development Setup

This guide explains how to run the LeadAI stack locally using Docker on macOS (Apple Silicon) or Windows, including database migration between machines.

Prerequisites

Docker Desktop (latest)

Git

macOS or Windows

Ports free on host:

3000 (Web UI)

8001 (Core API)

5432 (Postgres)

9000–9001 (MinIO)

8787 (MCP)

6333 (Qdrant)

11434 (Ollama)

Repository Setup
git clone <repo-url>
cd LeadAITrustFramework-docker
Environment file

Create a .env file in the repo root (do not commit this):

# Database (container-to-container)
DATABASE_URL=postgresql+psycopg://leadai:leadai@postgres:5432/leadai


# Evidence storage (host path)
EVIDENCE_HOST_DIR=./data/leadai-evidence


# Frontend → browser-accessible services
NEXT_PUBLIC_MCP_SERVER_URL=http://localhost:8787


# Optional
NEXT_TELEMETRY_DISABLED=1

# Optional — Langfuse (LLM tracing / model cards)
# LANGFUSE_PUBLIC_KEY=...
# LANGFUSE_SECRET_KEY=...
# LANGFUSE_BASE_URL=http://langfuse:4000

Create the evidence directory:

mkdir -p ./data/leadai-evidence
Start the Stack
docker compose --env-file .env up -d
docker compose ps
Migrations (after stack is up)

docker exec -it core-svc alembic upgrade head

(Use the actual core service container name if different, e.g. from docker compose ps.)

Key URLs

Web UI: http://localhost:3000

Core API: http://localhost:8001

API Docs: http://localhost:8001/docs

Health: http://localhost:8001/healthz

MinIO Console: http://localhost:9001

Database Migration (Windows → Mac)
1) Dump database on source machine (Windows)
docker exec -t leadai-postgres \
  pg_dump -U leadai -d leadai -Fc > leadai.dump
2) Transfer leadai.dump to target machine (Mac)

Any method (SCP, AirDrop, USB, etc).

3) Restore on target machine (Mac)
docker compose down -v
docker compose up -d postgres


docker cp leadai.dump leadai-postgres:/tmp/leadai.dump
docker exec -i leadai-postgres \
  pg_restore -U leadai -d leadai --clean --if-exists /tmp/leadai.dump

Verify:

docker exec -it leadai-postgres \
  psql -U leadai -d leadai -c "\dt"
Networking Model (Important)

Containers talk to each other using service names

Example: http://core-svc:8001

Browser talks to services via localhost

Example: http://localhost:8001

Do not use core-svc URLs in browser-facing (NEXT_PUBLIC_*) variables.

Common Issues
Web UI loads but shows no data

Check browser Network tab

Ensure frontend is not calling http://core-svc:8001

Restart web after env changes:

docker compose up -d --force-recreate web
Docker volume mount errors on macOS

Ensure host paths are under /Users/...

Avoid Windows paths like C:/... on macOS

Check resolved config:

docker compose config
Reset Everything (⚠️ destructive)
docker compose down -v
docker compose up -d
What Not to Commit

.env

Database dumps

Credentials

Local data volumes

Commit instead:

docker-compose.yml

.env.example

This DEV_SETUP.md

✅ If you can open http://localhost:3000 and see projects + scorecards, the setup is complete.
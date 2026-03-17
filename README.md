# LeadAI Trust Framework (THELEADAI Development)

This monorepo hosts the **THELEADAI** development stack that powers the LeadAI Trust Framework. It brings together:

- A Next.js front-end (`apps/web`) with governance dashboards, i18n, and passwordless auth.
- A FastAPI core service (`apps/core-svc`) that serves projects, scorecards, trends, admin data, and translations.
- A Model Context Protocol (MCP) server (`apps/mcp`) that delivers retrieval-augmented generation (RAG) over company documents.
- A Docker-first infrastructure layer (PostgreSQL, MinIO S3, Redis, Qdrant vector DB) plus Ollama for local LLM chat/embeddings.
- Governance execution, control & audit, data register, and knowledge base modules with policy-driven alerts.

The stack is Docker-first and runs cross-platform (macOS / Windows / Linux). PowerShell automation is still available for Windows users.

---

## Table of Contents

1. [Stack Overview](#stack-overview)
2. [Architecture](#architecture)
3. [Multi-Entity Architecture (2026 Update)](#multi-entity-architecture-2026-update)
4. [Governance Process Flow](#governance-process-flow)
5. [Prerequisites](#prerequisites)
6. [Docker Quickstart](#docker-quickstart-all-services)
7. [Local Infrastructure](#local-infrastructure)
8. [Application Services](#application-services)
9. [Authentication (Passwordless)](#authentication-passwordless)
10. [Internationalization](#internationalization)
11. [Project Translations](#project-translations)
12. [Using the MCP AI Chatbot](#using-the-mcp-ai-chatbot)
13. [Langfuse Integration](#langfuse-integration)
14. [Multi-Agent Development System](#multi-agent-development-system)
15. [Scripts & Automation](#scripts--automation)
16. [Environment Variables](#environment-variables)
17. [Troubleshooting](#troubleshooting)
18. [Reference Docs](#reference-docs)

---

## Stack Overview

- **Front-end** (`apps/web`): Next.js 15 app with governance dashboards, `/health`, `/register` (passwordless), and `/leadai-chatbot` (with `/chat` redirect) for AI assistant UX.
- **Core API** (`apps/core-svc`): FastAPI service exposing structured data (projects, scorecards, admin metadata) and backing the UI. Includes translation-aware endpoints.
- **Regulatory + Trust Services**: `apps/reg-svc`, `alert_worker`, `reg-worker`, and `apps/cert-svc` handle trust decay, policy alerts, scheduled governance checks, and Trustmark issuance.
- **Trust + Provenance**: Trust Axes (Safety, Compliance, Provenance), Trust Verdict (TOL-0 to TOL-3), and a rules-based Provenance engine (P0-P3).
- **AI Governance**: Governance Setup, Execution, Control & Audit, Data Register, and Knowledge Base (KPI list + EU AI Act + ISO 42001).
- **Multi-Entity Access**: Entity-scoped routing (`/{entitySlug}/...`), role-based access (`user_entity_access`), and data isolation via `entity_id` + `entity_slug`.
- **Policy Alerts**: Active policies drive governance warnings surfaced on dashboards and Trust Monitoring.
- **MCP / AI Agent** (`apps/mcp`):
  - Express + FastMCP bridge exposing MCP-compatible tool endpoints over HTTP.
  - Integrates Ollama (chat + embeddings) and Qdrant (vector search) to deliver responses with citations.
  - Publishes document resources so any MCP-capable client (Claude Desktop, VS Code, etc.) can connect.
- **Chatbot Services**:
  - `leadai-chatbot` adapter service for retrieval and pgvector-backed chatbot queries.
  - `pii-regex-worker` for periodic PII scanning and audit events.
- **Integrations**:
  - `mock-jira` for local Jira integration testing.
  - Optional Langfuse stack (`langfuse-web`, `langfuse-worker`, `langfuse-redis`, `langfuse-clickhouse`) in the default compose file.
- **Data & Storage**:
  - PostgreSQL 15 (`docker-compose.yml` service `postgres` / container `leadai-postgres`).
  - Redis 7 (`leadai-redis`) for caching and queues.
  - MinIO (S3-compatible) object storage with built-in console (`leadai-minio`).
  - Qdrant vector database (`leadai-qdrant` in Docker Compose; `qdrant_instance` in on-host PowerShell flow).
  - Ollama for local LLM hosting (models: `llama3.1:8b`, `nomic-embed-text` by default).

## Architecture

```mermaid
flowchart LR
  subgraph Browser
    UI[Next.js Web UI]
  end

  UI -->|HTTP /api| Web[apps/web]
  Web -->|REST| Core[apps/core-svc]
  Web -->|MCP tools| MCP[apps/mcp]

  Core --> PG[(Postgres)]
  Web --> PG
  Core --> Redis[(Redis)]
  MCP --> Qdrant[(Qdrant)]
  MCP --> MinIO[(MinIO S3)]
  MCP --> Ollama[(Ollama)]

  PG --- Auth[(auth schema)]
  PG --- CoreData[(public schema)]
```

Notes:
- The **auth schema** stores passwordless login tokens/sessions for NextAuth.
- The **project_translations** table lives in the public schema and is managed by Alembic.

---

## Multi-Entity Architecture (2026 Update)

LeadAI now runs in a multi-entity model with entity-scoped routing, authorization, and data isolation.

### Entity Context + Routing
- Primary UI routes are entity-scoped: `/{entitySlug}/scorecard/...`.
- Core APIs accept entity context via `X-Entity-ID` or `?entity_id`; some admin routes include `entity_id` in the path (for example `/admin/master/entities/{entity_id}`).
- If a list endpoint is called without entity context (e.g., `GET /projects`), core-svc defaults to the user's first entity from `user_entity_access`.
- Legacy `/scorecard/...` routes are still present for backward compatibility; prefer entity-scoped URLs for new work.

### Data Model + Access Control
- The `entity` table is the tenant boundary; `entity.slug` is the URL-friendly identifier.
- `user_mapping` maps NextAuth user IDs (cuid) to backend UUIDs used across core-svc.
- `user_entity_access` grants `admin`, `editor`, or `viewer` roles per entity.
- Entity-scoped tables now include both `entity_id` and `entity_slug` for isolation and fast filtering.
- Migrations `add_entity_slug_*` plus `backfill_entity_blueprint_v1` (2026-02-17) normalize legacy rows; use `apps/core-svc/scripts/check_entity_columns.py` to audit coverage.

### Master Admin Operations
- Master admins are defined by `MASTER_ADMIN_USER_IDS` (comma-separated backend UUIDs).
- UI: `/admin/entities` (list + archive) and `/admin/manage-access` (grant roles).
- API: `/admin/master/*` endpoints; archiving writes to `entity_archive` before deleting the entity (CASCADE).

### Migration + Backfill Notes
- `add_entity_slug_to_tables_v1` and `add_entity_slug_remaining_v1` add `entity_slug` across entity-scoped tables.
- `add_entity_slug_after_fix_v1` completes slug columns after missing `entity_id` fixes.
- `backfill_entity_blueprint_v1` (2026-02-17) backfills NULL `entity_id`/`entity_slug` to the Blueprint entity (`blueprint-limited`).
- Use `apps/core-svc/scripts/check_entity_columns.py` to audit coverage and `docs/ENTITY_ID_BACKFILL.md` for manual remediation steps.

---

## Governance Process Flow

LeadAI governance runs as a continuous, auditable pipeline. Regulations flow in, governance controls and KPIs are derived, evidence is captured, verified, and scored, and the cycle repeats on a schedule.

```mermaid
flowchart TB
  subgraph Regulatory_Funnel["Regulatory Funnel"]
    R1[EU AI Act clauses]
    R2[ISO/IEC 42001 controls]
    R3[NIST AI RMF practices]
    R1 --> F1[Funnel: normalize + map]
    R2 --> F1
    R3 --> F1
  end

  F1 --> P1[Policy + Guardrail engine]
  P1 --> K1[KPI & metric selection]
  K1 --> E1[Evidence requirements]
  E1 --> C1[Evidence capture<br/>manual + automated]
  C1 --> V1[Evidence Vault]

  V1 --> A1[Internal Control & Audit<br/>AI-assisted human review]
  A1 -->|Accepted| AR1[Verified artifacts]
  A1 -->|Rejected/Challenged| C1

  AR1 --> S1[Scorecard & Trust computation]
  S1 --> D1[Dashboards + Executive reports]
  D1 --> M1[Monitoring / scheduled reviews]
  M1 --> K1
```

### How the stages map to LeadAI modules

1. **Regulatory funnel**  
   Regulations and clauses (EU AI Act, ISO/IEC 42001, NIST AI RMF) are structured into a unified governance baseline.

2. **Policy + guardrails**  
   Policies define required controls, guardrails, and gating rules. These decide which KPIs must be monitored.

3. **KPI definition**  
   KPIs are derived per project and control domain (risk, transparency, human oversight, data, security, etc.).

4. **Evidence requirements & capture**  
   For each KPI, evidence requirements are defined. Evidence is captured manually or by integration pipelines.

5. **Evidence Vault**  
   Evidence is stored, versioned, and tracked. The vault is the system of record for audit readiness.

6. **Internal control & audit**  
   Evidence is reviewed (AI-assisted human control). Items are accepted, rejected, or challenged.

7. **Artifacts & scoring**  
   Accepted evidence becomes governance artifacts, feeding the trust scorecard and maturity scoring.

8. **Monitoring & recursion**  
   The entire workflow is recursive: KPIs and evidence are re‑evaluated on schedule, and dashboards + executive reports are updated.

### Executive reporting

Executive outputs are generated in two ways:
- **Template report** (deterministic, compliance-first).
- **AI report** (LLM-assisted narrative with citations where applicable).

Both formats are published on the governance dashboard and exported as PDFs for C-level and board reporting.

---

## Docker Quickstart (All services)

Run the full stack in Docker:

```powershell
docker compose up --build
```

Open:
- Web UI: http://localhost:3000
- MCP HTTP: http://localhost:8787
- Core API: http://localhost:8001
- Reg service: http://localhost:8002
- Cert service: http://localhost:8003
- LeadAI chatbot adapter: http://localhost:8005/docs
- Mock Jira: http://localhost:18080
- Langfuse UI: http://localhost:4000

Document ingestion expects files under `./data` (mounted to `/data` in the MCP container).
For MCP ingestion, ensure document paths are under `ALLOW_DIRS` (Docker default: `/data`).

---

## Prerequisites

### Docker-only

- **Docker Desktop** with WSL2 backend enabled.
- **Git LFS** if you need to sync binary docs that the chatbot references.
- Optional: Qdrant CLI tools for advanced management.
- No local Node/Python/Ollama required when using Docker Compose.

### On-host development (scripts/onhost/*)

- **Windows 11 / PowerShell 7** (scripts target PowerShell; Windows Terminal optional).
- **Docker Desktop** with WSL2 backend enabled.
- **Node.js 20+** and `pnpm` (run `corepack enable` after installing Node).
- **Python 3.11+** with `uv`/`pip` for the FastAPI service virtual environment.
- **Ollama** installed locally (`ollama serve` should listen on `localhost:11434`).
- **Git LFS** if you need to sync binary docs that the chatbot references.
- Optional: Qdrant CLI tools for advanced management.

> Tip: Run `scripts/onhost/pre_startup.ps1` after installing prerequisites - it checks Docker, volumes, Ollama, and required ports.

## Local Infrastructure

### Option A – Docker Compose

The repo ships with `docker-compose.yml` that provisions:

```yaml
postgres: postgres://leadai:leadai@localhost:5432/leadai
redis:    redis://localhost:6379
minio:    http://localhost:9000 (console on 9001)
qdrant:   http://localhost:6333
```

Start them with:

```powershell
docker compose up -d postgres redis minio qdrant
```

### Option B – PowerShell Orchestration

Use `scripts\onhost\start_all.ps1` for a complete bring-up:

1. Ensures Docker Desktop is running.
2. Creates persistent volume `qdrant-storage`.
3. Starts/rehydrates Docker containers:
   - `qdrant_instance` (HTTP 6333, gRPC 6334).
   - `leadai_pg` (Postgres, optional toggle `-SkipPostgres`).
4. Launches Ollama if needed.
5. Opens dedicated terminals for:
   - FastAPI core service (`uvicorn` on :8001).
   - MCP server (`pnpm --filter ./apps/mcp dev` on :8787).
   - Next.js web (`pnpm --filter ./apps/web dev` on :3000).

Shut everything down with `scripts\onhost\stop_all.ps1`.

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

Configuration relies on `DATABASE_URL` (set automatically by `scripts/onhost/start_all.ps1`). The service exposes `/healthz`.

Provenance evaluation is integrated into the scorecard flow:
- `POST /scorecard/{project_slug}` accepts optional `manifest_facts` for rule-based provenance.
- `GET /scorecard/{project_slug}` returns additive `provenance` fields plus `provenance_score_pct`.
- `POST /trust/provenance/evaluate` supports ad-hoc evaluation during development.

### MCP Server

```powershell
cd apps/mcp
pnpm install
pnpm dev              # http://localhost:8787
```

By default, the server uses `PORT=8787`, `OLLAMA_URL=http://localhost:11434`, `QDRANT_URL=http://localhost:6333`, `CHAT_MODEL=llama3.1:8b`, `EMB_MODEL=nomic-embed-text`, and `ALLOW_DIRS=C:/data;/data`.

Endpoints follow MCP tool semantics: `POST /tools/ingest.scan`, `POST /tools/ingest.upsert`, `POST /tools/retriever.search`, `POST /tools/chat.answer`, `POST /tools/trust.evaluate`, `POST /tools/audit.event`, `GET /tools/admin.status`.

The MCP service also exposes a Trust evaluation tool:
- `POST /tools/trust.evaluate` evaluates manifest facts. If `TRUST_CORE_URL` is set, it calls core-svc for the real YAML rules; otherwise it falls back to a stubbed evaluator for wiring tests.

### Web App (Next.js)

```powershell
cd apps/web
pnpm install
pnpm dev --port 3000
```

Key routes (entity-scoped, preferred):

- `/{entitySlug}/scorecard/{projectId}/dashboard` - Trust dashboard + KPI heatmap + policy alerts.
- `/{entitySlug}/scorecard/admin/governance-setup` - Governance Setup (AIMS Scope, Project Register, AI System Register, Requirements, Control Register, Policy Register).
- `/{entitySlug}/scorecard/admin/governance-execution` - Project execution entry point.
- `/{entitySlug}/scorecard/admin/control-audit` - Control & Audit (Trust Monitoring, Evidence Vault, Audit Log).
- `/{entitySlug}/scorecard/admin/data-register` - Data Sources, Data Classification, Retention & Deletion.
- `/{entitySlug}/scorecard/admin/knowledge-vault` - Knowledge Vault (KPI list, EU AI Act, ISO 42001).
- `/{entitySlug}/scorecard/admin/governance-dashboard-reporting` - Executive governance reporting.
- `/{entitySlug}/admin/reportschedule` - Entity-scoped report scheduling (see `/admin/kpischedule` and `/admin/provenanceschedule` for related flows).

Key routes (global/legacy):

- `/` - landing page.
- `/chat` - redirects to `/leadai-chatbot`.
- `/leadai-chatbot` - chatbot page (Dify iframe based on `DIFY_WEBAPP_ORIGIN`/`DIFY_WEBAPP_PATH`).
- `/health` - diagnostics page for web/core/mcp/qdrant/ollama/minio/langfuse + tcp checks (redis/postgres) + pgvector status.
- `/register` - passwordless sign-in (one-time code).
- `/projects/register` - project registration (legacy; entity-scoped version lives at `/{entitySlug}/projects/register`).
- `/scorecard/...` - legacy scorecard/admin routes kept for compatibility; prefer entity-scoped URLs for new work.
- `/admin/entities` - master admin entity list + archive.
- `/admin/manage-access` - master admin user-entity access management.
- `/admin/email-settings` and `/{entitySlug}/admin/email-settings` - encrypted SMTP settings management.

Set web env vars as needed (`CORE_SVC_URL`, `MCP_SERVER_URL`, `AUTH_*`, email settings, Dify/chatbot URLs) before starting in non-Docker setups.

## Authentication (Passwordless)

The web app uses **NextAuth v5** with **EmailProvider** and **Prisma Adapter**:

- One-time **6-digit code** is sent by email (link scanning safe).
- Auth data is stored in Postgres **auth schema**.
- Migrations are managed by **Alembic** (core-svc), not Prisma.
- `user_mapping` links NextAuth users (`auth."User"`) to backend UUIDs used throughout core-svc.
- `user_entity_access` grants per-entity roles (`admin`, `editor`, `viewer`); master admins are set via `MASTER_ADMIN_USER_IDS`.

Key files:
- `apps/web/src/auth.ts`
- `apps/core-svc/alembic/versions/*_add_auth_schema_nextauth.py`

### Email (SMTP)

We recommend **Resend SMTP** for reliable delivery:

```
EMAIL_SERVER=smtp://resend:YOUR_RESEND_API_KEY@smtp.resend.com:587
EMAIL_FROM=LeadAI <contact@theleadai.co.uk>
```

Set `AUTH_URL` to the public base URL (e.g., `https://dev.theleadai.co.uk`) so verification codes are tied to the correct origin.

## Internationalization

The UI uses **next-intl** with `en` and `tr` locales:

- Language selector is shown in the top-right.
- Locale is stored in cookies.
- Admin sidebar and key dashboards are translated.

## Project Translations

Dynamic project fields can be localized via **project translations**:

Table: `project_translations (project_id, locale, name, risk_level, priority, sponsor, owner, ...)`

Behavior:
- When `locale=tr`, `/projects?locale=tr` returns translated fields.
- Fallback to base project values if a translation is missing.

Admin UI:
- Open `/projects/register`
- Use **Project Translations** section to edit localized fields.

API endpoints:
- `GET /projects?locale=tr`
- `GET /projects/{slug}/translations`
- `GET /projects/{slug}/translations/{locale}`
- `PUT /projects/{slug}/translations/{locale}`
- `DELETE /projects/{slug}/translations/{locale}`

## LLM Reports (Ollama or OpenAI)

The core service can generate an **LLM-based executive report**:

- Endpoint: `GET /admin/ai-reports/projects/{slug}/ai-summary-llm`
- Health: `GET /health/llm`

### Provider switching

Set the provider in the root `.env` (same folder as `docker-compose.yml`):

```
LLM_PROVIDER=ollama   # or openai, anthropic, google
```

**Ollama (local, Metal on macOS)**:

```
OLLAMA_URL=http://host.docker.internal:11434
OLLAMA_MODEL=llama3.1:8b
```

**OpenAI** (or Azure / any OpenAI-compatible API via `OPENAI_BASE_URL`):

```
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-4o-mini
OPENAI_BASE_URL=https://api.openai.com/v1
```

**Anthropic (Claude)**:

```
ANTHROPIC_API_KEY=your_key_here
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
```

**Google (Gemini)**:

```
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-2.0-flash
GOOGLE_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
```

**Optional fallback (when Ollama is down)**:

```
LLM_FALLBACK_PROVIDER=openai
```

After changing env vars, recreate core-svc:

```
docker compose up -d --force-recreate core-svc
```

## Docker build note (web)

The web Dockerfile uses a prepacked `tools/web-node-modules.tgz` to speed builds.  
If dependencies change, regenerate it:

```sh
docker run --rm \
  -v $PWD:/repo \
  -w /tmp \
  node:20-alpine sh -lc '
    apk add --no-cache libc6-compat;
    corepack enable;
    mkdir -p /tmp/web;
    cp /repo/apps/web/package.json /repo/apps/web/pnpm-lock.yaml /repo/apps/web/pnpm-workspace.yaml /tmp/web/;
    cp -R /repo/apps/web/prisma /tmp/web/;
    cd /tmp/web;
    pnpm install --frozen-lockfile;
    pnpm prisma generate;
    tar -czf /repo/tools/web-node-modules.tgz node_modules;
  '
```

---

## Using the MCP AI Chatbot

1. **Prepare source documents**: place documents under directories allowed by `ALLOW_DIRS` (Docker default `/data`).
2. **Ingest via MCP**:
   - Scan directories: `POST /tools/ingest.scan`.
   - Upsert documents: `POST /tools/ingest.upsert`.
   - Search chunks: `POST /tools/retriever.search`.
3. **Chat**:
   - Visit `http://localhost:3000/leadai-chatbot` (or `/chat` redirect) and ask questions.
   - MCP answers include citations referencing `/resources/chunk/{docHash}/{chunkId}`.
4. **External MCP clients**:
   - Point them to `http://localhost:8787`.
   - Tools: `ingest.scan`, `ingest.upsert`, `retriever.search`, `chat.answer`, `trust.evaluate`, `audit.event`, `admin.status`.
   - Resources: `/resources/doc/{encodedAbsolutePath}`, `/resources/chunk/{docHash}/{chunkId}`.

See `docs/mcp-chatbot-setup.md` for end-to-end instructions, including recommended Ollama models and heuristics for chunking.

---

## Langfuse Integration

LeadAI can pull **Langfuse** metrics + prompt versions into Model Cards.

### Where it shows up
- **Model Cards UI**: `/{entitySlug}/scorecard/admin/governance-execution/model-cards`
  - **Metrics Summary** (latency, tokens, requests)
  - **Prompt Versions** (Langfuse prompt registry)

### Required environment variables (core-svc)
Use the Docker service name from inside containers:
- `LANGFUSE_BASE_URL=http://langfuse-web:3000`
- `LANGFUSE_PUBLIC_KEY=<public>`
- `LANGFUSE_SECRET_KEY=<secret>`

Optional prompt registry settings:
- `LANGFUSE_PROMPT_AI_SUMMARY_LLM=<prompt_key>`
- `LANGFUSE_PROMPT_AI_SUMMARY_LLM_LABEL=production`
- `LANGFUSE_PROMPT_AI_SUMMARY_LLM_VERSION=<explicit_version>`

### Syncing Langfuse metrics
From the UI, each AI system can call:
- `POST /admin/model-cards/{system_id}/sync-langfuse`

### Org / Project bootstrap script
We ship a helper script to create Langfuse orgs/projects from LeadAI entities/projects:

```sh
docker compose exec \
  -e DATABASE_URL="postgresql+psycopg://leadai:leadai@postgres:5432/leadai" \
  -e LANGFUSE_BASE_URL="http://langfuse-web:3000" \
  -e LANGFUSE_ADMIN_TOKEN="<ADMIN_TOKEN>" \
  core-svc python /app/scripts/langfuse_sync_org_projects.py
```

Optional: write Langfuse project IDs back into `ai_system_registry`:

```sh
... -e WRITE_IDS=1 ...
```

---

## Multi-Agent Development System

This project includes a multi-agent development system for Cursor IDE that provides specialized AI agents for different aspects of software development.

### Available Agents

1. **🎯 The Coordinator** (Agent B - Claude 3.5 Sonnet)
   - Workflow orchestration and task planning
   - Best for: Planning multi-agent workflows and breaking down complex tasks
   - Trigger: "Act as The Coordinator"

2. **🛠️ The Coder** (Agent A - Llama 3.1:8b)
   - Fast code generation and implementation
   - Best for: Writing new features quickly
   - Trigger: "Act as The Coder"

3. **🧹 The Cleaner** (Agent B - Claude 3.5 Sonnet)
   - Code refactoring and optimization
   - Best for: Making code Pythonic and M1-optimized
   - Trigger: "Act as The Cleaner"

4. **✅ The Verifier** (Agent B - Claude 3.5 Sonnet)
   - Testing and quality assurance
   - Best for: Writing comprehensive tests
   - Trigger: "Act as The Verifier"

5. **🇪🇺 The EU Compliance Agent** (Agent A - Llama 3.1:8b)
   - EU AI Act compliance auditing
   - Best for: Auditing AI systems for EU AI Act compliance
   - Trigger: "Act as The EU Compliance Agent"
   - Test File: `apps/core-svc/tests/test_eu_compliance_agent.py`

6. **🔍 The Detective** (Agent B - Claude 3.5 Sonnet)
   - Debugging and root cause analysis
   - Best for: Investigating errors and bugs
   - Trigger: "Act as The Detective"

### Quick Start

```bash
# List available agents
python .cursor/agent_coordinator.py list

# View agent documentation
cat .cursor/AGENTS.md

# Quick reference
cat .cursor/QUICK_REFERENCE.md
```

### Usage Example

```
1. "Act as The Coordinator - plan a workflow for implementing user authentication"
2. Follow the Coordinator's plan:
   - "Act as The Coder - implement user authentication endpoint"
   - "Act as The Cleaner - refactor this to be more Pythonic"
   - "Act as The Verifier - write tests for this endpoint"
   - "Act as The EU Compliance Agent - audit this system for EU AI Act compliance"
   - "Act as The Detective - investigate why tests are failing"
```

### Documentation

- **Full Guide**: `.cursor/AGENTS.md` - Complete agent documentation
- **Workflow Guide**: `.cursor/AGENT_WORKFLOW.md` - Detailed workflow patterns
- **Quick Reference**: `.cursor/QUICK_REFERENCE.md` - Command cheat sheet
- **Agent Rules**: `.cursor/rules/agent-*.mdc` - Cursor rule definitions

### Model Configuration

- **Agent A (Llama 3.1:8b)**: Local Ollama instance (fast, local development)
- **Agent B (Claude 3.5 Sonnet)**: Cursor's default model (thorough, high quality)

Note: Cursor doesn't support simultaneous multi-agent execution. Switch between agents by explicitly mentioning the agent role in your conversation.

---

## Scripts & Automation

- `scripts/onhost/pre_startup.ps1`: Verifies Docker, Ollama, Qdrant volumes, and lists blocking issues before launch.
- `scripts/onhost/start_all.ps1`: One-stop orchestration for infrastructure + app processes (described above).
- `scripts/onhost/stop_all.ps1`: Stops Docker containers (`leadai_pg`, `qdrant_instance`, etc.) and closes spawned terminals.
- `scripts/backup/*.ps1`: Utilities for exporting/importing database snapshots (add your scripts here).

Run scripts from the repo root (`C:\apps\_TheLeadAI`) with PowerShell.

---

## Web GUI Smoke Testing (Playwright)

We maintain smoke tests for both unauthenticated and authenticated GUI flows, including Cloudflare Access configuration and dev test bypass setup.  
See `docs/GUI_TESTING.md` for full instructions, prerequisites, configuration, and expected outcomes.

---

## Environment Variables

| Variable | Component | Default | Notes |
|----------|-----------|---------|-------|
| `DATABASE_URL` | Core API | `postgresql+psycopg://...` | Main core-svc DSN (Docker default points to `postgres`). |
| `AUTH_DATABASE_URL` | Web | `postgresql://.../leadai?schema=auth` | NextAuth Prisma adapter schema. |
| `AUTH_URL` | Web/Core API | `http://localhost:3000` | Public app URL for auth/callback flows. |
| `AUTH_SECRET` | Web | `dev-secret-change-me` | Change for non-dev deployments. |
| `EMAIL_SERVER` | Web / Core API | *(empty)* | SMTP URL for passwordless auth and control reminder/assignment emails. |
| `EMAIL_FROM` | Web / Core API | `LeadAI <no-reply@localhost>` | Sender address. |
| `SMTP_SETTINGS_ENCRYPTION_KEY` | Core API | *(empty)* | Required to persist encrypted SMTP settings via admin UI/API. |
| `APP_BASE_URL` | Core API | *(empty)* | Base URL used in generated links (email/workflows). |
| `QDRANT_URL` | MCP/Web | `http://localhost:6333` | Qdrant REST endpoint. |
| `QDRANT_COLLECTION` | MCP | `leadai_docs` | Created lazily on first ingest. |
| `OLLAMA_URL` | Core API/MCP/Web | `http://host.docker.internal:11434` (Docker) / `http://localhost:11434` (on-host) | Ollama base URL for chat/report generation. |
| `OLLAMA_MODEL` | Core API/Web | `llama3.1:8b` | Report-generation/chat model for core/web paths. |
| `CHAT_MODEL` | MCP | `llama3.1:8b` | MCP chat model used by `/tools/chat.answer`. |
| `EMB_MODEL` | MCP | `nomic-embed-text` | MCP embedding model used for ingest/search. |
| `ALLOW_DIRS` | MCP | `C:/data;/data` | Semicolon/comma-delimited allowed absolute roots for ingestion/resource access. |
| `CORE_SVC_URL` | Web/Other services | `http://core-svc:8001` (Docker) | Server-side core proxy base. |
| `REG_SVC_URL` | Web | `http://reg-svc:8002` (Docker) | Server-side reg-svc proxy base. |
| `CERT_SVC_URL` | Web | `http://cert-svc:8003` (Docker) | Server-side cert-svc proxy base. |
| `MCP_SERVER_URL` | Web | `http://mcp:8787` (Docker) | Server-side MCP proxy base. |
| `NEXT_PUBLIC_CORE_SVC_URL` | Web | `http://localhost:8001` | Client fallback base for core-svc. |
| `NEXT_PUBLIC_MCP_SERVER_URL` | Web | `http://localhost:8787` | Client-side MCP base URL. |
| `INTERNAL_APP_URL` | Web | `http://localhost:3000` | Server-side self-fetch base URL. |
| `DIFY_WEBAPP_ORIGIN` | Web | `http://host.docker.internal:8080` | Base URL for embedded Dify app (`/leadai-chatbot`). |
| `DIFY_WEBAPP_PATH` | Web | `/apps` | Dify path (can be full URL). |
| `DIFY_HEALTH_URL` | Web | `http://host.docker.internal:8080/apps` | Optional explicit health URL for Dify probe. |
| `LEADAI_CHATBOT_ADAPTER_URL` | Web | `http://leadai-chatbot:8000` | Backend adapter for retrieval route checks. |
| `LEADAI_NAV_MODE` | Web | `legacy` | Navigation mode toggle (`legacy` or default modern mode). |
| `MASTER_ADMIN_USER_IDS` | Core API | *(empty)* | Comma-separated backend UUIDs with master admin access. |
| `LLM_PROVIDER` | Core API | `ollama` | `ollama`, `openai`, `anthropic`, or `google` (LLM report endpoint). |
| `OPENAI_API_KEY` | Core API | *(required for openai)* | API key when `LLM_PROVIDER=openai`. |
| `OPENAI_MODEL` | Core API | `gpt-4o-mini` | OpenAI model for LLM reports. |
| `OPENAI_BASE_URL` | Core API | `https://api.openai.com/v1` | OpenAI-compatible API base URL. |
| `ANTHROPIC_API_KEY` | Core API | *(required for anthropic)* | API key when `LLM_PROVIDER=anthropic`. |
| `ANTHROPIC_MODEL` | Core API | `claude-3-5-sonnet-20241022` | Anthropic model for reports. |
| `ANTHROPIC_BASE_URL` | Core API | `https://api.anthropic.com` | Anthropic-compatible base URL override. |
| `GEMINI_API_KEY` / `GOOGLE_API_KEY` | Core API | *(required for google)* | API key when `LLM_PROVIDER=google`. |
| `GEMINI_MODEL` / `GOOGLE_MODEL` | Core API | `gemini-2.0-flash` | Google Gemini model for reports. |
| `GOOGLE_BASE_URL` | Core API | `https://generativelanguage.googleapis.com/v1beta/openai` | Gemini OpenAI-compatible base URL. |
| `SERPER_API_KEY` | Core API | *(empty)* | Required for `/entity/profile-from-url` search stage. |
| `FIRECRAWL_API_KEY` | Core API | *(empty)* | Optional crawler enrichment for entity profiling. |
| `LLM_FALLBACK_PROVIDER` | Core API | *(empty)* | Optional fallback provider if primary fails. |
| `LLM_REPORT_CACHE_TTL_HOURS` | Core API | `24` | LLM report cache TTL in hours. |
| `LANGFUSE_BASE_URL` | Core API | `http://langfuse-web:3000` | Base URL for Langfuse API (use Docker service name internally). |
| `LANGFUSE_PUBLIC_KEY` | Core API | *(required)* | Langfuse public key. |
| `LANGFUSE_SECRET_KEY` | Core API | *(required)* | Langfuse secret key. |
| `LANGFUSE_PROMPT_AI_SUMMARY_LLM` | Core API | *(optional)* | Prompt key used by the Model Cards prompt viewer. |
| `LANGFUSE_PROMPT_AI_SUMMARY_LLM_LABEL` | Core API | `production` | Prompt label for prompt registry lookups. |
| `LANGFUSE_PROMPT_AI_SUMMARY_LLM_VERSION` | Core API | *(optional)* | Force a specific prompt version. |
| `LANGFUSE_PROMPT_CACHE_TTL` | Core API | *(empty)* | Optional Langfuse prompt cache TTL (seconds). |
| `TRUST_EVAL_MODE` | Core API | `local` | `local` uses in-process rules; `mcp` calls MCP tool. |
| `TRUST_MCP_URL` | Core API | *(empty)* | Base URL for MCP trust service (e.g., `http://mcp:8787`). |
| `TRUST_MCP_TOOL` | Core API | `trust.evaluate` | Tool name under `/tools/{tool}`. |
| `TRUST_EVAL_FALLBACK` | Core API | `local` | Fallback to local evaluation if MCP fails. |
| `TRUST_MCP_TIMEOUT` | Core API | `10` | MCP HTTP timeout (seconds). |
| `TRUST_CORE_URL` | MCP | *(empty)* | Core-svc URL used by MCP for real trust rules (else stub fallback). |
| `TEST_BYPASS_ENABLED` | Core API | `0` | Set `1` to allow dev auth bypass (requires `TEST_BYPASS_USER_ID`). |
| `TEST_BYPASS_USER_ID` | Core API | *(empty)* | Backend UUID used when `TEST_BYPASS_ENABLED=1`. |
| `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` | Docker | `minioadmin` | Change for production. |
| `DATA_GOVERNANCE_SCHEDULER` | Core API | `on` | Toggles nightly data governance checks. |
| `DATA_GOVERNANCE_DAILY_HOUR` | Core API | `2` | UTC hour for nightly checks (0-23). |
| `LLM_REPORT_BATCH_SCHEDULER` | Core API | `on` | Enables scheduled LLM report generation. |
| `LLM_REPORT_BATCH_DAILY_HOUR` | Core API | `3` | UTC hour for report batch scheduler. |
| `KPI_RECOMPUTE_BATCH_SCHEDULER` | Core API | `on` | Enables scheduled KPI recompute for all projects. |
| `KPI_RECOMPUTE_DAILY_HOUR` | Core API | `3` | UTC hour for KPI recompute scheduler. |
| `PROVENANCE_MANIFEST_BATCH_SCHEDULER` | Core API | `on` | Enables scheduled provenance manifest batch jobs. |
| `PROVENANCE_MANIFEST_DAILY_HOUR` | Core API | `3` | UTC hour for provenance manifest scheduler. |
| `ALERT_WORKER_INTERVAL_SECONDS` | alert_worker | `300` | Policy alert refresh interval (seconds). |
| `ALERT_WORKER_REFRESH_GOVERNANCE` | alert_worker | `true` | Refreshes governance warnings before policy alert evaluation. |
| `ALERT_WORKER_CONTROL_REMINDERS` | alert_worker | `true` | Set to `false`/`off` to disable control reminders. |
| `LEADAI_CHATBOT_*` | leadai-chatbot | see `.env.example` | Adapter/retrieval settings (MCP URL, pgvector, PII, OpenAI model, limits). |
| `PII_WORKER_*` | pii-regex-worker | see `.env.example` | Worker cadence, file filters, cache path, and audit metadata. |

Store secrets outside version control (e.g., `.env`, Windows Credential Manager, or Azure Key Vault).

---

## Troubleshooting

- **Qdrant connection errors**: confirm container is running (`docker ps`), ports 6333/6334 are free, and `QDRANT_URL` matches.
- **Embedding dimension mismatch**: ensure MCP `EMB_MODEL` matches the model you pulled (default `nomic-embed-text`, 768 dims).
- **MinIO access denied**: log into the console at `http://localhost:9001` using `minioadmin/minioadmin` (or your overridden values), create the bucket expected by the app, and regenerate credentials.
- **Postgres schema migrations**: run Alembic migrations from `apps/core-svc/alembic` after adjusting the database URL.
- **Provenance tables missing**: run `docker compose exec core-svc alembic -c /app/alembic.ini upgrade head`.
- **Entity-scoped data missing**: check for NULL `entity_id`/`entity_slug` values; see `docs/ENTITY_ID_BACKFILL.md` and the `backfill_entity_blueprint_v1` migration (2026-02-17).
- **Ports already in use**: re-run `scripts/onhost/pre_startup.ps1` to identify conflicts; supply `-SkipPostgres` if using an external DB.
- **Chatbot missing documents**: confirm files are under `ALLOW_DIRS` and use supported ingest formats (`.pdf`, `.docx`, `.xlsx`). Re-run `ingest.scan` + `ingest.upsert`, then check `/tools/admin.status`.

---

## Reference Docs

- `apps/core-svc/docs/provenance_scoring.md` - Provenance rules, gates, and manifest facts contract.
- `docs/mcp-chatbot-setup.md` – Detailed MCP + Qdrant + Ollama configuration.
- `docs/ENTITY_ID_BACKFILL.md` – Backfilling NULL `entity_id`/`entity_slug` after migration.
- `docs/MULTI_ENTITY_TABLES.md` – Multi-entity table coverage and slug readiness.
- `docs/ENTITY_SLUG_URL_ROUTING.md` – Entity slug routing guide for Next.js pages.
- `docs/ENTITY_SLUG_EXPLANATION.md` – Why entity slugs exist and how they map to entities.
- `docs/ENTITY_SLUG_FAQ.md` – Common questions and edge cases for slug routing.
- `docs/GRANT_ENTITY_ACCESS.md` – Granting entity access and assigning roles.
- `docs/USER_ENTITY_ACCESS.md` – User creation + entity access workflows.
- `docs/LeadAI_dev/` – Product specifications, UI flows, and draft content.
- `scripts/` – Windows automation for local development.
- `apps/core-svc/alembic/` – Database migration history.

> This README replaces the previous ODT-based document to ensure Markdown renders correctly on GitHub and in editors.

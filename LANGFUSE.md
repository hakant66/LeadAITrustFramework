# Langfuse Integration (LeadAI)

This document explains how Langfuse is used in LeadAI, what is required to run it, and which APIs are involved.

---

## What It Does

LeadAI uses Langfuse for:
- **Observability**: latency + token metrics pulled into Model Cards.
- **Prompt Registry**: shows prompt versions in the Model Cards UI.
- **Tracing**: optional logging of LLM generations (best-effort, non-blocking).

---

## Technical Stack

Langfuse runs as a separate stack (Docker):
- `langfuse-web`
- `langfuse-worker`
- `langfuse-redis`
- `langfuse-clickhouse`

LeadAI services that integrate:
- **core-svc** (FastAPI): reads metrics + prompt versions, writes model card evidence.
- **web** (Next.js): renders metrics + prompt version cards.

---

## Requirements

1. **Langfuse running**
   - Docker: `langfuse-web` should be reachable from `core-svc`.
2. **Credentials in core-svc**
   - `LANGFUSE_PUBLIC_KEY`
   - `LANGFUSE_SECRET_KEY`
   - `LANGFUSE_BASE_URL`
3. **Per AI system configuration**
   - `ai_system_registry.langfuse_project_id`
   - `ai_system_registry.langfuse_base_url` (defaults to `LANGFUSE_BASE_URL` if left blank in UI)

Important: inside Docker, use `http://langfuse-web:3000` (not `http://localhost:4000`).

---

## Environment Variables

Required (core-svc):
- `LANGFUSE_BASE_URL=http://langfuse-web:3000`
- `LANGFUSE_PUBLIC_KEY=<public>`
- `LANGFUSE_SECRET_KEY=<secret>`

Prompt registry (optional):
- `LANGFUSE_PROMPT_AI_SUMMARY_LLM=<prompt_key>`
- `LANGFUSE_PROMPT_AI_SUMMARY_LLM_LABEL=production`
- `LANGFUSE_PROMPT_AI_SUMMARY_LLM_VERSION=<explicit_version>`
- `LANGFUSE_PROMPT_CACHE_TTL=<seconds>`

---

## LeadAI Data Flow

### 1) Metrics into Model Cards
- UI calls: `POST /admin/model-cards/{system_id}/sync-langfuse`
- core-svc:
  - Reads `langfuse_project_id` + `langfuse_base_url`
  - Uses `LangfuseAdapter.fetch_project_metrics()`
  - Writes into `model_card_evidence` with `source="langfuse"`

Metrics stored:
- `latency_avg_ms`
- `latency_p95_ms`
- `requests_count`
- `tokens_total`
- `tokens_input`
- `tokens_output`

### 2) Prompt Versions
Model Cards UI requests:
- `GET /admin/langfuse/prompts/{prompt_key}/versions`

The prompt key is resolved from env:
```
LANGFUSE_PROMPT_<KEY>
```

### 3) Tracing (optional)
LeadAI can log LLM generations via:
- `app/services/langfuse_tracing.py`
```
log_llm_generation(trace_name, model, provider, prompt, output, usage, metadata)
```
This is best-effort; failures are ignored.

---

## Langfuse API Usage

### LeadAI (core-svc) using Langfuse SDK
The integration relies on the official `langfuse` Python SDK.

### Bootstrap Script
Script: `apps/core-svc/scripts/langfuse_sync_org_projects.py`
- Pulls `entity.slug` + `entity_projects.slug` from Postgres.
- Creates Langfuse orgs + projects if missing.
- Writes a CSV mapping: `{entity_slug, project_slug, langfuse_project_id}`.
- Optional: `WRITE_IDS=1` updates `ai_system_registry.langfuse_project_id`.

Required env for the script:
- `DATABASE_URL`
- `LANGFUSE_BASE_URL`
- `LANGFUSE_ADMIN_TOKEN`

Example:
```sh
docker compose exec \
  -e DATABASE_URL="postgresql+psycopg://leadai:leadai@postgres:5432/leadai" \
  -e LANGFUSE_BASE_URL="http://langfuse-web:3000" \
  -e LANGFUSE_ADMIN_TOKEN="<ADMIN_TOKEN>" \
  core-svc python /app/scripts/langfuse_sync_org_projects.py
```

### Langfuse REST Endpoints (used by the script)
- `GET /api/admin/organizations`
- `POST /api/admin/organizations`
- `POST /api/admin/organizations/{orgId}/apiKeys`
- `GET /api/public/projects`
- `POST /api/public/projects`
- `GET /api/public/health`

---

## UI Location

Model Cards live under:
```
/{entitySlug}/scorecard/admin/governance-execution/model-cards
```

UI shows:
- Metrics Summary (from Langfuse evidence)
- Prompt Versions (from Langfuse prompt registry)

---

## Prompt Compilation (compile + variables)

`app/services/langfuse_prompts.py` supports:
- `compile()` if the Langfuse prompt supports it
- fallback replacements for `$var` and `{{var}}`

Usage pattern:
```py
get_langfuse_prompt_optional(
  "ai_summary_llm",
  variables={"entity_name": "LeadAI", "project_name": "Chatbot"}
)
```

---

## Troubleshooting

1. **Langfuse not configured**
   - Ensure all three env vars are present in core-svc.
2. **Connection refused**
   - Inside Docker, use `http://langfuse-web:3000`.
3. **Metrics empty**
   - Confirm the system has `langfuse_project_id`.
   - Confirm Langfuse has trace data for that project.
4. **Prompt versions not showing**
   - Ensure `LANGFUSE_PROMPT_AI_SUMMARY_LLM` is set to a valid prompt name.


# LeadAI Trust Framework
## End-to-End Governance Process Presentation (Code-Accurate)

**Version:** 2.0  
**Date:** February 17, 2026  
**Purpose:** Full, implementation-level overview of LeadAI's governance workflow as it runs in the current codebase

---

## Slide 1: Title

# LeadAI Trust Framework
## Automated AI Governance & Compliance Platform

**From Regulations to Evidence, Trust Scores, and Executive Reporting**

---

## Slide 2: Executive Summary (Operational View)

### What the platform does (in code)
- **Entity-scoped governance** with strict `entity_id` isolation and role-based access
- **Regulatory intake** -> requirements -> policies -> KPIs -> controls
- **Evidence workflow** with presigned S3 upload and immutable audit trails
- **Trust scoring** calculated from normalized KPI values and pillar aggregation
- **Provenance evaluation** using YAML rule gates (P0-P3)
- **LLM reporting** with cache + batch scheduler
- **RAG/Knowledge Vault** using Qdrant + Ollama embeddings

---

## Slide 3: System Architecture (Runtime)

```
Browser (Next.js UI)
    |
    | /api/core proxy (injects X-NextAuth-User-ID, X-Entity-ID)
    v
FastAPI core-svc -------------------> Postgres (auth + public)
    |                                    |
    |                                    | entity, entity_projects, control_values, evidence, policies
    |
    +--> MinIO (S3 evidence, report sources)
    +--> Qdrant (Knowledge Vault vectors)
    +--> Redis (queues)

MCP server <----> Qdrant + Ollama
   |
   +--> Chatbot Adapter (leadai-chatbot)
   +--> PII Regex Worker

reg-svc + reg-worker (Celery trust_decay)
alert_worker (policy + governance alert loop)
cert-svc (Trustmark issuance)
```

---

## Slide 4: Multi-Entity Model (Core Boundary)

### Entity Context
- **URL:** `/{entitySlug}/scorecard/...`
- **Headers:** `X-Entity-ID` or `?entity_id=` forwarded via `/api/core`
- **Access Control:** `user_entity_access` (admin/editor/viewer)

### System Admin (Master Admin)
- UI: **"System Admin"** / **"Choose Entity"**; `MASTER_ADMIN_USER_IDS` grants global entity access
- UI: `/admin/entities`, `/admin/manage-access`
- API: `/admin/master/*`

### Data Isolation
- Every tenant-scoped table includes `entity_id` and `entity_slug`
- Backfill migration: `backfill_entity_blueprint_v1` (2026-02-17)

---

## Slide 5: Regulatory Intake (Requirements Source)

### Input Sources
- **EU AI Act** (roles, risk classifications, high-risk obligations)
- **ISO/IEC 42001** (ISMS/AI governance clauses)
- **NIST AI RMF** (govern, map, measure, manage)

### Storage
- `euaiact_requirements`
- `iso42001_requirements`
- `ai_requirement_register`

### UI
- `/{entitySlug}/scorecard/admin/governance-setup/ai-requirements-register`

---

## Slide 6: Policy & KPI Mapping (Requirements -> Controls)

### Policy Register
- Policies are stored in `policies`
- Versions stored in `policy_versions`
- Finalized register stored in `entity_policy_register`

### KPI Generation
- KPI register from `kpis` + `kpi_definition`
- Per-entity overrides via `entity_kpi_overrides`
- Control definitions in `controls` + `entity_control_overrides`

### UI
- `/{entitySlug}/scorecard/admin/governance-setup/ai-kpi-register`
- `/{entitySlug}/scorecard/admin/governance-setup/ai-policy-register`
- `/{entitySlug}/scorecard/admin/governance-setup/control-register`

---

## Slide 7: Project & System Registration

### Projects
- Table: `entity_projects`
- API: `POST /admin/projects`
- UI: `/{entitySlug}/projects/register`

### Systems
- Table: `ai_system_registry`
- API: `POST /admin/ai-systems`
- UI: `/{entitySlug}/scorecard/admin/governance-setup/ai-system-register`

---

## Slide 8: KPI Values & Control Execution

### Control Values (Scoring Input)
- Table: `control_values`
- Stores `raw_value`, `normalized_pct`, `kpi_score`, `owner_role`, `evidence_source`

### Execution Metadata
- Table: `control_values_exec`
- Stores owner, due date, reminders, status, notes

### UI
- `/{entitySlug}/scorecard/{projectId}/dashboard/kpis_admin`
- `/{entitySlug}/scorecard/admin/governance-setup/control-register`

---

## Slide 9: Evidence Pipeline (Exact Flow)

### API Steps
1. **Init** evidence
   - `POST /admin/projects/{project_slug}/controls/{control_id}/evidence:init`
2. **Upload** file to presigned S3 URL
   - `PUT <presigned url>`
3. **Finalize** with hash + metadata
   - `POST /admin/evidence/{evidence_id}:finalize`

### Data
- `evidence` table stores S3 URI, sha256, mime, size
- `evidence_audit` logs created/uploaded/downloaded events

### Storage Path
- `evidence/{entity_id}/{project_slug}/{control_id}/{uuid}-{filename}`

---

## Slide 10: Audit & Monitoring

### Audit Events
- Stored in `audit_events`
- Created by policy changes, KPI recompute, provenance builds, report generation

### Monitoring Views
- Trust decay and drift tracked in
  - `trust_decay_events`
  - `trust_monitoring_signals`

### UI
- `/{entitySlug}/scorecard/admin/control-audit/monitoring/*`

---

## Slide 11: Scorecard Computation (Algorithm)

### Normalization
- `normalized_pct` computed using `controls.norm_min`, `controls.norm_max` and `higher_is_better`
- If bounds missing, clamp raw values into 0-100

### Pillar Aggregation
- KPIs grouped by `controls.pillar`
- `pillar_overrides` replace computed pillars when present

### Overall Score
- Average of pillar scores

### Endpoint
- `GET /scorecard/{project_slug}`
- `POST /scorecard/{project_slug}` (upserts KPI values)

---

## Slide 12: Provenance Evaluation (P0-P3)

### Inputs
- Manifest facts (`provenance_manifest_facts`)
- Evidence and model lineage tables (`provenance_*`)

### Engine
- YAML rule evaluation with gates and reasons
- Output includes overall level, score %, and per-field reasons

### API
- `POST /trust/provenance/evaluate`
- `POST /admin/provenance-manifests/build`

---

## Slide 13: Reporting (Template + LLM)

### Template Reports
- Deterministic PDF generation from KPI + evidence data
- Endpoint: `GET /scorecard/{project_slug}/report?mode=standard`

### LLM Reports
- Endpoint: `GET /admin/ai-reports/projects/{slug}/ai-summary-llm`
- Batch endpoint: `POST /admin/ai-reports/batch-generate`
- Cache: `llm_report_cache` (TTL in hours)

---

## Slide 14: Knowledge Vault + RAG

### Sources
- `report_sources` + `report_source_files`
- Files stored in MinIO and indexed to Qdrant

### Ingest
- `knowledge_vault_ingest.py` extracts text from PDF/DOCX/XLSX/CSV
- Chunks and embeds using Ollama
- Upserts vectors into Qdrant with payload metadata

### MCP Tools
- `ingest.*`, `retriever.search`, `chat.answer`

---

## Slide 15: Schedulers & Workers (Live Ops)

### core-svc schedulers
- `DATA_GOVERNANCE_SCHEDULER`
- `LLM_REPORT_BATCH_SCHEDULER`
- `KPI_RECOMPUTE_BATCH_SCHEDULER`
- `PROVENANCE_MANIFEST_BATCH_SCHEDULER`

### External workers
- `alert_worker` refreshes alerts continuously
- `reg-worker` (Celery) processes `trust_decay` queue

---

## Slide 16: Key Tables (Summary Map)

- **Entity:** `entity`, `user_entity_access`, `user_mapping`
- **Projects:** `entity_projects`, `project_translations`
- **Catalog:** `kpis`, `controls`, `pillars`, overrides
- **Execution:** `control_values`, `control_values_exec`, `pillar_overrides`
- **Evidence:** `evidence`, `evidence_audit`
- **Provenance:** `provenance_*`
- **Reporting:** `llm_report_cache`, `report_sources`

---

## Slide 17: Closing

LeadAI operationalizes AI governance by **connecting regulatory obligations to evidence and trust scoring** while enforcing **strict entity isolation** and **auditability**. The system is designed to run continuously with scheduled recompute and reporting workflows, allowing governance teams to stay aligned with evolving regulations.


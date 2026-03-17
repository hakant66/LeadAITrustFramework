# LeadAI Trust Framework — How It Works

This document explains **each major page**, **batch jobs**, and **reports** in the LeadAI codebase: what they do, which APIs they call, and how data flows from the UI to the database and back.

---

## 1. Overview: Request Flow and Entity Context

### 1.1 Frontend → Backend

- **Web app:** Next.js (App Router) in `apps/web`. All API calls to the core service go through the **`/api/core`** proxy.
- **Proxy:** `apps/web/src/app/api/core/[...slug]/route.ts` forwards requests to `core-svc` and adds:
  - **`X-NextAuth-User-ID`** from the NextAuth session (cuid).
  - **`X-Entity-ID`** or `?entity_id=` when the UI has an entity context.
- **Backend:** FastAPI in `apps/core-svc`. It maps NextAuth user ID to a backend UUID via **`user_mapping`** and checks **`user_entity_access`** for the requested entity (or uses the first accessible entity when none is provided).

### 1.2 URL Modes

- **Entity-scoped (v2):** Routes include `{entitySlug}`: e.g. `/{entitySlug}/scorecard`, `/{entitySlug}/scorecard/admin/governance-setup/entity-setup`. Entity is derived from the URL; backend gets `entity_id` from slug via `/entity/by-slug/{slug}`.
- **Legacy:** Routes like `/scorecard/...` without entity in the path. Entity is taken from header/query or the user’s first entity.
- **Nav mode:** `LEADAI_NAV_MODE=legacy` forces redirects to legacy routes.

### 1.3 Sidebar and Project Context

- **AdminSidebar** (`apps/web/src/app/(components)/AdminSidebar.tsx`) builds navigation from:
  - **Entity slug** (from path when on entity-scoped routes).
  - **Current project** from `GET /projects` and `localStorage` key `leadai.nav.project`.
- **System Admin** section (sidebar label “System Admin” / “Sistem Yöneticisi”) shows “Choose Entity”, Manage Access, **Email Settings**, Master Translation, **Model Providers**, **System Health**, and **AI Report Setup** (Gov. Req., Executive, Board-Level prompts). These routes are not entity-prefixed (e.g. `/admin/entities`, `/admin/email-settings`, `/health`, `/admin/gov-req-report-prompt`).

---

## 2. Entry, Auth, and Onboarding Pages

### 2.1 Registration — `/register`

- **Purpose:** User sign-up/sign-in via NextAuth (email-based, passwordless).
- **Mechanism:** NextAuth creates/updates `auth."User"` and `auth."Account"`. On first API call, core-svc ensures a row in **`user_mapping`** (NextAuth cuid → backend UUID). No direct core-svc “registration” endpoint; auth is handled entirely by NextAuth.

### 2.2 AI Legal Standing — `/ai_legal_standing` or `/{entitySlug}/scorecard/admin/governance-setup/entity-legal-standing`

- **Purpose:** Run the EU AI Act decision tree and capture the entity’s legal/regulatory stance.
- **Frontend:** Collects provider/deployer/importer/distributor, provide-as-is, in-scope AI, prohibited practices, annex III, etc.
- **API:** `POST /ai-legal-standing/assess` with the form payload. Backend uses **`app/services/eu_ai_act_assessment.py`** (`EUAIAssessment`) to compute roles and risk; “provide as is” only adds Provider when the user already has a supplying role (Provider/Importer/Distributor/Product Manufacturer).
- **Outcome:** Returns assessment result (roles, risk class, etc.) and then persists it to entity context:
  - If entity context exists: `PATCH /entity/{id}` saves `primaryRole`, `riskClassification`, `decisionTrace`, and `legalStandingResult`.
  - If no entity context but session has a staged entity profile: `POST /entity` creates entity and saves legal-standing fields.
  - If neither exists: UI shows `Complete the Entity form first, then return here.` and does not persist.

### 2.3 Entity Setup — `/{entitySlug}/scorecard/admin/governance-setup/entity-setup`

- **Purpose:** Create or edit the entity profile (jurisdiction, legal standing, regions, sectors).
- **APIs:**
  - Load: `GET /entity/by-slug/{slug}` or `GET /entity/latest` if no slug yet.
  - Save: `PATCH /entity/{id}`.
- **Backend:** `app/routers/entity.py`. Reads/writes **`entity`**, **`entity_country`**, **`entity_region`**, **`entity_sector`**, **`entity_primary_role`**, **`entity_risk_class`**, **`entity_archive`**, and optional **`entity_translations`**. Slug is generated if missing and returned so the URL can be updated.
- **Read-only in UI:** Primary role, risk classification, decision trace (from legal standing).

---

## 3. Governance Setup Pages (Entity-Scoped)

All under `/{entitySlug}/scorecard/admin/governance-setup/`. The **Governance Journey** card on the setup landing page reflects whether projects, AI systems, requirements, controls, and policies exist for the entity.

### 3.1 Setup Landing — `/{entitySlug}/scorecard/admin/governance-setup`

- **Purpose:** 6-step journey (legal standing → entity onboarding → project portfolio → AI system inventory → KPI requirements mapping → control register).
- **Status logic (current code):**
  - Steps 1 (legal standing) and 2 (entity onboarding) are always marked complete in the card.
  - Step 3 requires at least one project.
  - Step 4/5/6 show coverage states (`none`/`partial`/`complete`) based on per-project systems, requirements, and control execution rows.
- **Mechanism:** Frontend calls `GET /projects`, `GET /admin/ai-systems`, `GET /admin/requirements`, controls, policies as needed to show completion state; no single “journey” API.

### 3.2 AIMS Scope — `.../aims-scope`

- **Purpose:** Capture governance scope (scope name, statement, boundaries, context, interested parties, lifecycle, cloud, regulatory refs, ISMS/PMS, exclusions).
- **APIs:** `GET /admin/aims-scope`, `POST /admin/aims-scope` (upsert).
- **Tables:** **`aims_scope`** (entity-scoped via `entity_id`).

### 3.3 AI Project Register (Capture AI Project) — `.../ai-project-register` or `/{entitySlug}/projects/register`

- **Purpose:** Register AI projects for the entity. **Project slug is derived** from entity slug + project name (not entered by user); UI shows “Slug will be: …”.
- **APIs:** `POST /admin/projects`, `PUT /admin/projects/{slug}`, `GET /projects`; delete via `DELETE /projects/{slug}` (archive).
- **Tables:** **`entity_projects`** (or `Project` in SQLAlchemy), **`project_translations`**.

### 3.4 AI System Register — `.../ai-system-register`

- **Purpose:** Register AI systems (use case, project, owner, vendor, risk tier, status, region, data sensitivity). Optional **Langfuse** fields: `langfuse_project_id`, `langfuse_base_url` for model cards.
- **APIs:** `GET /admin/ai-systems`, `POST /admin/ai-systems`, `PUT /admin/ai-systems/{id}`, `POST /admin/ai-systems/{id}/retire`.
- **Tables:** **`ai_system_registry`**.

### 3.5 AI Requirements Register — `.../ai-requirements-register`

- **Purpose:** Map frameworks (e.g. EU AI Act, ISO 42001, NIST) to requirements and link to project KPIs. Drives KPI coverage and policy alerts.
- **APIs:** `GET /admin/requirements`, `POST /admin/requirements`, `GET /admin/requirements/project-kpis`.
- **Tables:** **`ai_requirement_register`**, **`euaiact_requirements`**, **`iso42001_requirements`**, NIST mapping tables.

### 3.6 AI KPI Register — `.../ai-kpi-register`

- **Purpose:** View/manage KPI catalog for the entity.
- **Note:** The Governance Journey “KPI” step is satisfied by requirements coverage; the KPI register is a catalog/override view.
- **API:** `GET /admin/kpis` (and optional `.xlsx` export).
- **Tables:** **`kpis`**, **`kpi_definition`**; overrides in **`entity_kpi_overrides`**.

### 3.7 Control Register — `.../control-register`

- **Purpose:** View control catalog and execution metadata (owner, due date, reminders, status). Controls are tied to KPIs; values live in **`control_values`** and **`control_values_exec`**.
- **APIs:** `GET /admin/controls`; scorecard and evidence endpoints for values and evidence.
- **Tables:** **`controls`**, **`control_values`**, **`control_values_exec`**, **`entity_control_overrides`**.

### 3.8 AI Policy Register — `.../ai-policy-register`

- **Purpose:** Manage policies and finalize the policy register for the entity. Finalizing persists active policies and marks governance setup complete.
- **UI Placement:** In the v3 sidebar this is grouped under **ISO 42001**, but the route remains under governance-setup.
- **APIs:** `GET /admin/policies`, `POST /admin/policies`, `POST /admin/policies/{policy_id}/versions`, `POST /admin/policies:finalize`.
- **Tables:** **`policies`**, **`policy_versions`**, **`entity_policy_register`**, **`entity_policy_register_status`**.

---

## 4. Governance Execution Pages

Under `/{entitySlug}/scorecard/admin/governance-execution/`. Visibility of some items (e.g. Report Setup, KPI Schedule) depends on having a selected project.

### 4.1 AI Project Management — `.../ai-project-management`

- **Purpose:** Execution view of project governance status and tasks.
- **Data:** **`entity_projects`**, **`control_values_exec`**, **`policy_alerts`** (and related APIs).

### 4.2 Action Assignment — `.../action-assignment` and `.../action-assignment/[projectSlug]`

- **Purpose:** Assign actions to projects; list and manage assignments per project.
- **Backed by:** Control execution and policy alert data; project list from **`entity_projects`**.
- **UI:** Readiness summary includes owner/target/measurement/evidence fields and evidence status.

### 4.3 Evidence Capture — `.../evidence-capture`

- **Purpose:** Dedicated execution view to upload/link evidence to controls across projects.
- **APIs:** Evidence init/upload/finalize/download (same endpoints as Evidence Vault).

### 4.4 Policy Execution — `.../policy-execution`

- **Purpose:** View and act on policy execution status (alerts, compliance).

### 4.5 Model Cards — `.../model-cards`

- **Purpose:** View/create model cards for AI systems. **Sync Langfuse** pulls metrics into model card evidence via **`LangfuseAdapter.fetch_project_metrics`** when `langfuse_project_id` / `langfuse_base_url` are set.
- **APIs:** `GET /admin/model-cards`, `GET /admin/model-cards/{system_id}`, `POST /admin/model-cards/{system_id}`, `POST /admin/model-cards/{system_id}/sync-langfuse`.

### 4.6 Evidence Capture (KPI Admin) — `.../dashboard/kpis_admin` (under a project)

- **Purpose:** Edit KPI raw values and link evidence. Same data as scorecard controls.
- **APIs:** `GET /scorecard/{project_slug}`, `POST /scorecard/{project_slug}` (upsert KPI values), evidence init/upload/finalize/download (see Control & Audit).

### 4.7 Report Setup — `/{entitySlug}/admin/reportschedule`

- **Purpose:** Trigger or view schedule for **LLM report batch** (AI Summary, Governance Requirements, Board-level). Calls `POST /admin/ai-reports/batch-generate` for manual run.
- **Schedule:** Runs via `llm_report_schedule` + core-svc scheduler (see Batch Jobs).

### 4.8 KPI Schedule — `/{entitySlug}/admin/kpischedule`

- **Purpose:** Manually trigger **KPI (and pillar) recompute** for the entity or all. Calls `POST /admin/kpi-recompute`.
- **Backend:** **`app/score_engine.py`** → **`recompute_all()`** (uses `leadai_compute_kpi_scores` and `leadai_compute_pillar_scores` in a worker thread; advisory lock per project).

### 4.9 Provenance Schedule — `/{entitySlug}/admin/provenanceschedule`

- **Purpose:** Manually trigger **provenance manifest build** for the entity. Calls `POST /admin/provenance-manifests/build`.
- **Backend:** **`app/services/provenance_manifest_batch.py`** → **`batch_build_manifests()`** (per project: build manifest facts, upsert, evaluate provenance).

---

## 5. Control & Audit Pages

Under `/{entitySlug}/scorecard/admin/control-audit/`.

### 5.1 Trust Overview & Axes / Monitoring / Drift & Expiry / Decay Events / Remediation

- **Purpose:** View trust overview, axes, monitoring signals, decay events, remediation. Data from **`trust_monitoring_signals`**, **`trust_decay_events`**, **`audit_events`**, and related APIs.
- **Routes:** `.../control-audit`, `.../control-audit/axes`, `.../monitoring`, `.../monitoring/drift-expiry`, `.../monitoring/decay-events`, `.../monitoring/remediation`.
- **Mapping:** `GET/PUT /admin/trust-axis-mapping` persists axis↔pillar mapping in **`trust_axis_pillar_map`**.

### 5.2 Evidence Vault — `.../evidence` (and evidence panels elsewhere)

- **Flow:**
  1. **Init:** `POST /admin/projects/{project_slug}/controls/{control_id}/evidence:init` → creates **`evidence`** row and returns presigned S3/MinIO upload URL.
  2. **Upload:** Client `PUT` to presigned URL (direct to MinIO).
  3. **Finalize:** `POST /admin/evidence/{evidence_id}:finalize` (or `.../evidence:finalize/{evidence_id}`) marks upload complete.
  4. **Download:** `POST /admin/evidence/{evidence_id}:download-url` returns time-bounded download URL.
- **Tables:** **`evidence`**, **`evidence_audit`**. S3 key pattern: `evidence/{entity_id}/{project_slug}/{control_id}/{uuid}-{filename}`.

### 5.3 Provenance & Lineage — `.../provenance`

- **Purpose:** View provenance artifacts, datasets, models, lineage, evaluations. Build manifests via admin provenance API.
- **APIs:** `GET /admin/provenance/artifacts`, `POST /admin/provenance-manifests/build`, plus datasets, models, evidence, lineage, audit endpoints in **admin** router.
- **Tables:** **`provenance_*`**, **`provenance_manifest_facts`**, **`provenance_evaluations`**, **`provenance_audit`**.

### 5.4 Audit Log — `.../audit`

- **Purpose:** Immutable audit trail. Data from **`audit_events`** (and any audit endpoints in **audit** router).

### 5.5 Intelligent Alerts & Trends — `.../alerts`

- **Purpose:** Unified view of policy alerts + trend alerts, plus CRUD for alert rules.
- **APIs:** `GET/POST/PATCH/DELETE /scorecard/alert-rules`, `GET /scorecard/trend-alerts`, `POST /scorecard/trend-alerts/{id}/resolve`.
- **Supporting APIs:** `GET /scorecard/pillars` (metrics list), `GET /scorecard/trend-alerts/diagnostic`, `POST /scorecard/trend-alerts:compute`.
- **Tables:** **`alert_rules`**, **`trend_alerts`**.

---

## 6. Data Register Pages

Under `/{entitySlug}/scorecard/admin/data-register/`.

- **Data Sources:** `.../data-sources` — **`data_source_connectors`**, schema/table discovery, optional Jira config.
- **Data Classification:** `.../data-classification` — tags, assignments, usage records; feeds **data governance warnings** (PII/training, retention).
- **Retention & Deletion:** `.../retention` — **`data_retention_policies`**, retention records.
- **Interfaces:** `.../interfaces` — interface and integration config (e.g. Jira).

---

## 7. Scorecard & Dashboard Pages

### 7.1 Project Scorecard Landing — `/{entitySlug}/scorecard` or `/{entitySlug}/scorecard/[projectId]`

- **Purpose:** List projects or open a project’s scorecard. Project list from `GET /projects` (entity-scoped). Scorecard data from **scorecard** router.
- **API:** `GET /scorecard/{project_slug}` returns project, `overall_pct`, pillars, KPIs (with raw_value, normalized_pct, kpi_score, etc.).

### 7.2 Dashboard & KPI/Pillar Admin — `.../scorecard/[projectId]/dashboard`, `.../dashboard/kpis_admin`, `.../dashboard/pillars_admin`

- **Purpose:** View/edit KPI values and pillar overrides. Same scorecard engine; write via `POST /scorecard/{project_slug}` with `scores` or `updates` (by `kpi_key` / `raw_value`).
- **APIs:** `GET /scorecard/{project_slug}`, `GET /scorecard/{project_slug}/pillars`, `GET /scorecard/{project_slug}/controls`, `POST /scorecard/{project_slug}`.
- **Score computation:** **`app/scorecard.py`** normalizes raw values with **`controls.norm_min`** / **`norm_max`** and **`higher_is_better`**, computes KPI scores, aggregates pillars, applies **`pillar_overrides`** if present, then overall = average of pillar scores. Batch recompute is done by **score_engine** (see Batch Jobs).

### 7.3 KPI Detail — `.../scorecard/[projectId]/controls/[kpiKey]`

- **Purpose:** Single KPI/control detail. **API:** `GET /scorecard/{project_slug}/kpis/{kpi_key}` (from **kpidetail** router).

---

## 8. Reports

### 8.1 Template (Standard) Report — `GET /scorecard/{project_slug}/report?mode=standard`

- **Purpose:** Non-LLM report (e.g. PDF/HTML from scorecard data). Used by the report page when not requesting the AI summary.
- **Frontend:** Report page can use this or the LLM report URL depending on mode.

### 8.2 Executive Report (AI Summary LLM) — `GET /admin/ai-reports/projects/{slug}/ai-summary-llm`

- **Purpose:** LLM-generated executive summary for a project. Uses **DB-stored prompt** template key **`ai_summary_llm`** from **`llm_prompt_templates`** / **`llm_prompt_versions`**. Variables: e.g. `$Project Name`, `$Project Slug`, `$Overall Score`, `$Pillar Performance`, `$Lowest Performing KPIs`.
- **Flow:**
  1. Resolve entity and load scorecard (`get_scorecard`).
  2. Build KPI/pillar/overall inputs; compute **data hash** for cache key.
  3. Check **`llm_report_cache`** (by project_slug, provider, data_hash, entity_id). On cache hit, return cached markdown (optionally **`report_translations`** by locale).
  4. On miss: load active prompt, substitute variables, call **`generate_text()`** in **`app/services/llm.py`** (with optional Langfuse tracing when Langfuse env is set).
  5. Store in **`llm_report_cache`** and return.
- **Frontend:** Report page (`scorecard/[projectId]/report/page.tsx`) fetches this (or template) and renders Markdown; optional PDF export via **PdfReportButton**.

### 8.3 Governance Requirements Report — `GET /admin/ai-reports/projects/{slug}/governance-requirements-report`

- **Purpose:** LLM-generated report against selected frameworks (EU AI Act, ISO 42001, NIST, etc.) and optional Knowledge Vault sources.
- **Flow:**
  1. Resolve entity and scorecard; load entity profile (primary role, risk class), **`ai_requirement_register`** for the project, **`report_sources`** (knowledge vault), KPI-to-clause mapping from **`kpi_definition`**.
  2. Load active prompt template **`governance_requirements_report`** from DB (or Langfuse), substitute variables (entity name, frameworks, requirements, KPI mapping, sources).
  3. Call **`generate_text()`**; return report (no cache in the same way as AI summary; can be extended).
- **Tables:** **`llm_prompt_templates`**, **`llm_prompt_versions`**, **`ai_requirement_register`**, **`report_sources`**, **`kpi_definition`**.

### 8.4 Board-Level Report — `GET /admin/ai-reports/board-level-report`

- **Purpose:** Entity-level executive summary across all projects, plus structured **Next Steps**.
- **Next Steps:** Returns `next_steps` in the response. Manual overrides are stored in **`report_next_steps`** and managed via `GET/POST/PATCH/DELETE /admin/ai-reports/next-steps`.
- **Prompt Key:** `board-level-report` in **`llm_prompt_templates`**.

### 8.5 Board-Level Deck — `GET /admin/ai-reports/board-level-deck`

- **Purpose:** Entity-level presentation deck returned as structured JSON (slides).
- **Prompt Key:** `board-level-report-deck`.

### 8.6 Batch Report Generation — `POST /admin/ai-reports/batch-generate`

- **Purpose:** Manually trigger batch generation for LLM report types (AI Summary, Governance Requirements, Board-level).
- **Backend:** **`app/services/llm_report_batch.py`** → **`batch_generate_reports()`**. For each project (or those “needing reports” when not `force_all`): resolve entity, load scorecard, check cache, generate if needed, save to **`llm_report_cache`**. Returns counts (success, cached, error, total).
- **Scheduled run:** See **Batch Jobs** below (LLM report batch scheduler runs daily per report type).

### 8.7 Report Schedules — `GET/PUT /admin/ai-reports/schedule`

- **Purpose:** Control per-report schedule (enabled + run hour UTC) stored in **`llm_report_schedule`**.
- **API:** `GET /admin/ai-reports/schedule`, `PUT /admin/ai-reports/schedule/{report_type}`.

### 8.8 Other Report Endpoints

- **`GET /admin/ai-reports/projects/{slug}/ai-summary`** — Non-LLM structured project report (same data as scorecard, different shape).
- **`GET /admin/reports/...`** (reports router) — KPI list / hierarchy (e.g. **`v_project_pillars_kpis`** view).

---

## 9. System Admin Pages

These are **not** entity-prefixed; they are for master admins (see **USER_ENTITY_ACCESS.md**).

### 9.1 Entities — `/admin/entities`

- **Purpose:** List, update, archive all entities. **API:** `GET /admin/master/entities`, PATCH/archive via master_admin router. Archiving copies to **`entity_archive`** and deletes the entity (CASCADE).

### 9.2 Manage Access — `/admin/manage-access`

- **Purpose:** Grant/revoke user access to entities (admin/editor/viewer). **APIs:** `GET /admin/master/users`, `PUT /admin/master/users/{user_id}/entities/{entity_id}` (role). **Tables:** **`user_entity_access`**, **`user_mapping`**.

### 9.3 Master Translation — `/admin/master-translation`

- **Purpose:** Override UI translations (e.g. EN → TR). **Tables/APIs:** **`ui_translations`** (or equivalent) via **ui_translations** router.

### 9.4 Model Providers — `/admin/model-providers`

- **Purpose:** Manage model provider list and per-entity provider artifacts (assurances).
- **APIs:** `GET /admin/ai-systems/helper/model-providers`, `GET/POST/PUT/DELETE /admin/entity-provider-artifacts`.
- **Table:** **`entity_provider_artifacts`**.

### 9.5 Email Settings — `/admin/email-settings` (and `/{entitySlug}/admin/email-settings`)

- **Purpose:** Manage SMTP config used by reminder/assignment/policy emails.
- **APIs:** `GET /admin/master/email-settings`, `PUT /admin/master/email-settings`, `POST /admin/master/email-settings/test`.
- **Storage:** Encrypted SMTP URL + sender in **`system_email_settings`** (`pgcrypto` + `pgp_sym_encrypt`/`pgp_sym_decrypt`).
- **Fallback behavior:** Effective config prefers DB settings; falls back to env (`EMAIL_SERVER`, `EMAIL_FROM`).
- **Guardrail:** Saving requires `SMTP_SETTINGS_ENCRYPTION_KEY` on core-svc (`can_save=false` if missing).

### 9.6 System Health — `/health` (UI) and `/api/health` (aggregator)

- **Purpose:** Show live infra status for core dependencies from the web app.
- **Checks include:** web, core-svc, mcp, qdrant, ollama, minio, redis (TCP), postgres (TCP), plus non-blocking checks for dify/leadai-chatbot/langfuse and pgvector readiness details.
- **Blocking status:** Overall `ok/degraded` currently depends on web/core-svc/mcp/qdrant/ollama/minio/redis/postgres.

### 9.7 Gov. Req. Report Prompt — `/admin/gov-req-report-prompt`

- **Purpose:** Edit the **Governance Requirements** LLM prompt template. Writes to **`llm_prompt_templates`** / **`llm_prompt_versions`** (key **`governance_requirements_report`**).

### 9.8 Executive Report Prompt — `/admin/ai-summary-llm-prompt`

- **Purpose:** Edit the **Executive (AI Summary)** LLM prompt template. Key **`ai_summary_llm`** in **`llm_prompt_templates`** / **`llm_prompt_versions`**.

### 9.9 Board-Level Report Prompt — `/admin/board-level-report-prompt`

- **Purpose:** Edit the board-level report prompt template (key **`board-level-report`**).

### 9.10 Board-Level Deck Prompt — `/admin/board-level-deck-prompt`

- **Purpose:** Edit the board-level deck prompt template (key **`board-level-report-deck`**).

---

## 9.11 Knowledge Base & Knowledge Vault

- **Knowledge Base:** `.../knowledgebase` (and `.../knowledgebase/kpi/[kpiKey]`) — static KPI/pillar know-how and compliance references (no entity prefix in sidebar).
- **Knowledge Vault:** `.../knowledge-vault` — entity-scoped. **APIs:** `GET /admin/knowledge-vault/sources`, `POST /admin/knowledge-vault/presign`, `POST /admin/knowledge-vault/sources`, `PUT/DELETE .../sources/{id}`. **Tables:** **`report_sources`**, **`report_source_files`**; files in MinIO/S3. Ingest service chunks and embeds into Qdrant for RAG; governance/LLM reports can use these sources.
- **Chat:** `/chat` — chat UI backed by MCP server (e.g. `chat.answer`), using Qdrant retrieval over document roots / knowledge vault content.

---

## 10. Batch Jobs and Schedulers

All run inside **core-svc** (or as a separate **alert_worker** process) and are controlled by env vars.

### 10.1 Data Governance Scheduler (core-svc)

- **What:** Runs **`compute_data_governance_warnings()`** daily at a fixed hour UTC.
- **Code:** **`app/main.py`** → **`_governance_scheduler(run_hour_utc)`**; **`app/services/data_governance.py`**.
- **Behavior:** Clears existing unresolved **`pii_training`** and **`retention_overdue`** rows in **`data_governance_warnings`**; re-evaluates **data_classification_assignments** + **data_usage_records** (PII + training) and **data_retention_policies** + retention records (overdue); inserts new warning rows.
- **Env:** `DATA_GOVERNANCE_SCHEDULER` (default `on`), `DATA_GOVERNANCE_DAILY_HOUR` (default `2`).

### 10.2 LLM Report Batch Scheduler (core-svc)

- **What:** Batch-generates LLM reports **per report type** (AI Summary, Governance Requirements, Board-level report, Board-level deck) daily.
- **Code:** **`app/main.py`** → **`_llm_report_batch_scheduler(report_type, run_hour_utc)`**; reads **`llm_report_schedule`**; calls **`cleanup_expired_cache()`** then **`batch_generate_reports(force_all=True, report_types=[report_type])`**; **`app/services/llm_report_batch.py`**, **`app/services/llm_report_cache.py`**.
- **Behavior:** For each report type, fetches projects (or entity payload for board-level), generates report (or uses cache), writes to **`llm_report_cache`**. Expired cache entries are deleted before the run.
- **Env:** `LLM_REPORT_BATCH_SCHEDULER` (default `on`), `LLM_REPORT_BATCH_DAILY_HOUR` (default `3`).

### 10.3 KPI Recompute Scheduler (core-svc)

- **What:** Daily full **KPI and pillar recompute** for all projects.
- **Code:** **`app/main.py`** → **`_kpi_recompute_scheduler(run_hour_utc)`**; **`app/score_engine.py`** → **`recompute_all(project_id_or_none=None)`**; uses **`leadai_compute_kpi_scores`** and **`leadai_compute_pillar_scores`** in a worker thread; logs to **`audit_events`**.
- **Behavior:** Recomputes **control_values** (normalized_pct, kpi_score) and pillar/overall scores; writes **pillar_overrides** or derived pillars. One audit event per run (success/failure).
- **Env:** `KPI_RECOMPUTE_BATCH_SCHEDULER` (default `on`), `KPI_RECOMPUTE_DAILY_HOUR` (default `3`).

### 10.4 Provenance Manifest Scheduler (core-svc)

- **What:** Daily **provenance manifest build and evaluation** for all projects, **per entity**.
- **Code:** **`app/main.py`** → **`_provenance_manifest_scheduler(run_hour_utc)`**; **`app/services/provenance_manifest_batch.py`** → **`batch_build_manifests(entity_id=entity_id)`**; uses **`provenance_manifest_builder`** and **`provenance_integration`** (evaluate, upsert manifest facts).
- **Behavior:** For each project in the entity: build manifest facts, upsert to **`provenance_manifest_facts`**, run **`evaluate_project_provenance`** (rules-based), write **`provenance_evaluations`** / audit.
- **Env:** `PROVENANCE_MANIFEST_BATCH_SCHEDULER` (default `on`), `PROVENANCE_MANIFEST_DAILY_HOUR` (default `3`).

### 10.5 Alert Worker (Separate Process)

- **What:** Continuously refreshes **policy alerts**, **trend alerts**, **data governance warnings**, and **control reminders** (feature flags).
- **Code:** **`app/workers/alert_worker.py`**. Loop: `compute_data_governance_warnings()` (if enabled), `compute_policy_alerts()`, `compute_trend_alerts()` (if enabled), `run_control_reminders()` (if enabled); sleep for `ALERT_WORKER_INTERVAL_SECONDS`.
- **Policy alerts:** **`app/services/policy_alerts.py`** → **`compute_policy_alerts()`** evaluates policies vs requirements/entity state and upserts **`policy_alerts`**.
- **Env:** `ALERT_WORKER_INTERVAL_SECONDS` (default `300`), `ALERT_WORKER_REFRESH_GOVERNANCE` (default `true`), `ALERT_WORKER_ONCE` (run once and exit).

---

## 11. Key Backend Services (Summary)

| Service / Module | Role |
|------------------|------|
| **scorecard** (`app/scorecard.py`) | GET/POST scorecard; normalizes KPI values, aggregates pillars, applies overrides; single source of truth for dashboard and report inputs. |
| **score_engine** (`app/score_engine.py`) | Async wrappers for batch KPI/pillar recompute; advisory lock per project; used by schedule and manual KPI schedule. |
| **llm_report_batch** | Batch Executive report generation; uses scorecard data, DB prompt `ai_summary_llm`, cache, and LLM. |
| **llm_report_cache** | Cache lookup/save for AI summary reports; TTL and cleanup of expired entries. |
| **data_governance** | PII/training and retention-overdue warnings into **`data_governance_warnings`**. |
| **policy_alerts** | Compute and persist **`policy_alerts`** from policies and requirements. |
| **provenance_manifest_batch** / **provenance_integration** | Build and evaluate provenance manifests; upsert facts and evaluations. |
| **entity** router | Entity CRUD, by-slug/latest, translations; used by entity setup and context resolution. |
| **admin** router | Large surface: controls, projects, evidence, AI systems, model cards, data sources, classification, retention, provenance CRUD, policies, KPI recompute, provenance build, data governance compute, etc. |
| **Langfuse** (optional) | When `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_BASE_URL` (or `LANGFUSE_HOST`) are set: **`generate_text()`** and company profile extraction send traces; model cards can sync metrics via **LangfuseAdapter**. |

---

## 12. Database Tables (Quick Reference)

- **Identity / multi-entity:** `entity`, `user_mapping`, `user_entity_access`, `entity_archive`.
- **Projects / setup:** `entity_projects`, `project_translations`, `aims_scope`, `ai_system_registry`, `ai_requirement_register`, `policies`, `policy_versions`, `entity_policy_register`, `entity_policy_register_status`.
- **Catalog:** `pillars`, `kpis`, `controls`, `kpi_definition`, `entity_kpi_overrides`, `entity_control_overrides`.
- **Execution:** `control_values`, `control_values_exec`, `pillar_overrides`, `evidence`, `evidence_audit`, `policy_alerts`.
- **Reporting / LLM:** `llm_report_cache`, `llm_prompt_templates`, `llm_prompt_versions`, `report_translations`, `report_sources`, `report_source_files`.
- **Provenance / trust:** `provenance_*`, `provenance_manifest_facts`, `provenance_evaluations`, `provenance_audit`, `trust_evaluations`, `trustmarks`, `trust_monitoring_signals`, `trust_decay_events`.
- **Governance / audit:** `data_governance_warnings`, `audit_events`.

For migration and schema details, see **`apps/core-svc/alembic/versions`** and **docs/TECH_STACK_AND_WORKFLOW.md**.

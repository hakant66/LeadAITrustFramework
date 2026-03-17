# LeadAI GUI Workflow (Detailed, Code-Accurate)

This document describes how the **current UI** works, which routes are used, and which API/data objects back each page. It follows the flow from onboarding to monitoring and reporting, and includes both **entity-scoped** and **legacy** routes where applicable.

---

## 1) Entry, Auth, and Entity Context

### Registration & Auth
- **Route:** `/register`
- **Auth Mechanism:** NextAuth v5 email provider (passwordless code)
- **Backend Mapping:**
  - NextAuth user ID (cuid) -> `user_mapping.backend_user_id` (UUID)
  - Access control stored in `user_entity_access`

### API Proxy & Context Propagation
- **Proxy:** `/api/core/*` in Next.js forwards to core-svc.
- **Headers Added:** `X-NextAuth-User-ID` when session exists.
- **Entity Context:** `X-Entity-ID` or `?entity_id=` forwarded to core-svc.

### Entity Routing Modes
- **Entity-scoped (preferred):** `/{entitySlug}/scorecard/...`
- **Legacy:** `/scorecard/...` (kept for compatibility)
- **Nav Mode Control:** `LEADAI_NAV_MODE=legacy` forces legacy redirects.

---

## 2) Entity Onboarding and Legal Standing

### AI Legal Standing Assessment
- **Route:** `/ai_legal_standing`
- **Purpose:** Run EU AI Act decision tree, gather entity legal context.
- **API:** `POST /ai-legal-standing/assess` (returns assessment result used for immediate persistence flow)
- **Persistence behavior (current code):**
  - If entity context is resolved, result is saved immediately with `PATCH /entity/{id}`.
  - If no entity exists but staged entity profile exists in session, `POST /entity` is used to create and persist legal standing.
  - If neither is available, UI shows: `Complete the Entity form first, then return here.`

### Entity Setup (Entity Profile)
- **Route:** `/{entitySlug}/scorecard/admin/governance-setup/entity-setup`
- **Behavior:**
  - Loads entity by slug: `GET /entity/by-slug/{slug}`
  - If slug missing (first onboarding), falls back to `GET /entity/latest`
  - Save updates via `PATCH /entity/{id}`
  - On save, slug is generated if missing and the URL is updated
- **Read-only fields:** `primaryRole`, `riskClassification`, `decisionTrace`
- **Editable fields:** registration number, headquarters, regions, sectors, executive sponsor, compliance officer

---

## 3) Governance Setup (Entity-Scoped)

### Landing (Journey Card)
- **Route:** `/{entitySlug}/scorecard/admin/governance-setup`
- **Purpose:** Displays a 6-step governance journey (legal standing, entity onboarding, project portfolio, AI system inventory, KPI requirements mapping, control register).
- **Behavior (current code):**
  - Steps 1 and 2 are always shown as complete.
  - Step 3 requires at least one project.
  - Steps 4, 5, 6 use per-project coverage (`none`/`partial`/`complete`) for systems, requirements, and control execution rows.

### A) AIMS Scope
- **Route:** `/{entitySlug}/scorecard/admin/governance-setup/aims-scope`
- **Purpose:** Capture scope and governance objectives for the entity.
- **UI Placement:** Also surfaced under the ISO 42001 section in the v3 sidebar.
- **Tables:** `aims_scope`
- **API:** `GET /admin/aims-scope`, `POST /admin/aims-scope`
- **Fields Captured:** scope name, status, owner, scope statement, scope boundaries, internal/external context, interested parties, lifecycle coverage, cloud platforms, regulatory requirements, ISMS/PMS integration, exclusions.

### B) AI Project Register (Capture AI Project)
- **Route:** `/{entitySlug}/scorecard/admin/governance-setup/ai-project-register` (also `/{entitySlug}/projects/register`)
- **Slug:** Project slug is **derived** from entity slug + project name (not user-entered); UI shows "Slug will be: …".
- **API:**
  - `POST /admin/projects`
  - `PUT /admin/projects/{slug}` (updates)
  - `DELETE /projects/{slug}` (archive)
- **Tables:** `entity_projects`, `project_translations`

### C) AI System Register
- **Route:** `/{entitySlug}/scorecard/admin/governance-setup/ai-system-register`
- **API:** `/admin/ai-systems`
- **Tables:** `ai_system_registry`
- **Key Fields:** `uc_id` (use case reference), project slug, name/description, owner, vendor/provider, risk tier, status, region scope, data sensitivity.

### D) AI Requirements Register
- **Route:** `/{entitySlug}/scorecard/admin/governance-setup/ai-requirements-register`
- **API:**
  - `GET /admin/requirements`
  - `GET /admin/requirements/project-kpis`
  - `POST /admin/requirements`
- **Tables:** `ai_requirement_register`, `euaiact_requirements`, `iso42001_requirements`, NIST AI RMF mapping tables
- **Behavior:** Selecting frameworks generates KPI coverage and policy alerts. This is the journey “KPI - The Metric” step. Entity legal standing (role/risk/decision trace) is surfaced as read-only context.

### E) AI KPI Register
- **Route:** `/{entitySlug}/scorecard/admin/governance-setup/ai-kpi-register`
- **API:** `GET /admin/kpis`
- **Tables:** `kpis`, `kpi_definition`
- **Note:** Catalog/override view; the journey KPI step is satisfied by requirements coverage.

### F) AI Policy Register
- **Route:** `/{entitySlug}/scorecard/admin/governance-setup/ai-policy-register`
- **UI Placement:** Grouped under **ISO 42001** in the v3 sidebar.
- **API:**
  - `GET /admin/policies`
  - `POST /admin/policies`
  - `POST /admin/policies/{policy_id}/versions`
  - `POST /admin/policies:finalize`
- **Tables:** `policies`, `policy_versions`, `entity_policy_register`, `entity_policy_register_status`
- **Behavior:** Finalizing the policy register persists active policies for the entity and marks governance setup complete.

### G) AI Control Register
- **Route:** `/{entitySlug}/scorecard/admin/governance-setup/control-register`
- **Data Sources:**
  - Control definitions from `controls`
  - KPI metadata from `kpis`
  - Project control values from `control_values`
  - Execution metadata from `control_values_exec`
- **Behavior:** Shows read-only control catalog with editable execution fields (owner, due date, reminders, status).

---

## 4) Governance Execution

### AI Project Management
- **Route:** `/{entitySlug}/scorecard/admin/governance-execution/ai-project-management`
- **Purpose:** Execution-oriented view of project governance status and tasks.
- **Backed By:** `entity_projects`, `control_values_exec`, `policy_alerts`

### Action Assignment
- **Route:** `/{entitySlug}/scorecard/admin/governance-execution/action-assignment`
- **Purpose:** Assign actions per project; readiness summary (owner/target/evidence).
- **Backed By:** `control_values_exec`, `policy_alerts`

### Evidence Capture
- **Route:** `/{entitySlug}/scorecard/admin/governance-execution/evidence-capture`
- **Purpose:** Upload/link evidence against control requirements.
- **APIs:** Evidence init/upload/finalize/download (shared with Evidence Vault).

### Policy Execution
- **Route:** `/{entitySlug}/scorecard/admin/governance-execution/policy-execution`
- **Purpose:** View and act on policy execution status.

---

## 5) Control & Audit (Entity-Scoped)

### Control & Audit Landing
- **Route:** `/{entitySlug}/scorecard/admin/control-audit`

### Evidence Capture
- **Route:** `/{entitySlug}/scorecard/admin/control-audit/evidence`
- **API:**
  - `POST /admin/projects/{project_slug}/controls/{control_id}/evidence:init`
  - `PUT <presigned S3 url>`
  - `POST /admin/evidence/{evidence_id}:finalize`
  - `GET /admin/projects/{project_slug}/controls/{control_id}/evidence`
- **Tables:** `evidence`, `evidence_audit`

### Monitoring & Audit
- **Routes:**
  - `/{entitySlug}/scorecard/admin/control-audit/monitoring`
  - `/{entitySlug}/scorecard/admin/control-audit/monitoring/decay-events`
  - `/{entitySlug}/scorecard/admin/control-audit/monitoring/drift-expiry`
  - `/{entitySlug}/scorecard/admin/control-audit/monitoring/remediation`
- **Tables:** `trust_monitoring_signals`, `trust_decay_events`, `audit_events`

### Trust Axes
- **Route:** `/{entitySlug}/scorecard/admin/control-audit/axes`
- **Mapping API:** `GET/PUT /admin/trust-axis-mapping` (table **`trust_axis_pillar_map`**).

### Provenance
- **Route:** `/{entitySlug}/scorecard/admin/control-audit/provenance`
- **API:** `/admin/provenance-manifests`, `/admin/provenance-manifests/build`
- **Tables:** `provenance_*`, `provenance_manifest_facts`, `provenance_evaluations`

### Intelligent Alerts & Trends
- **Route:** `/{entitySlug}/scorecard/admin/alerts`
- **APIs:** `GET/POST/PATCH/DELETE /scorecard/alert-rules`, `GET /scorecard/trend-alerts`, `POST /scorecard/trend-alerts/{id}/resolve`
- **Tables:** `alert_rules`, `trend_alerts`

---

## 6) ISO 42001

### Scope - The Boundary
- **Route:** `/{entitySlug}/scorecard/admin/governance-setup/aims-scope`
- **Purpose:** ISO 42001 scope definition (AIMS Scope).

### Pillar Admin
- **Route:** `/{entitySlug}/scorecard/dashboard/pillars_admin`
- **Purpose:** Manage pillar weights/overrides at entity scope.

### Manage KPIs and Controls
- **Route:** `/admin/manage-kpis-controls`
- **Purpose:** Global KPI/control catalog management.

### Policy Register
- **Route:** `/{entitySlug}/scorecard/admin/governance-setup/ai-policy-register`
- **Purpose:** Maintain and finalize ISO 42001 policy register.

### Policy Execution
- **Route:** `/{entitySlug}/scorecard/admin/governance-execution/policy-execution`
- **Purpose:** Track policy execution status and actions.

---

## 7) Data Register

### Data Register Landing
- **Route:** `/{entitySlug}/scorecard/admin/data-register`

### Sub-pages
- **Data Sources:** `/{entitySlug}/scorecard/admin/data-register/data-sources`
- **Data Classification:** `/{entitySlug}/scorecard/admin/data-register/data-classification`
- **Retention Policies:** `/{entitySlug}/scorecard/admin/data-register/retention`
- **Interfaces:** `/{entitySlug}/scorecard/admin/data-register/interfaces`

**Tables:** data register tables, retention policy tables, interface and Jira configuration tables.

---

## 8) Knowledge Base & Knowledge Vault

### Knowledge Base (Legacy)
- **Route:** `/scorecard/admin/knowledgebase`
- **Purpose:** Static KPI/pillar knowledge and compliance references.

### Knowledge Vault (Entity-Scoped)
- **Route:** `/{entitySlug}/scorecard/admin/knowledge-vault`
- **Tables:** `report_sources`, `report_source_files`
- **Behavior:** Sources are chunked, embedded, and indexed in Qdrant for LLM reporting.

---

## 9) Scorecard & Reporting

### Project Scorecard
- **Routes:**
  - `/{entitySlug}/scorecard/{projectId}`
  - `/{entitySlug}/scorecard/{projectId}/dashboard`
  - `/{entitySlug}/scorecard/{projectId}/dashboard/kpis_admin`
  - `/{entitySlug}/scorecard/{projectId}/dashboard/pillars_admin`
- **API:**
  - `GET /scorecard/{project_slug}`
  - `GET /scorecard/{project_slug}/pillars`
  - `GET /scorecard/{project_slug}/controls`
  - `POST /scorecard/{project_slug}`

### KPI Detail
- **Route:** `/{entitySlug}/scorecard/{projectId}/controls/{kpiKey}`
- **API:** `GET /scorecard/{project_slug}/kpis/{kpi_key}`

### Executive Reports
- **Template:** `GET /scorecard/{project_slug}/report?mode=standard`
- **LLM (AI Summary):** `GET /admin/ai-reports/projects/{slug}/ai-summary-llm`
- **LLM (Gov. Requirements):** `GET /admin/ai-reports/projects/{slug}/governance-requirements-report`
- **Board-Level Report:** `GET /admin/ai-reports/board-level-report`
- **Board-Level Deck:** `GET /admin/ai-reports/board-level-deck`

---

## 10) System Admin (Master Admin)

The sidebar labels this area **"System Admin"** (EN) / **"Sistem Yöneticisi"** (TR). Entity switcher shows **"Choose Entity"** when in this context.

### System Admin: Entities
- **Route:** `/admin/entities`
- **API:** `/admin/master/entities`
- **Actions:** list, update, archive -> `entity_archive`

### System Admin: Access
- **Route:** `/admin/manage-access`
- **API:** `/admin/master/users`, `/admin/master/users/{user_id}/entities/{entity_id}`
- **Tables:** `user_entity_access`, `user_mapping`

### System Admin: Email Settings
- **Routes:** `/admin/email-settings`, `/{entitySlug}/admin/email-settings`
- **APIs:** `GET /admin/master/email-settings`, `PUT /admin/master/email-settings`, `POST /admin/master/email-settings/test`
- **Table:** `system_email_settings` (encrypted SMTP URL + `email_from`)
- **Requirement:** saving is disabled unless `SMTP_SETTINGS_ENCRYPTION_KEY` is set on core-svc.

### System Admin: Model Providers
- **Route:** `/admin/model-providers`
- **APIs:** `GET /admin/ai-systems/helper/model-providers`, `GET/POST/PUT/DELETE /admin/entity-provider-artifacts`
- **Table:** `entity_provider_artifacts`

### System Admin: Model Cards
- **Route:** `/{entitySlug}/scorecard/admin/governance-execution/model-cards`
- **APIs:** `GET /admin/model-cards`, `POST /admin/model-cards/{system_id}`, `POST /admin/model-cards/{system_id}/sync-langfuse`

### System Admin: System Health
- **Routes:** `/health` (UI), `/api/health` (aggregated checks)
- **Checks:** web, core-svc, mcp, qdrant, ollama, minio, redis, postgres; plus non-blocking dify/leadai-chatbot/langfuse and pgvector diagnostics.

### AI Report Setup (System Admin)
- **Gov. Req. Report Prompt:** `/admin/gov-req-report-prompt` — edit DB-stored prompt template `governance_requirements_report`.
- **Executive Report Prompt:** `/admin/ai-summary-llm-prompt` — edit DB-stored prompt template `ai_summary_llm` (used by project report page and batch).
- **Board-Level Report Prompt:** `/admin/board-level-report-prompt` — template `board-level-report`.
- **Board-Level Deck Prompt:** `/admin/board-level-deck-prompt` — template `board-level-report-deck`.

### Schedules (Global + Entity-Scoped)
- **KPI Schedule:** `/admin/kpischedule` or `/{entitySlug}/admin/kpischedule`
  - API: `POST /admin/kpi-recompute`
- **Provenance Schedule:** `/admin/provenanceschedule` or `/{entitySlug}/admin/provenanceschedule`
  - API: `POST /admin/provenance-manifests/build`
- **Report Schedule:** `/admin/reportschedule` or `/{entitySlug}/admin/reportschedule`
  - API: `POST /admin/ai-reports/batch-generate`, `GET/PUT /admin/ai-reports/schedule`

---

## 11) Chatbot & RAG

### Chat UI
- **Route:** `/chat`
- **Backend:** MCP server (`/tools/chat.answer`)
- **Sources:** `report_sources` and document roots indexed into Qdrant

### MCP Tools
- `ingest.scan`, `ingest.upsert`, `ingest.delete`
- `retriever.search`
- `chat.answer`
- `trust.evaluate`

---

## 12) Legacy Routes (Kept for Compatibility)

- `/scorecard/admin/*`
- `/scorecard/{projectId}/*`
- `/projects/register`

Legacy routes still operate but do not encode `entitySlug` in the URL. Entity context is passed by header or resolved as the user's first entity.

---

If you want a page-by-page API trace or DB query breakdown, specify which page and I will expand it further.

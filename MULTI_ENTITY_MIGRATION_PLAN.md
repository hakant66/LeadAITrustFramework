# Multi-Entity Migration Plan for LeadAI Trust Framework

## Overview
This document outlines all actions required to convert the LeadAI solution from a single-entity system to a multi-entity system where each entity has its own isolated data scope.

## Key Principles (Combined Plan)

This plan combines detailed analysis with practical implementation guidance:

1. **Entities Table:** Create/update `entities` table with `id`, `name`, `slug`, `status`, and optional fields
2. **Entity ID Everywhere:** Add `entity_id` to ALL tenant-scoped tables (40+ tables)
3. **Composite Uniqueness:** Replace global unique constraints with `(entity_id, slug)` or `(entity_id, key)` patterns
4. **Staged Migration:** Add nullable → backfill → enforce NOT NULL → drop old constraints → add composite constraints
5. **Background Jobs:** All scheduled tasks (LLM reports, KPI recompute, provenance manifests, policy alerts) must process per-entity
6. **Caching & Derived Tables:** `llm_report_cache`, `project_pillar_scores`, `trustmarks` must use composite keys `(entity_id, ...)` for proper isolation
7. **Evidence Storage:** S3/MinIO paths must include `entity_id`: `{entity_id}/{project_slug}/evidence/...`
8. **Entity Context:** Support multiple methods (route prefix `/entities/{id}/...`, header `X-Entity-ID`, query param `?entity_id=...`)
9. **Cache Isolation:** All cache keys must include `entity_id` to prevent cross-entity cache poisoning
10. **Integrations:** Jira sync tables, MCP server, and Chatbot must include entity_id and filter by entity context
11. **Observability:** All logs, events, and metrics must carry `entity_id` to avoid cross-entity confusion
12. **Data Migration:** Assign all existing data to a default entity, then allow reassignment
13. **Risk Mitigation:** Comprehensive validation, staged rollout, rollback plans, and monitoring

## Table of Contents
1. [Database Schema Changes](#database-schema-changes)
2. [Backend Code Changes](#backend-code-changes)
3. [Frontend Changes](#frontend-changes)
   - [New Pages & Components](#31-new-pages--components)
   - [Page Updates](#32-pages-requiring-updates)
   - [Navigation & Layout](#34-navigation--layout-updates)
   - [Component Updates](#36-component-updates)
   - [User Experience Flow](#37-user-experience-flow)
   - [Visual Design Changes](#38-visual-design-changes)
4. [Authentication & Authorization](#authentication--authorization)
5. [Data Migration Strategy](#data-migration-strategy)
6. [Testing Requirements](#testing-requirements)
7. [Rollout Strategy](#rollout-strategy)

---

## 1. Database Schema Changes

### 1.1 Create Entities Table

**New Table: `entities` (or use existing `entity` table)**

**Structure:**
```sql
CREATE TABLE entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'active',
    owner_email TEXT,
    region TEXT,
    market_role_id UUID REFERENCES entity_primary_role(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX ix_entities_slug ON entities(slug);
CREATE INDEX ix_entities_status ON entities(status);
```

**Note:** If using existing `entity` table, ensure it has `slug` and `status` fields. If not, add them via migration.

### 1.2 Alembic Migration: Add `entity_id` Column to All Entity-Scoped Tables

#### Tables Requiring `entity_id` Foreign Key:

**Core Tables:**
- `entity_projects` - Add `entity_id UUID NOT NULL` with FK to `entity_country.id` (wait, should be `entity.id`)
- `aims_scope` - Add `entity_id UUID NOT NULL` with FK to `entity.id`
- `pillars` - **DECISION NEEDED**: Global or per-entity? (Likely global/shared)
- `kpis` - **DECISION NEEDED**: Global or per-entity? (Likely global/shared)
- `controls` - **DECISION NEEDED**: Global or per-entity? (Likely global/shared)

**Project-Related Tables:**
- `assessments` - Already has `project_id`, add `entity_id` via project relationship OR add directly
- `pillar_overrides` - Already has `project_id`, add `entity_id` via project relationship OR add directly
- `pillar_overrides_history` - Add `entity_id` (via project relationship)
- `project_translations` - Already has `project_id`, add `entity_id` via project relationship
- `project_pillar_scores` - Already has `project_id`, add `entity_id` via project relationship
  - **IMPORTANT:** Update primary key to composite `(entity_id, project_id, pillar_key)` for proper data isolation

**Control & Evidence Tables:**
- `control_values` - Currently uses `project_slug`, add `entity_id` (via project relationship)
- `control_values_history` - Currently uses `project_slug`, add `entity_id` (via project relationship)
- `evidence` - Currently uses `project_slug`, add `entity_id` (via project relationship)
  - **IMPORTANT:** Update S3/MinIO key prefixes to include entity_id: `{entity_id}/{project_slug}/evidence/...`
- `evidence_audit` - Add `entity_id` (via evidence relationship)

**Audit Tables:**
- `audit_events` - Add `entity_id UUID NOT NULL` with FK to `entity.id`

**Policy & AIMS Tables:**
- `policies` - Add `entity_id UUID NOT NULL` with FK to `entity.id`
- `policy_versions` - Add `entity_id` (via policy relationship)
- `policy_alerts` - Add `entity_id` (via policy relationship)

**Provenance Tables:**
- `provenance_artifacts` - Currently uses `project_slug`, add `entity_id` (via project relationship)
- `provenance_datasets` - Currently uses `project_slug`, add `entity_id` (via project relationship)
- `provenance_models` - Currently uses `project_slug`, add `entity_id` (via project relationship)
- `provenance_evidence` - Currently uses `project_slug`, add `entity_id` (via project relationship)
- `provenance_lineage` - Currently uses `project_slug`, add `entity_id` (via project relationship)
- `provenance_audit` - Add `entity_id` (via entity_type/entity_id lookup)
- `provenance_evaluations` - Currently uses `project_slug`, add `entity_id` (via project relationship)
- `provenance_manifest_facts` - Currently uses `project_slug`, add `entity_id` (via project relationship)

**Trust & Evaluation Tables:**
- `trust_evaluations` - Currently uses `project_slug`, add `entity_id` (via project relationship)
  - **IMPORTANT:** Update index to composite `(entity_id, project_slug, evaluated_at)`
- `trust_evaluation_audit` - Add `entity_id` (via evaluation relationship)
- `trustmarks` - Currently uses `project_slug` and `project_id`, add `entity_id` (via project relationship)
  - **IMPORTANT:** Update unique constraint to include `entity_id` for proper isolation
- `trust_monitoring_signals` - Currently uses `project_slug`, add `entity_id` (via project relationship)
- `trust_decay_events` - Currently uses `project_slug`, add `entity_id` (via project relationship)

**LLM & Reporting Tables:**
- `llm_report_cache` - Currently uses `project_slug`, add `entity_id` (via project relationship)
  - **IMPORTANT:** Update composite key to `(entity_id, project_slug, provider)` for proper cache isolation

**Jira Integration Tables:**
- `jira_configs` - Add `entity_id UUID NOT NULL` with FK to `entity.id`
- `jira_sync_history` - Add `entity_id` (via config relationship)

**ISO 42001 & EU AI Act Tables:**
- `iso42001_requirements` - **DECISION NEEDED**: Global or per-entity? (Likely global/shared)
- `euaiact_requirements` - **DECISION NEEDED**: Global or per-entity? (Likely global/shared)
- `euaiact_entity_definitions` - Add `entity_id UUID NOT NULL` with FK to `entity.id`

**Other Tables:**
- `ai_system_registry` - Currently uses `project_slug`, add `entity_id` (via project relationship)
- `ai_readiness_results` - Currently uses `slug`, add `entity_id` (if related to entity)

**Lookup Tables (Likely Global/Shared):**
- `entity_country` - Already entity-related, no change needed
- `entity_sector_lookup` - Already entity-related, no change needed
- `entity_primary_role` - Already entity-related, no change needed
- `entity_risk_class` - Already entity-related, no change needed
- `guardrail_rules` - **DECISION NEEDED**: Global or per-entity?
- `guardrail_fact_sources` - **DECISION NEEDED**: Global or per-entity?
- `trust_axis_pillar_map` - **DECISION NEEDED**: Global or per-entity? (Likely global)

### 1.2 Migration Steps (Alembic)

**Migration 1: Add entity_id to Core Tables**
```python
# Create migration: add_entity_id_to_core_tables
- Add entity_id to entity_projects (NOT NULL after data migration)
- Add entity_id to aims_scope (NOT NULL after data migration)
- Add entity_id to policies (NOT NULL after data migration)
- Add entity_id to audit_events (NOT NULL after data migration)
- Add entity_id to euaiact_entity_definitions (NOT NULL after data migration)
- Add entity_id to jira_configs (NOT NULL after data migration)
```

**Migration 2: Add entity_id to Project-Dependent Tables**
```python
# Create migration: add_entity_id_to_project_tables
- Add entity_id to assessments (via project relationship)
- Add entity_id to pillar_overrides (via project relationship)
- Add entity_id to project_translations (via project relationship)
- Add entity_id to project_pillar_scores (via project relationship)
```

**Migration 3: Add entity_id to Control & Evidence Tables**
```python
# Create migration: add_entity_id_to_control_evidence_tables
- Add entity_id to control_values (via project relationship)
- Add entity_id to control_values_history (via project relationship)
- Add entity_id to evidence (via project relationship)
- Add entity_id to evidence_audit (via evidence relationship)
```

**Migration 4: Add entity_id to Provenance Tables**
```python
# Create migration: add_entity_id_to_provenance_tables
- Add entity_id to provenance_artifacts (via project relationship)
- Add entity_id to provenance_datasets (via project relationship)
- Add entity_id to provenance_models (via project relationship)
- Add entity_id to provenance_evidence (via project relationship)
- Add entity_id to provenance_lineage (via project relationship)
- Add entity_id to provenance_evaluations (via project relationship)
- Add entity_id to provenance_manifest_facts (via project relationship)
- Add entity_id to provenance_audit (complex - needs lookup logic)
```

**Migration 5: Add entity_id to Trust & Evaluation Tables**
```python
# Create migration: add_entity_id_to_trust_tables
- Add entity_id to trust_evaluations (via project relationship)
- Add entity_id to trust_evaluation_audit (via evaluation relationship)
- Add entity_id to trustmarks (via project relationship)
- Add entity_id to trust_monitoring_signals (via project relationship)
- Add entity_id to trust_decay_events (via project relationship)
```

**Migration 6: Add entity_id to Other Tables**
```python
# Create migration: add_entity_id_to_other_tables
- Add entity_id to llm_report_cache (via project relationship)
- Add entity_id to ai_system_registry (via project relationship)
- Add entity_id to policy_versions (via policy relationship)
- Add entity_id to policy_alerts (via policy relationship)
- Add entity_id to jira_sync_history (via config relationship)
```

**Migration 6a: Update Composite Keys for Caching/Derived Tables**
```python
# Create migration: update_composite_keys_for_cached_tables
- llm_report_cache: Update primary/composite key to (entity_id, project_slug, provider)
  - Drop old unique constraint on (project_slug, provider) if exists
  - Add composite unique constraint: UNIQUE (entity_id, project_slug, provider)
- project_pillar_scores: Update primary key to (entity_id, project_id, pillar_key)
  - Drop old primary key (project_id, pillar_key)
  - Add composite primary key: PRIMARY KEY (entity_id, project_id, pillar_key)
- trustmarks: Update unique constraint to include entity_id
  - Drop old unique constraint if exists
  - Add composite unique constraint: UNIQUE (entity_id, project_id, project_slug, issued_at) or similar
- trust_evaluations: Update index to include entity_id
  - Drop old index on (project_slug, evaluated_at)
  - Add composite index: INDEX (entity_id, project_slug, evaluated_at)
```

**Migration 7: Create Indexes & Update Composite Keys**
```python
# Create migration: add_entity_id_indexes_and_composite_keys
- Create indexes on entity_id for all tables that have it
- Composite indexes where entity_id + other key columns are frequently queried together
- Examples:
  - CREATE INDEX idx_entity_projects_entity_id ON entity_projects(entity_id)
  - CREATE INDEX idx_control_values_entity_project ON control_values(entity_id, project_slug)
  - CREATE INDEX idx_evidence_entity_project ON evidence(entity_id, project_slug)
  - CREATE INDEX idx_llm_report_cache_entity_project ON llm_report_cache(entity_id, project_slug, provider)
  - CREATE INDEX idx_project_pillar_scores_entity_project ON project_pillar_scores(entity_id, project_id, pillar_key)
  - CREATE INDEX idx_trust_evaluations_entity_project ON trust_evaluations(entity_id, project_slug, evaluated_at)
  - CREATE INDEX idx_trustmarks_entity_project ON trustmarks(entity_id, project_id, issued_at)
```

**Migration 8: Update Foreign Key Constraints**
```python
# Create migration: update_fk_constraints_for_entity_id
- Add FOREIGN KEY constraints for all entity_id columns
- Set appropriate ON DELETE behavior (likely CASCADE for dependent tables)
```

**Migration 9: Data Migration (Backfill entity_id)**
```python
# Create migration: backfill_entity_id_values
- For existing data, assign all records to a default entity (or create one)
- Use a data migration script to:
  1. Create a default entity if none exists
  2. Assign all existing projects to this default entity
  3. Backfill entity_id for all dependent tables via JOINs
- Make entity_id NOT NULL after backfill completes
```

**Migration 10: Update Unique Constraints & Drop Global Uniques**
```python
# Create migration: update_unique_constraints_for_multi_entity
- Drop old global unique indexes/constraints where slug/keys exist
- Add composite unique constraints including entity_id:
  - entity_projects: UNIQUE (entity_id, slug)
  - policies: UNIQUE (entity_id, title) or UNIQUE (entity_id, slug) if slug exists
  - aims_scope: UNIQUE (entity_id, scope_name) if scope_name is unique per entity
  - controls: UNIQUE (entity_id, kpi_key) if controls are per-entity
  - Any other tables with slug/key fields that should be unique per entity
- Keep global uniques for truly global/shared tables (pillars, kpis if global)
```

**Important:** Before dropping global unique constraints, ensure:
1. All entity_id values are backfilled
2. No duplicate slugs/keys exist within the same entity
3. Migration script validates uniqueness before applying constraints

---

## 2. Backend Code Changes

### 2.1 Models (SQLAlchemy)

**Files to Update:**
- `apps/core-svc/app/models.py`
- `apps/core-svc/app/leadai_models_reflected.py`

**Changes Required:**
- Add `entity_id: Mapped[UUID]` field to all entity-scoped models
- Update relationships to include entity filtering where appropriate
- Update `__table_args__` to include entity_id in unique constraints

### 2.2 API Routers

**Entity Context Injection:**

**✅ DECISION: Route Prefix (Option C) - Selected**

**Primary Method: Entity in URL Path**
- Path: `/entities/{entityId}/scorecard/...`
- Entity_id extracted from URL params in Next.js layouts
- All internal links include entity_id prefix
- Entity switching updates URL path

**Fallback Methods (for API calls and deep linking):**
- **X-Entity-ID Header:** For API clients and external integrations
- **Query Parameter:** For deep linking and testing (`?entity_id={uuid}`)

**Implementation Priority:**
1. Route prefix (primary - extracted from URL)
2. Query parameter (fallback for deep linking)
3. Header (for API clients)
4. Session/storage (temporary fallback during migration only)

**Files Requiring Updates:**

**2.2.1 Core Routers:**
- `apps/core-svc/app/routers/admin.py`
  - All endpoints need entity context
  - Add entity_id parameter/dependency to all routes
  - Filter queries by entity_id

- `apps/core-svc/app/routers/projects.py`
  - GET/POST/PATCH/DELETE projects - filter by entity_id
  - All project-related endpoints need entity context

- `apps/core-svc/app/routers/entity.py`
  - Add endpoint to get current user's entity
  - Add endpoint to list user's accessible entities
  - Add endpoint to switch entity context

**2.2.2 Evidence & Control Routers:**
- `apps/core-svc/app/routers/evidence.py`
  - Filter evidence by entity_id
  - Ensure evidence belongs to entity's projects

- `apps/core-svc/app/routers/kpidetail.py`
  - Filter control values by entity_id
  - Ensure KPIs/controls belong to entity

**2.2.3 Audit Routers:**
- `apps/core-svc/app/routers/audit.py`
  - Filter audit events by entity_id
  - Ensure audit events belong to entity

**2.2.4 Provenance Routers:**
- `apps/core-svc/app/routers/provenance_admin.py`
  - Filter all provenance data by entity_id
  - Ensure provenance belongs to entity's projects

**2.2.5 Trust & Evaluation Routers:**
- `apps/core-svc/app/routers/trust_axes.py`
  - Filter trust evaluations by entity_id
  - Ensure evaluations belong to entity's projects

- `apps/core-svc/app/routers/trust_provenance.py`
  - Filter provenance evaluations by entity_id

**2.2.6 Reporting Routers:**
- `apps/core-svc/app/routers/ai_reports.py`
  - Filter LLM reports by entity_id
  - Ensure reports belong to entity's projects

- `apps/core-svc/app/routers/reports.py`
  - Filter reports by entity_id

**2.2.7 Jira Integration:**
- `apps/core-svc/app/routers/jira.py`
  - Filter Jira configs by entity_id
  - Ensure syncs belong to entity
  - Map Jira projects to entity's projects
  - Tag Jira-synced evidence with entity_id

**2.2.9 MCP Server Integration:**
- `apps/mcp/src/server.ts`
  - Add entity_id context to MCP tool calls
  - Filter document ingestion by entity_id (if documents are entity-scoped)
  - Include entity_id in Qdrant vector payloads for entity-scoped documents
  - Update `ingest.upsert` tool to accept optional entity_id parameter
  - Update `retriever.search` to filter by entity_id in metadata
  - Update `chat.answer` to include entity context in queries

**2.2.10 Chatbot Integration:**
- `apps/leadai-chatbot` (if separate service)
  - Filter database queries by entity_id
  - Include entity_id in PostgreSQL FTS queries
  - Filter pgvector searches by entity_id metadata
  - Update chatbot ingestion (`leadai-chatbot-ingest`) to tag vectors with entity_id
  - Ensure chatbot responses are scoped to current entity
  - Update chatbot API endpoints to accept entity_id parameter

**2.2.8 AI Legal Standing:**
- `apps/core-svc/app/routers/ai_legal_standing.py`
  - Associate assessments with entity_id
  - Filter assessments by entity_id

### 2.3 Services

**Files Requiring Updates:**

- `apps/core-svc/app/services/scorecard_read.py`
  - Filter scorecard data by entity_id
  - Ensure projects belong to entity

- `apps/core-svc/app/services/audit_log.py`
  - Include entity_id in audit events
  - Filter audit queries by entity_id

- `apps/core-svc/app/services/llm_report_cache.py`
  - Filter cache by entity_id
  - Ensure reports belong to entity's projects

- `apps/core-svc/app/services/llm_report_batch.py`
  - Filter batch jobs by entity_id
  - Process reports per entity

- `apps/core-svc/app/services/ai_project_report.py`
  - Filter reports by entity_id

- `apps/core-svc/app/services/provenance_manifest_builder.py`
  - Include entity_id in manifest
  - Filter provenance data by entity_id

- `apps/core-svc/app/services/provenance_manifest_batch.py`
  - Filter batch processing by entity_id

- `apps/core-svc/app/services/policy_alerts.py`
  - Filter alerts by entity_id
  - Ensure policies belong to entity

- `apps/core-svc/app/services/jira_mapper.py`
  - Include entity_id in mappings
  - Filter mappings by entity_id
  - Tag Jira-synced evidence with entity_id

**MCP & Chatbot Services:**
- `apps/mcp/src/server.ts`
  - Add entity_id to document metadata in Qdrant
  - Filter vector searches by entity_id
  - Include entity_id in ingestion payloads
  - Update retriever to respect entity context

- `apps/leadai-chatbot` (chatbot service)
  - Filter PostgreSQL FTS queries by entity_id
  - Filter pgvector searches by entity_id
  - Include entity_id in chatbot context
  - Update ingestion script to tag vectors with entity_id

- `apps/leadai-chatbot-ingest` (ingestion worker)
  - Tag all ingested vectors with entity_id metadata
  - Filter ingestion by entity_id if needed
  - Update vector payloads to include entity_id

- `apps/core-svc/app/guardrails_engine.py`
  - Filter guardrail evaluations by entity_id
  - Ensure rules belong to entity (if per-entity)

### 2.4 Dependency Injection & Context

**New Files to Create:**
- `apps/core-svc/app/dependencies.py` (or update existing)
  - Create `get_current_entity()` dependency
  - Create `get_entity_context()` dependency
  - Handle entity switching logic
  - Validate user has access to entity

**Changes Required:**
- Add entity context middleware/dependency to FastAPI app
- Update all route handlers to include entity dependency
- Ensure entity_id is extracted from:
  - JWT token (user's default entity)
  - Query parameter (?entity_id=...)
  - Header (X-Entity-ID)
  - Session storage (for web frontend)

### 2.5 Database Queries

**Pattern Changes Required:**
- All SELECT queries must include `WHERE entity_id = :entity_id`
- All INSERT queries must include `entity_id` value
- All UPDATE queries must include `WHERE entity_id = :entity_id`
- All DELETE queries must include `WHERE entity_id = :entity_id`
- JOIN queries must filter by entity_id at appropriate level

**Example Pattern:**
```python
# Before
SELECT * FROM projects WHERE slug = :slug

# After
SELECT * FROM entity_projects WHERE entity_id = :entity_id AND slug = :slug
```

### 2.6 Background Jobs & Scheduled Tasks

**Files Requiring Updates:**

- `apps/core-svc/app/main.py`
  - `_llm_report_batch_scheduler()` - Filter projects by entity_id
  - `_kpi_recompute_scheduler()` - Filter projects by entity_id
  - `_provenance_manifest_scheduler()` - Filter projects by entity_id
  - Update all batch functions to process per-entity

- `apps/core-svc/app/services/llm_report_batch.py`
  - `batch_generate_reports()` - Add entity_id parameter
  - `get_all_projects()` - Filter by entity_id
  - `get_projects_needing_reports()` - Filter by entity_id
  - Process reports per entity, not globally

- `apps/core-svc/app/services/provenance_manifest_batch.py`
  - `batch_build_manifests()` - Add entity_id parameter
  - Filter projects by entity_id
  - Process manifests per entity

- `apps/core-svc/app/score_engine.py`
  - `recompute_all()` - Add entity_id parameter
  - Filter KPI recomputation by entity_id
  - Process per entity

- `apps/core-svc/app/workers/alert_worker.py`
  - Filter alerts by entity_id
  - Process policy alerts per entity
  - Ensure alerts belong to entity's policies

- `apps/reg-svc/app/celery_app.py` (if exists)
  - Update trust decay queue processing to filter by entity_id
  - Process trust signals per entity

**Changes Required:**
- All batch jobs must iterate over entities first, then process projects within each entity
- Scheduled tasks should run per entity (or process all entities in sequence)
- Background workers must include entity context in all queries
- Cache keys must include entity_id to prevent cross-entity cache poisoning

**Pattern:**
```python
# Before
async def batch_generate_reports():
    projects = get_all_projects()  # Gets ALL projects globally
    for project in projects:
        generate_report(project)

# After
async def batch_generate_reports(entity_id: Optional[UUID] = None):
    entities = get_entities(entity_id) if entity_id else get_all_entities()
    for entity in entities:
        projects = get_projects_by_entity(entity.id)
        for project in projects:
            generate_report(project, entity_id=entity.id)
```

### 2.7 Observability & Logging

**Files Requiring Updates:**

- `apps/core-svc/app/main.py`
  - Add entity_id to all log statements
  - Include entity_id in error responses
  - Add entity_id to request context middleware

- `apps/core-svc/app/services/audit_log.py`
  - Ensure all audit events include entity_id
  - Filter audit queries by entity_id
  - Include entity_id in audit log metadata

- All service files
  - Add entity_id to log statements
  - Include entity_id in error messages
  - Add entity_id to structured logging (JSON logs)

- Background workers
  - Include entity_id in worker logs
  - Tag worker execution with entity_id
  - Include entity_id in batch job summaries

**Changes Required:**
- All log statements should include `entity_id` context
- Structured logging (JSON) should include `entity_id` field
- Error responses should include `entity_id` for debugging
- Monitoring/metrics should be tagged with `entity_id`
- Log aggregation should support filtering by `entity_id`
- Avoid cross-entity log confusion by always including entity context

**Pattern:**
```python
# Before
logger.info(f"Processing project {project_slug}")

# After
logger.info(f"Processing project {project_slug} for entity {entity_id}", 
            extra={"entity_id": str(entity_id), "project_slug": project_slug})
```

**Monitoring & Metrics:**
- Tag all metrics with `entity_id` label
- Dashboard filters by entity_id
- Alert rules should include entity_id context
- Performance metrics per entity

### 2.8 Validation & Authorization

**New Functions Required:**
- `validate_entity_access(user_id, entity_id)` - Check user can access entity
- `get_user_entities(user_id)` - List entities user has access to
- `ensure_entity_context(entity_id)` - Set entity context for request

**Files to Update:**
- All routers need entity validation
- Add entity access checks before data operations

---

## 3. Frontend Changes

### 3.1 New Pages & Components

**New Pages to Create:**

1. **Entity Management Page** (`/admin/entities` or `/entities`)
   - **Purpose:** List, create, edit, and manage entities
   - **Route:** `/admin/entities` (admin-only)
   - **Features:**
     - List all entities user has access to
     - Create new entity (if user has permission)
     - Edit entity details (name, slug, status, owner, etc.)
     - View entity statistics (project count, user count, last activity, etc.)
     - Switch/select active entity
     - Set entity status (active/inactive)
     - Assign entity owners
   - **Components:**
     - Entity list table with filters and search
     - Entity creation form/modal
     - Entity edit form/modal
     - Entity status toggle
     - Link to user access management per entity

2. **User-Entity Access Management Page** (`/admin/entities/[entityId]/users`)
   - **Purpose:** Manage which users can access which entities
   - **Route:** `/admin/entities/[entityId]/users` (admin-only)
   - **Features:**
     - List all users with access to the entity
     - Add users to entity (search/select users)
     - Remove users from entity
     - Assign roles per user-entity relationship (admin, editor, viewer)
     - View user permissions per entity
     - Bulk user management (add/remove multiple users)
   - **Components:**
     - User list table (filtered by entity)
     - User search/selector component
     - Role assignment dropdown
     - Add/remove user buttons
     - Permission matrix view (optional)

3. **Entity Overview / Landing Page** (`/entities/[entityId]/overview`)
   - **Purpose:** Single entry point for entity-scoped governance
   - **Route:** `/entities/[entityId]/overview`
   - **Features:**
     - Entity summary dashboard
     - Quick stats: project count, user count, trust score, compliance status
     - Recent activity feed
     - Quick links to:
       - Projects
       - Governance setup
       - Data manager
       - Reports
       - Settings
     - Entity status indicator
     - Entity information card
   - **Components:**
     - Entity summary cards
     - Activity feed component
     - Quick navigation grid
     - Entity info panel

4. **Entity Settings Page** (`/entities/[entityId]/settings`)
   - **Purpose:** Entity-specific configuration and settings
   - **Route:** `/entities/[entityId]/settings`
   - **Features:**
     - Entity profile information display/edit
     - Entity branding/logo upload
     - Entity-specific settings (language, timezone, date format)
     - Integration configurations (Jira, etc.) per entity
     - Entity-level permissions overview
     - Entity deletion (if admin)

**New Components to Create:**

1. **EntitySelector Component** (`apps/web/src/app/(components)/EntitySelector.tsx`)
   - **Purpose:** Global entity switcher/selector
   - **Placement:** Top-right dropdown in header (always visible when logged in)
   - **Features:**
     - Dropdown/select showing current entity
     - List of accessible entities
     - Entity name, logo/icon display
     - Quick switch functionality
     - Badge showing entity count
     - Visual indicator of current entity
     - "Manage Entities" link (if user has admin permission)
   - **Behavior:**
     - **Required before accessing governance dashboards** - Shows modal/page if no entity selected
     - Blocks access to `/entities/[entityId]/scorecard/...` routes if no entity selected
     - Updates URL path when entity switched
     - Persists selection in localStorage (fallback)

2. **EntityContext Provider** (`apps/web/src/app/(components)/EntityContext.tsx`)
   - **Purpose:** React context for entity state management
   - **Features:**
     - Current entity state
     - Entity switching logic
     - Entity persistence (localStorage/sessionStorage)
     - Entity validation (check user access)
     - Entity loading states
   - **Usage:** Wrap app with provider, accessible via hook

3. **EntityBreadcrumb Component** (optional)
   - **Purpose:** Show entity context in breadcrumbs
   - **Features:**
     - Display current entity name in breadcrumb trail
     - Link to entity management

4. **EntityGuard Component** (optional)
   - **Purpose:** Protect routes/components that require entity context
   - **Features:**
     - Redirect to entity selection if no entity selected
     - Show loading state while entity loads
     - Validate entity access

### 3.2 Entity Selection & Context

**New Components to Create:**
- `apps/web/src/app/(components)/EntitySelector.tsx`
  - Dropdown/selector for switching entities
  - Display current entity name/logo
  - Show entity count/badge

- `apps/web/src/app/(components)/EntityContext.tsx`
  - Context provider for current entity
  - Store entity_id in localStorage/sessionStorage
  - Provide entity switching functionality

**Files to Update:**
- `apps/web/src/app/layout.tsx`
  - Add EntitySelector to header/navigation
  - Initialize entity context

- `apps/web/src/app/(components)/Header.tsx`
  - Add entity selector to header
  - Display current entity information

- `apps/web/src/app/(components)/AdminSidebar.tsx`
  - Filter navigation by entity context
  - Show entity-specific menu items

### 3.2 API Client Updates

**Files to Update:**
- `apps/web/src/lib/evidenceClient.ts`
  - Add entity_id to all API calls
  - Include entity context in requests

- All API route handlers in `apps/web/src/app/api/`
  - Pass entity_id to backend API calls
  - Extract entity_id from context/query params

### 3.3 Evidence Storage (S3/MinIO) Updates

**Files Requiring Updates:**
- Evidence upload handlers
- Evidence retrieval handlers
- Evidence storage service

**Changes Required:**
- Update S3/MinIO key prefixes to include entity_id:
  - **Before:** `evidence/{project_slug}/{filename}`
  - **After:** `evidence/{entity_id}/{project_slug}/{filename}`
- Update evidence upload endpoints to include entity_id in path
- Update evidence download endpoints to validate entity_id matches
- Migration script to reorganize existing files (if needed):
  - List all existing evidence files
  - Determine entity_id from evidence table
  - Move files to new path structure
  - Update database records with new paths

**Security:** Ensure evidence access validates entity_id to prevent cross-entity file access.

### 3.4 Navigation & Layout Updates

**Files Requiring Updates:**

- `apps/web/src/app/layout.tsx` (Root Layout)
  - Wrap app with EntityContext provider
  - Add EntitySelector to header/navigation
  - Initialize entity from URL path on mount
  - Handle entity switching via URL updates
  - Extract entity_id from URL using Next.js dynamic routes

- `apps/web/src/app/(components)/Header.tsx`
  - Add EntitySelector component
  - Display current entity name/badge (from URL)
  - Show entity switching UI (updates URL)
  - Include entity context in header
  - Extract entity_id from current route

- `apps/web/src/app/(components)/AdminSidebar.tsx`
  - Filter navigation items by entity context
  - Show entity-specific menu items
  - Highlight current entity (from URL)
  - Add entity management link (if user has permission)
  - Update all navigation links to include entity_id prefix

- `apps/web/src/app/(components)/LandingSidebar.tsx`
  - Add entity selector if user is logged in
  - Show entity context
  - Update links to include entity_id when available

- `apps/web/src/app/scorecard/admin/layout.tsx` (Admin Layout)
  - Add EntitySelector
  - Extract entity_id from URL: `/entities/[entityId]/scorecard/admin/...`
  - Ensure entity context is available
  - Handle entity switching via URL navigation
  - Redirect to entity selection if entity_id missing

- `apps/web/src/app/scorecard/[projectId]/layout.tsx` (Project Layout)
  - Extract entity_id from URL: `/entities/[entityId]/scorecard/[projectId]/...`
  - Validate project belongs to current entity
  - Show entity context
  - Redirect if project belongs to different entity
  - Redirect if entity_id missing from URL

**URL Routing Changes:**

**✅ DECISION: Option A - Entity in URL Path (Selected)**

**New Route Structure:**
```
/entities/[entityId]/scorecard/admin/governance-setup
/entities/[entityId]/scorecard/admin/governance-setup/entity-setup
/entities/[entityId]/scorecard/admin/governance-setup/ai-project-register
/entities/[entityId]/scorecard/admin/data-manager
/entities/[entityId]/scorecard/admin/data-manager/evidence
/entities/[entityId]/scorecard/[projectId]/dashboard
/entities/[entityId]/scorecard/[projectId]/report
/entities/[entityId]/scorecard/[projectId]/kpis/[kpiKey]
/entities/[entityId]/scorecard/[projectId]/pillars/[pillarKey]
```

**Public Routes (No Entity Required):**
```
/ (home)
/register
/ai_legal_standing
/aireadinesscheck
/entity (entity registration/selection)
/entities (entity management - requires auth)
/entities/[entityId]/settings (entity settings)
```

**Implementation Steps:**

1. **Create Route Group Structure:**
   ```
   apps/web/src/app/
   ├── entities/
   │   └── [entityId]/
   │       ├── scorecard/
   │       │   ├── admin/
   │       │   │   ├── governance-setup/
   │       │   │   ├── data-manager/
   │       │   │   └── ...
   │       │   └── [projectId]/
   │       │       ├── dashboard/
   │       │       ├── report/
   │       │       └── ...
   │       └── settings/
   │           └── page.tsx
   └── (existing routes for public pages)
   ```

2. **Update Next.js Routing:**
   - Move scorecard routes under `entities/[entityId]/scorecard/`
   - Create layout at `entities/[entityId]/layout.tsx` to extract entity_id
   - Create layout at `entities/[entityId]/scorecard/layout.tsx` for scorecard routes
   - Update all internal links to include entity_id prefix

3. **Middleware/Route Handler:**
   - Extract `entityId` from URL params
   - Validate entity exists and user has access
   - Set entity context from URL
   - Redirect to entity selection if entity_id invalid/missing

4. **Link Updates:**
   ```tsx
   // Before
   <Link href="/scorecard/admin/governance-setup">Governance Setup</Link>
   
   // After
   <Link href={`/entities/${entityId}/scorecard/admin/governance-setup`}>
     Governance Setup
   </Link>
   ```

5. **Router.push() Updates:**
   ```tsx
   // Before
   router.push("/scorecard/admin/governance-setup");
   
   // After
   router.push(`/entities/${entityId}/scorecard/admin/governance-setup`);
   ```

6. **Entity Switching:**
   ```tsx
   // When user switches entity
   const switchEntity = (newEntityId: string) => {
     const currentPath = router.asPath;
     // Replace entity_id in current path
     const newPath = currentPath.replace(
       /^\/entities\/[^/]+/,
       `/entities/${newEntityId}`
     );
     router.push(newPath);
   };
   ```

**Benefits:**
- ✅ Explicit entity context in URL
- ✅ Bookmarkable/shareable URLs
- ✅ Clear entity context for users
- ✅ Better for debugging (entity visible in URL)
- ✅ Works with browser back/forward
- ✅ SEO-friendly (if pages become public)

**Migration Path:**
1. Create new route structure alongside existing routes
2. Add redirects from old routes to new routes (with default entity)
3. Update all links gradually
4. Remove old routes after full migration

### 3.5 MCP & Chatbot Integration Updates

**Files Requiring Updates:**

- `apps/web/src/app/leadai-chatbot/page.tsx`
  - Include entity_id in chatbot API calls
  - Filter chatbot context by entity_id
  - Pass entity_id to MCP server requests

- `apps/web/src/app/leadai-chatbot/retrieval/route.ts`
  - Include entity_id in retrieval requests
  - Filter results by entity_id

- MCP server endpoints (if exposed via web)
  - Accept entity_id parameter
  - Filter document searches by entity_id
  - Include entity_id in vector search metadata

**Changes Required:**
- Chatbot queries must include entity_id context
- MCP ingestion should tag documents with entity_id
- Vector searches (Qdrant/pgvector) must filter by entity_id metadata
- Chatbot responses should be scoped to entity's data only

### 3.6 Component Updates

**Components Requiring Updates:**

**Data Display Components:**
- `apps/web/src/app/(components)/ProjectRegisterPage.tsx`
  - Include entity_id when creating projects
  - Filter project list by entity
  - Show entity context

- `apps/web/src/app/(components)/EditKpis.tsx`
  - Filter KPIs by entity (if per-entity)
  - Include entity_id in KPI operations

- `apps/web/src/app/(components)/EditPillars.tsx`
  - Filter pillars by entity (if per-entity)
  - Include entity_id in pillar operations

- `apps/web/src/app/(components)/ControlValuesTable.tsx`
  - Filter control values by entity
  - Include entity_id in updates

- `apps/web/src/app/(components)/AuditLogPageClient.tsx`
  - Filter audit logs by entity
  - Include entity_id in queries

- `apps/web/src/app/(components)/JiraInterfacesClient.tsx`
  - Filter Jira configs by entity
  - Include entity_id in sync operations

- `apps/web/src/app/(components)/ChatbotWidget.tsx`
  - Include entity_id in chatbot queries
  - Filter chatbot context by entity

**Dashboard Components:**
- `apps/web/src/app/(components)/DashboardHeader.tsx`
  - Show entity context
  - Include entity selector

- `apps/web/src/app/(components)/DashboardShell.tsx`
  - Include entity context
  - Filter dashboard data by entity

- `apps/web/src/app/(components)/PillarBar.tsx`
  - Filter pillars by entity (if per-entity)
  - Show entity context

- `apps/web/src/app/(components)/KpiTable.tsx`
  - Filter KPIs by entity (if per-entity)
  - Include entity_id in queries

**Form Components:**
- All creation forms (project, policy, evidence, etc.)
  - Auto-include current entity_id
  - Show entity context
  - Validate entity access

### 3.7 User Experience Flow

**New User Flow:**
1. **First Login:**
   - User logs in → Check: Does user have entities?
     - **No entities:** Redirect to entity creation or show error
     - **Single entity:** Auto-select, redirect to `/entities/{entityId}/overview`
     - **Multiple entities:** Show entity selector modal/page, **must select before accessing governance dashboards**
   - After selection → Redirect to `/entities/{entityId}/overview` (entity landing)

2. **Entity Selection:**
   - User selects entity → Entity context set, URL updated to `/entities/{entityId}/...`
   - Redirected to entity overview or dashboard

3. **Navigation:**
   - All pages show entity context (from URL)
   - All data filtered by entity
   - Entity selector visible globally (top-right)

4. **Entity Switching:**
   - User clicks EntitySelector dropdown
   - Selects new entity → URL updated, **dashboards & data update immediately**
   - Current page refreshes with new entity's data
   - Browser history preserved

5. **Creating Resources:**
   - User creates project → Project automatically assigned to current entity (from URL)
   - All forms auto-include entity_id from URL context

**Entity Selector Behavior:**
- **Required before accessing governance dashboards:** Blocks access to `/entities/[entityId]/scorecard/...` if no entity selected
- **Visible globally:** Always shown in header when user is logged in
- **Immediate updates:** When switching entities, all dashboards and data update immediately (no page reload needed if using React state)

**Entity Selection Flow:**
1. If user has only one entity → Auto-select, no selector shown
2. If user has multiple entities → Show selector, allow switching
3. If user has no entities → Redirect to entity creation or show error
4. If entity not selected → Show entity selector modal/page, block access

**Entity Creation Flow:**
1. User clicks "Create Entity" → Entity creation form
2. User fills form → Submit creates entity
3. User automatically assigned to new entity → Redirect to entity setup
4. Entity becomes current context → User can start using it

### 3.8 Visual Design Changes

**UI Elements to Add:**
- Entity badge/indicator in header (shows current entity name)
- Entity selector dropdown (shows list of accessible entities)
- Entity context breadcrumb (shows entity in navigation trail)
- Entity filter badges (on filtered pages, show "Filtered by: Entity Name")
- Entity switching animation/transition (smooth context switch)

**UI Elements to Update:**
- Header: Add entity selector, show entity name
- Sidebar: Highlight current entity, filter menu items
- Page titles: Include entity context (e.g., "Projects - Entity Name")
- Data tables: Show entity filter indicator
- Forms: Show entity context, auto-include entity_id

**Accessibility:**
- Entity selector keyboard navigation
- Screen reader announcements for entity switching
- ARIA labels for entity context
- Focus management during entity switching

**Pages Requiring Updates:**

**3.2.1 Landing/Home Pages:**
- `apps/web/src/app/page.tsx` (Home/Landing)
  - Add entity selector if user is logged in
  - Show entity context in navigation
  - Filter featured content by entity (if applicable)

**3.2.2 Admin Pages:**

- `apps/web/src/app/scorecard/admin/page.tsx` (Admin Dashboard)
  - Add entity selector to header
  - Filter all admin data by entity
  - Show entity context badge/indicator

- `apps/web/src/app/scorecard/admin/governance-setup/page.tsx` (Governance Setup Landing)
  - Filter projects by entity
  - Show entity context
  - Entity selector in header

- `apps/web/src/app/scorecard/admin/governance-setup/entity-setup/page.tsx` (Entity Setup)
  - **IMPORTANT:** This page should show/edit the CURRENT entity's setup
  - Filter by current entity (not all entities)
  - Ensure user can only edit their accessible entities
  - Show entity name/badge at top
  - Add link to entity management if user has permission

- `apps/web/src/app/scorecard/admin/governance-setup/ai-project-register/page.tsx` (Project Register)
  - Create projects within current entity context
  - Auto-assign new projects to current entity
  - Filter project list by entity
  - Show entity context

- `apps/web/src/app/scorecard/admin/governance-setup/ai-policy-register/page.tsx` (Policy Register)
  - Create policies within current entity
  - Filter policies by entity
  - Show entity context

- `apps/web/src/app/scorecard/admin/governance-setup/aims-scope/page.tsx` (AIMS Scope)
  - Filter AIMS scope by entity
  - Create/edit AIMS scope for current entity
  - Show entity context

- `apps/web/src/app/scorecard/admin/data-manager/page.tsx` (Data Manager)
  - Filter all data by entity
  - Show entity context in UI
  - Entity selector in header

- `apps/web/src/app/scorecard/admin/data-manager/evidence/page.tsx` (Evidence Manager)
  - Filter evidence by entity
  - Upload evidence to current entity's projects
  - Show entity context

- `apps/web/src/app/scorecard/admin/data-manager/provenance/page.tsx` (Provenance Manager)
  - Filter provenance data by entity
  - Show entity context

- `apps/web/src/app/scorecard/admin/data-manager/trust-axes/page.tsx` (Trust Axes)
  - Filter trust evaluations by entity
  - Show entity context

- `apps/web/src/app/scorecard/admin/data-manager/trustmarks/page.tsx` (Trustmarks)
  - Filter trustmarks by entity
  - Show entity context

- `apps/web/src/app/scorecard/admin/data-manager/interfaces/page.tsx` (Interfaces/Jira)
  - Filter Jira configs by entity
  - Create Jira configs for current entity
  - Show entity context

- `apps/web/src/app/scorecard/admin/data-register/page.tsx` (Data Register)
  - Filter register by entity
  - Ensure data belongs to entity
  - Show entity context

- `apps/web/src/app/scorecard/admin/control-audit/page.tsx` (Control Audit)
  - Filter audit data by entity
  - Show entity context

- `apps/web/src/app/scorecard/admin/control-audit/evidence/page.tsx` (Evidence Audit)
  - Filter evidence audit by entity
  - Show entity context

- `apps/web/src/app/scorecard/admin/knowledgebase/page.tsx` (Knowledge Base)
  - **DECISION:** If KPIs/pillars are global, no filtering needed
  - If per-entity, filter by entity
  - Show entity context

- `apps/web/src/app/scorecard/admin/governance-dashboard-reporting/page.tsx` (Dashboard Reporting)
  - Filter reports by entity
  - Show entity context

- `apps/web/src/app/scorecard/admin/governance-execution/page.tsx` (Governance Execution)
  - Filter execution data by entity
  - Show entity context

- `apps/web/src/app/scorecard/admin/trustops/page.tsx` (TrustOps)
  - Filter trust operations by entity
  - Show entity context

**3.2.3 Project Pages:**

- `apps/web/src/app/scorecard/[projectId]/page.tsx` (Project Overview)
  - Validate project belongs to current entity
  - Redirect to 404/403 if project belongs to different entity
  - Show entity context

- `apps/web/src/app/scorecard/[projectId]/dashboard/page.tsx` (Project Dashboard)
  - Ensure project belongs to current entity
  - Filter dashboard data by entity
  - Show entity context

- `apps/web/src/app/scorecard/[projectId]/dashboard/kpis_admin/page.tsx` (KPI Admin)
  - Filter KPIs by entity (if per-entity)
  - Show entity context

- `apps/web/src/app/scorecard/[projectId]/dashboard/pillars_admin/page.tsx` (Pillars Admin)
  - Filter pillars by entity (if per-entity)
  - Show entity context

- `apps/web/src/app/scorecard/[projectId]/kpis/[kpiKey]/page.tsx` (KPI Detail)
  - Ensure KPI belongs to entity
  - Filter control values by entity
  - Show entity context

- `apps/web/src/app/scorecard/[projectId]/pillars/[pillarKey]/page.tsx` (Pillar Detail)
  - Ensure pillar belongs to entity
  - Show entity context

- `apps/web/src/app/scorecard/[projectId]/report/page.tsx` (Project Report)
  - Filter reports by entity
  - Ensure report belongs to entity's project
  - Show entity context

- `apps/web/src/app/scorecard/[projectId]/vipdashboard/page.tsx` (VIP Dashboard)
  - Filter by entity
  - Show entity context

**3.2.4 Entity Pages:**

- `apps/web/src/app/entity/page.tsx` (Entity Landing/Registration)
  - **UPDATE:** After entity creation, assign to creating user
  - Show list of entities user has access to
  - Allow entity creation (if user has permission)
  - Link to entity management page
  - After creation, redirect to entity setup or switch to new entity

**3.2.5 Other Pages:**

- `apps/web/src/app/ai_legal_standing/page.tsx` (AI Legal Standing)
  - Associate assessment with current entity
  - Filter assessments by entity
  - Show entity context

- `apps/web/src/app/leadai-chatbot/page.tsx` (Chatbot)
  - Include entity_id in chatbot queries
  - Filter chatbot context by entity
  - Show entity context

- `apps/web/src/app/projects/register/page.tsx` (Project Registration)
  - Create projects within current entity
  - Auto-assign to current entity
  - Show entity context

- `apps/web/src/app/register/page.tsx` (User Registration)
  - **UPDATE:** After registration, assign user to default entity or allow entity selection
  - Show entity selection during registration (optional)

### 3.4 State Management

**Changes Required:**
- Add entity state to global state management
- Update all API calls to include entity_id
- Update all data fetching to filter by entity
- Update URL routing to include entity context (optional)

### 3.5 Routing

**✅ DECISION: Option A - Entity in URL Path (Selected)**

**Route Structure:**
- All scorecard/admin routes: `/entities/[entityId]/scorecard/admin/...`
- All project routes: `/entities/[entityId]/scorecard/[projectId]/...`
- Entity management: `/entities` and `/entities/[entityId]/settings`
- Public routes (no entity): `/`, `/register`, `/ai_legal_standing`, `/entity`

**Implementation:**
- Move all scorecard routes under `entities/[entityId]/scorecard/` directory structure
- Extract entity_id from URL params in Next.js layouts
- Update all internal links to include entity_id prefix
- Add redirects from old routes to new routes (with default entity during migration)
- Entity switching updates URL path
- Create layout at `entities/[entityId]/layout.tsx` to extract and validate entity_id

**Benefits:**
- ✅ Explicit entity context in URL
- ✅ Bookmarkable/shareable URLs
- ✅ Clear entity context
- ✅ Works with browser navigation
- ✅ Better for debugging and support

---

## 4. Authentication & Authorization

### 4.1 User-Entity Relationship

**New Table Required:**
- `user_entity_access` or `entity_users`
  - `user_id UUID` (FK to users table)
  - `entity_id UUID` (FK to entity.id)
  - `role TEXT` (admin, viewer, editor, etc.)
  - `granted_at TIMESTAMP`
  - `granted_by UUID` (FK to users)
  - Unique constraint: (user_id, entity_id)

**Migration Required:**
- Create `user_entity_access` table
- Migrate existing users to have access to default entity
- Set appropriate roles (likely all as admin for migration)

### 4.2 JWT Token Updates

**Changes Required:**
- Add `entity_id` to JWT token claims
- Add `accessible_entity_ids` array to JWT token
- Update token generation to include entity context
- Update token validation to check entity access

**Files to Update:**
- NextAuth configuration
- JWT token generation logic
- Token validation middleware

### 4.3 Authorization Logic

**New Functions Required:**
- `can_user_access_entity(user_id, entity_id)` - Check access
- `get_user_entity_role(user_id, entity_id)` - Get user's role in entity
- `require_entity_access(entity_id)` - Middleware/decorator

**Files to Update:**
- All protected routes need entity access checks
- Admin routes need entity admin role checks
- Update permission checks to include entity context

### 4.4 Session Management

**Changes Required:**
- Store current `entity_id` in session
- Allow users to switch entities (if they have access)
- Persist entity selection across sessions
- Default to user's primary entity on login

---

## 5. Data Migration Strategy

### 5.1 Pre-Migration Steps

1. **Backup Database**
   - Full database backup before starting
   - Test restore procedure

2. **Create Default Entity**
   - Create a default entity for existing data
   - Name it appropriately (e.g., "Legacy Entity" or company name)

3. **Identify Data Ownership**
   - Determine which user/entity owns existing data
   - Document data mapping strategy

### 5.2 Migration Scripts

**Script 1: Backfill entity_id for Projects**
```sql
-- Assign all existing projects to default entity
UPDATE entity_projects 
SET entity_id = (SELECT id FROM entity WHERE full_legal_name = 'Default Entity' LIMIT 1)
WHERE entity_id IS NULL;
```

**Script 2: Backfill entity_id for Project-Dependent Tables**
```sql
-- Backfill via project relationship
UPDATE assessments a
SET entity_id = p.entity_id
FROM entity_projects p
WHERE a.project_id = p.id AND a.entity_id IS NULL;

-- Repeat for: pillar_overrides, project_translations, project_pillar_scores
```

**Script 3: Backfill entity_id for Control & Evidence**
```sql
-- Backfill via project relationship
UPDATE control_values cv
SET entity_id = p.entity_id
FROM entity_projects p
WHERE cv.project_slug = p.slug AND cv.entity_id IS NULL;

-- Repeat for: control_values_history, evidence
```

**Script 4: Backfill entity_id for Provenance**
```sql
-- Backfill via project relationship
UPDATE provenance_artifacts pa
SET entity_id = p.entity_id
FROM entity_projects p
WHERE pa.project_slug = p.slug AND pa.entity_id IS NULL;

-- Repeat for all provenance tables
```

**Script 5: Backfill entity_id for Trust & Evaluation**
```sql
-- Backfill via project relationship
UPDATE trust_evaluations te
SET entity_id = p.entity_id
FROM entity_projects p
WHERE te.project_slug = p.slug AND te.entity_id IS NULL;

-- Repeat for: trustmarks, trust_monitoring_signals, trust_decay_events
```

**Script 6: Backfill entity_id for Other Tables**
```sql
-- Backfill llm_report_cache
UPDATE llm_report_cache lrc
SET entity_id = p.entity_id
FROM entity_projects p
WHERE lrc.project_slug = p.slug AND lrc.entity_id IS NULL;

-- Backfill policies (assign to default entity)
UPDATE policies
SET entity_id = (SELECT id FROM entity WHERE full_legal_name = 'Default Entity' LIMIT 1)
WHERE entity_id IS NULL;

-- Backfill aims_scope (assign to default entity)
UPDATE aims_scope
SET entity_id = (SELECT id FROM entity WHERE full_legal_name = 'Default Entity' LIMIT 1)
WHERE entity_id IS NULL;

-- Backfill audit_events (assign to default entity)
UPDATE audit_events
SET entity_id = (SELECT id FROM entity WHERE full_legal_name = 'Default Entity' LIMIT 1)
WHERE entity_id IS NULL;

-- Backfill ai_system_registry
UPDATE ai_system_registry asr
SET entity_id = p.entity_id
FROM entity_projects p
WHERE asr.project_slug = p.slug AND asr.entity_id IS NULL;

-- Backfill jira_configs (assign to default entity if no mapping exists)
UPDATE jira_configs
SET entity_id = (SELECT id FROM entity WHERE full_legal_name = 'Default Entity' LIMIT 1)
WHERE entity_id IS NULL;

-- Backfill jira_sync_history
UPDATE jira_sync_history jsh
SET entity_id = jc.entity_id
FROM jira_configs jc
WHERE jsh.config_id = jc.id AND jsh.entity_id IS NULL;

-- Backfill euaiact_entity_definitions (assign to default entity)
UPDATE euaiact_entity_definitions
SET entity_id = (SELECT id FROM entity WHERE full_legal_name = 'Default Entity' LIMIT 1)
WHERE entity_id IS NULL;

-- Repeat for: policy_versions, policy_alerts
```
```sql
-- Backfill llm_report_cache
UPDATE llm_report_cache lrc
SET entity_id = p.entity_id
FROM entity_projects p
WHERE lrc.project_slug = p.slug AND lrc.entity_id IS NULL;

-- Backfill policies (assign to default entity)
UPDATE policies
SET entity_id = (SELECT id FROM entity WHERE full_legal_name = 'Default Entity' LIMIT 1)
WHERE entity_id IS NULL;

-- Repeat for: aims_scope, audit_events, etc.
```

**Script 7: Validate Composite Uniqueness Before Constraint Changes**
```sql
-- Check for duplicate slugs within same entity (should be zero)
SELECT entity_id, slug, COUNT(*) as count
FROM entity_projects
GROUP BY entity_id, slug
HAVING COUNT(*) > 1;

-- Check for duplicate policy titles within same entity
SELECT entity_id, title, COUNT(*) as count
FROM policies
GROUP BY entity_id, title
HAVING COUNT(*) > 1;

-- Check for any other unique fields that will become composite unique
-- (Add checks for aims_scope.scope_name, controls.kpi_key if per-entity, etc.)
```

**Script 8: Validate Data Integrity**
```sql
-- Check for NULL entity_id values (should be zero)
SELECT 'entity_projects' as table_name, COUNT(*) as null_count
FROM entity_projects WHERE entity_id IS NULL
UNION ALL
SELECT 'control_values', COUNT(*) FROM control_values WHERE entity_id IS NULL
UNION ALL
-- ... repeat for all tables
```

**Script 9: Set NOT NULL Constraints**
```sql
-- After validation, set NOT NULL constraints
ALTER TABLE entity_projects ALTER COLUMN entity_id SET NOT NULL;
ALTER TABLE control_values ALTER COLUMN entity_id SET NOT NULL;
-- ... repeat for all tables
```

### 5.3 Post-Migration Validation

1. **Data Integrity Checks**
   - Verify all records have entity_id (no NULLs)
   - Verify foreign key relationships
   - Verify unique constraints work correctly
   - Verify composite uniqueness: no duplicate slugs/keys within same entity
   - Verify cross-entity data isolation (no entity_id mismatches in JOINs)

2. **Functional Testing**
   - Test entity switching
   - Test data isolation (create data in Entity A, verify not visible in Entity B)
   - Test cross-entity access prevention (403 errors)
   - Test entity-scoped queries return correct data
   - Test background jobs process correct entities

3. **Performance Testing**
   - Test query performance with new indexes
   - Test entity filtering performance
   - Test composite index usage
   - Optimize slow queries
   - Verify no N+1 query problems introduced

4. **Cache Validation**
   - Verify cache keys include entity_id
   - Test cache isolation between entities
   - Verify no cache poisoning (Entity A data in Entity B cache)

---

## 6. Testing Requirements

### 6.1 Unit Tests

**Backend Tests:**
- Test entity filtering in all services
- Test entity access validation
- Test entity context injection
- Test data isolation between entities

**Frontend Tests:**
- Test entity selector component
- Test entity context provider
- Test entity switching functionality
- Test API calls include entity_id

### 6.2 Integration Tests

**API Tests:**
- Test all endpoints with entity context
- Test entity switching via API
- Test cross-entity access prevention
- Test entity-scoped queries

**Database Tests:**
- Test entity_id constraints
- Test foreign key relationships
- Test unique constraints with entity_id
- Test cascade deletes

### 6.3 End-to-End Tests

**User Flows:**
- User logs in → sees default entity
- User switches entity → sees different data
- User creates project → project belongs to current entity
- User accesses project → project belongs to user's entity
- User tries to access other entity's data → gets 403
- User uploads evidence → file stored with entity_id in path
- User generates report → report belongs to entity's project
- Background job runs → processes only correct entity's data
- User creates policy → policy belongs to current entity
- User syncs Jira → sync belongs to entity's config

### 6.4 Performance Tests

- Test query performance with entity filtering
- Test index usage (especially composite indexes)
- Test bulk operations per entity
- Test concurrent entity operations
- Test cache performance with entity_id keys
- Test composite key lookups (llm_report_cache, project_pillar_scores, trustmarks)

### 6.5 Observability Tests

- Test log statements include entity_id
- Test error messages include entity_id
- Test metrics are tagged with entity_id
- Test log filtering by entity_id works
- Test cross-entity log confusion prevention

---

## 7. Rollout Strategy

### 7.1 Phased Approach

**Phase 1: Database Schema (Week 1-2)**
- Create entities table (or update existing entity table)
- Create all Alembic migrations
- Add entity_id columns (nullable initially)
- Create indexes
- Add foreign key constraints
- **DO NOT** drop global unique constraints yet

**Phase 2: Data Migration (Week 2-3)**
- Create default entity
- Run data migration scripts (backfill entity_id)
- Validate data integrity (no NULLs, no duplicates within entity)
- Validate composite uniqueness before constraint changes
- Set NOT NULL constraints
- **THEN** drop old global unique constraints
- Add composite unique constraints
- Test data isolation

**Phase 3: Backend Updates (Week 3-5)**
- Update all models
- Update all routers (add entity context injection)
- Update all services
- Update background jobs & scheduled tasks
- Update MCP server & chatbot integration
- Add entity context/dependencies
- Add authorization checks
- Update evidence storage paths
- Add entity_id to logging & observability

**Phase 4: Frontend Updates (Week 5-7)**
- Create new route structure: `entities/[entityId]/scorecard/...`
- Add redirects from old routes to new routes (with default entity)
- Add entity selector component
- Update routing (entity in URL path - Option A selected)
- Update all internal links to include entity_id prefix
- Update all API calls (include entity_id from URL)
- Update all pages/components
- Add entity context management (extract from URL)
- Update evidence upload/download paths
- Create entity management pages

**Phase 5: Testing & Validation (Week 7-8)**
- Run full test suite
- Test entity isolation
- Test background jobs per entity
- Test cache isolation (composite keys)
- Test MCP/chatbot entity filtering
- Test observability (logs include entity_id)
- Performance testing (composite indexes)
- Security testing (cross-entity access prevention)
- User acceptance testing

**Phase 6: Deployment (Week 8)**
- Deploy to staging
- Final validation
- Clear caches
- Deploy to production
- Monitor for issues (queries, cache, background jobs)

### 7.2 Risk Mitigation

**Rollback Plan:**
- Keep entity_id columns nullable during migration (until backfill complete)
- Have rollback migrations ready for each phase
- Database backup before each phase
- Feature flag for multi-entity (disable if issues)
- Ability to revert to single-entity mode if critical issues

**Staged Migration Strategy:**
1. **Stage 1:** Add entity_id (nullable) → No breaking changes
2. **Stage 2:** Backfill entity_id → All data assigned to default entity
3. **Stage 3:** Update code to use entity_id → Still works with default entity
4. **Stage 4:** Set NOT NULL → Enforce entity requirement
5. **Stage 5:** Drop global uniques, add composite → Final multi-entity state

**Monitoring:**
- Monitor query performance (especially with entity_id filters)
- Monitor error rates (404s, 403s for cross-entity access)
- Monitor entity switching usage
- Monitor data isolation (audit logs)
- Monitor background job execution (verify correct entities processed)
- Monitor cache hit rates (verify entity_id in cache keys)
- Monitor evidence storage paths (verify entity_id included)
- Monitor logs include entity_id (prevent cross-entity confusion)
- Monitor MCP/chatbot queries are entity-scoped
- Monitor composite key performance (llm_report_cache, project_pillar_scores, trustmarks)

**Communication:**
- Notify users of changes
- Provide migration guide
- Update documentation
- Provide support during transition

---

## 8. Decisions Required

### 8.1 Architecture Decisions

1. **Global vs Per-Entity Lookup Tables**
   - `pillars` - Global or per-entity?
   - `kpis` - Global or per-entity?
   - `controls` - Global or per-entity?
   - `iso42001_requirements` - Global or per-entity?
   - `euaiact_requirements` - Global or per-entity?
   - `guardrail_rules` - Global or per-entity?

   **Recommendation:** Start with global/shared for consistency, allow per-entity customization later if needed.

2. **Entity Selection Method**
   - URL path (`/entity/{id}/...`)
   - Query parameter (`?entity_id=...`)
   - Context/storage (localStorage)

   **Recommendation:** Context-based with query param support for deep linking.

3. **Default Entity Behavior**
   - One default entity per user?
   - Multiple entities per user?
   - Entity switching frequency?

   **Recommendation:** Users can belong to multiple entities, with a primary entity default.

4. **Data Migration Strategy**
   - Single default entity for all existing data?
   - Multiple entities based on some criteria?
   - User-driven entity assignment?

   **Recommendation:** Single default entity initially, allow manual reassignment later.

### 8.2 Security Decisions

1. **Entity Access Control**
   - Role-based access per entity?
   - Simple access/no-access?
   - Hierarchical permissions?

   **Recommendation:** Role-based (admin, editor, viewer) per entity.

2. **Cross-Entity Data Access**
   - Completely isolated?
   - Allow read-only cross-entity?
   - Allow admin override?

   **Recommendation:** Complete isolation by default, admin override for support purposes.

---

## 9. Estimated Effort

### 9.1 Database Changes
- **Migrations:** 10 migrations × 4 hours = 40 hours
- **Data Migration Scripts:** 8 scripts × 6 hours = 48 hours
- **Testing & Validation:** 16 hours
- **Total:** ~104 hours (~13 days)

### 9.2 Backend Changes
- **Models:** 8 hours
- **Routers:** 15 routers × 4 hours = 60 hours
- **Services:** 10 services × 3 hours = 30 hours
- **Dependencies & Context:** 16 hours
- **Testing:** 40 hours
- **Total:** ~154 hours (~19 days)

### 9.3 Frontend Changes
- **Entity Selector Component:** 8 hours
- **Context Management:** 8 hours
- **API Client Updates:** 16 hours
- **Page Updates:** 20 pages × 2 hours = 40 hours
- **State Management:** 8 hours
- **Testing:** 24 hours
- **Total:** ~104 hours (~13 days)

### 9.4 Authentication & Authorization
- **User-Entity Relationship:** 8 hours
- **JWT Updates:** 8 hours
- **Authorization Logic:** 16 hours
- **Testing:** 16 hours
- **Total:** ~48 hours (~6 days)

### 9.5 Testing & Validation
- **Unit Tests:** 40 hours
- **Integration Tests:** 32 hours
- **E2E Tests:** 24 hours
- **Performance Tests:** 16 hours
- **Total:** ~112 hours (~14 days)

### 9.6 Total Estimated Effort
- **Total:** ~522 hours (~65 days / ~13 weeks)

---

## 10. Dependencies & Prerequisites

### 10.1 Technical Prerequisites
- Alembic migration system in place ✓
- Database backup system ✓
- Testing framework ✓
- CI/CD pipeline ✓

### 10.2 Business Prerequisites
- Approval for multi-entity architecture
- User access model defined
- Entity creation/management process defined
- Data migration approval

### 10.3 External Dependencies
- NextAuth configuration updates
- JWT token format updates
- API documentation updates
- User documentation updates

---

## 11. Success Criteria

### 11.1 Functional Requirements
- ✅ Users can select/switch entities
- ✅ Data is isolated per entity
- ✅ Users can only access their assigned entities
- ✅ All existing data migrated successfully
- ✅ All features work with entity context

### 11.2 Performance Requirements
- ✅ Query performance maintained or improved
- ✅ Entity switching is fast (< 100ms)
- ✅ No N+1 query problems introduced

### 11.3 Security Requirements
- ✅ Cross-entity access prevented
- ✅ Entity access properly validated
- ✅ Audit logs include entity context

---

## 12. Notes & Considerations

### 12.1 Future Enhancements
- Entity-level customization of pillars/KPIs
- Entity-level guardrail rules
- Entity-level policy templates
- Entity-level reporting dashboards
- Entity-level user management UI

### 12.2 Migration Risks & Mitigation

**Critical Risks:**

1. **Breaking Existing Unique Constraints**
   - **Risk:** Dropping global unique constraints on slug/keys may fail if duplicates exist
   - **Mitigation:** 
     - Validate uniqueness before dropping constraints
     - Create migration script to detect and resolve duplicates
     - Add entity_id to unique constraint BEFORE dropping old one

2. **Hidden JOINs Without Entity Filters**
   - **Risk:** Queries that JOIN tables may return cross-entity data if entity_id filter missing
   - **Mitigation:**
     - Code review all JOIN queries
     - Add database-level RLS (Row Level Security) as additional safety net
     - Comprehensive integration tests

3. **Cache Poisoning**
   - **Risk:** Cache keys without entity_id may serve wrong entity's data
   - **Mitigation:**
     - Update all cache keys to include entity_id
     - Clear cache before migration
     - Add entity_id validation in cache retrieval

4. **Orphan Data After Migration**
   - **Risk:** Incomplete backfill leaves NULL entity_id values
   - **Mitigation:**
     - Comprehensive validation scripts
     - Rollback plan if NULLs detected
     - Staged migration: nullable → backfill → NOT NULL

5. **Background Jobs Processing Wrong Entities**
   - **Risk:** Batch jobs may process all entities or wrong entity's data
   - **Mitigation:**
     - Update all batch jobs to filter by entity_id
     - Test batch jobs in staging with multiple entities
     - Add entity_id logging to batch job output

6. **S3/MinIO Evidence Path Issues**
   - **Risk:** Evidence files stored without entity_id in path may be inaccessible
   - **Mitigation:**
     - Update evidence upload to include entity_id in path
     - Migration script to reorganize existing files (if needed)
     - Update evidence retrieval to use entity_id path

7. **Performance Degradation**
   - **Risk:** Additional entity_id filters may slow queries
   - **Mitigation:**
     - Proper indexing strategy
     - Query optimization
     - Performance testing before production

### 12.3 Potential Issues
- **Performance:** Entity filtering on every query
  - *Mitigation:* Proper indexing, query optimization
- **Complexity:** Entity context management
  - *Mitigation:* Clear patterns, good documentation
- **Data Migration:** Risk of data loss
  - *Mitigation:* Comprehensive backups, validation scripts
- **User Experience:** Entity switching confusion
  - *Mitigation:* Clear UI, good UX design

### 12.3 Open Questions
1. Should entities be able to share projects? (Likely no)
2. Should there be a "super admin" that can access all entities? (Likely yes, for support)
3. How to handle entity deletion? (Cascade or archive?)
4. Should entity data be exportable? (Likely yes)
5. How to handle entity-level billing/subscription? (Future consideration)

---

## End of Document

This plan should be reviewed and approved before beginning implementation. All decisions marked as "DECISION NEEDED" must be resolved before proceeding with the corresponding changes.

# Multi-entity readiness: tables with entity_id / entity_slug

A table is **multi-entity ready** when it has both:
- **entity_id** (UUID, FK to `entity.id`) – for joins and constraints
- **entity_slug** (text, derived from `entity.slug`) – for URLs, filtering by slug, and consistency with `project_slug`

Below: all tables that have (or should have) `entity_id` for entity isolation, and whether they have `entity_slug` in the current migrations.

---

## Tables that already have both entity_id and entity_slug (in migrations)

| Table | Notes |
|-------|--------|
| **entity_projects** | Core; entity_id + entity_slug (27f85b05996e + add_entity_slug_to_tables) |
| **aims_scope** | Core; entity_id + entity_slug |
| **policies** | Core |
| **audit_events** | Core |
| **assessments** | Project-dependent |
| **pillar_overrides** | Project-dependent |
| **project_translations** | Project-dependent |
| **project_pillar_scores** | Project-dependent |
| **control_values** | Control & evidence |
| **control_values_history** | Control & evidence |
| **evidence** | Control & evidence |
| **evidence_audit** | Control & evidence |
| **jira_sync_metadata** | Jira |
| **jira_risk_register** | Jira |
| **ai_requirement_register** | Jira / AI |
| **provenance_artifacts** | Provenance (entity_slug via project_slug → entity_projects) |
| **provenance_datasets** | Provenance |
| **provenance_models** | Provenance |
| **provenance_evidence** | Provenance |
| **provenance_lineage** | Provenance |
| **provenance_evaluations** | Provenance |
| **provenance_manifest_facts** | Provenance |

---

## Tables that now have entity_slug (added in add_entity_slug_remaining_v1)

Migration `20260214_add_entity_slug_remaining_tables.py` adds `entity_slug` (and index + backfill) to:

| Table | Category |
|-------|----------|
| **trust_evaluations** | Trust |
| **trust_evaluation_audit** | Trust |
| **trustmarks** | Trust |
| **trust_monitoring_signals** | Trust |
| **trust_decay_events** | Trust |
| **llm_report_cache** | Other |
| **ai_system_registry** | Other |
| **policy_versions** | Other |
| **policy_alerts** | Other |
| **jira_configs** | Other |
| **jira_sync_history** | Other |
| **ai_readiness_results** | Other |
| **pillar_overrides_history** | Conditional (if table exists) |
| **euaiact_entity_definitions** | Conditional (if table exists) |

---

## Entity-scoped tables with entity_id only (no entity_slug)

These are entity-scoped but intentionally do **not** store `entity_slug` (project_slug is sufficient or the table is global by design).

| Table | Notes |
|-------|--------|
| **alert_rules** | Entity/project-scoped alert rules (threshold / trend_drop) |
| **trend_alerts** | Generated trend alerts; project_slug included |
| **report_next_steps** | Manual next steps for board-level reports |
| **entity_provider_artifacts** | Provider docs/assurances per entity |

---

## Global/system tables (intentionally no entity_id or entity_slug)

| Table | Notes |
|-------|--------|
| **system_email_settings** | Singleton encrypted SMTP configuration used by `/admin/master/email-settings`; global system setting, not tenant-scoped. |

---

## Entity table itself

| Table | Column | Notes |
|------|--------|-------|
| **entity** | **slug** | The entity table uses `slug` (not `entity_slug`). This is the source for backfilling `entity_slug` on other tables. |

---

## Summary

- **Multi-entity ready (entity_id + entity_slug):** All entity-scoped tables, via:
  - `add_entity_slug_to_tables_v1`: core, project-dependent, control/evidence, jira registers, provenance (24 tables).
  - `add_entity_slug_remaining_v1`: trust_*, llm_report_cache, ai_system_registry, policy_*, jira_configs, jira_sync_history, ai_readiness_results, and conditionally pillar_overrides_history, euaiact_entity_definitions (12–14 tables).
- **Entity-scoped without entity_slug:** `alert_rules`, `trend_alerts`, `report_next_steps`, `entity_provider_artifacts`.

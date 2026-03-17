# Empty entity_id / entity_slug columns (multi-entity)

Many tables have `entity_id` and `entity_slug` columns added for multi-entity support. If those columns are **empty (NULL)** for some rows, it **does cause problems**.

## What goes wrong

- **Queries filter by entity:** The app almost always filters by the current user’s entity, e.g. `WHERE entity_id = $1` or `Project.entity_id == entity_id`. Rows with **NULL entity_id** never match, so they are **invisible** to the UI and APIs.
- **Inconsistent data:** For example, if `entity_projects` has `entity_id` set but related `control_values` or `evidence` rows have NULL `entity_id`, the project may appear but some controls/evidence may be missing.
- **No DB error:** The columns are nullable, so the database does not fail; the app simply excludes those rows.

So: **empty entity_id/entity_slug means that data is effectively orphaned** for the current multi-entity model.

## Finding rows with NULL entity_id

You can list tables and count NULLs (run in `psql` or your DB client):

```sql
-- Tables that commonly have entity_id (adjust list to match your schema)
SELECT
  c.table_name,
  (xpath('/row/c/text()', query_to_xml(
    format('SELECT count(*) AS c FROM %I WHERE entity_id IS NULL', c.table_name),
    false, true, ''
  )))[1]::text::int AS null_entity_id_count
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.column_name = 'entity_id'
  AND c.table_name IN (
    'entity_projects', 'control_values', 'evidence', 'policies',
    'assessments', 'pillar_overrides', 'trust_evaluations', 'provenance_artifacts',
    'audit_events', 'llm_report_cache', 'project_translations'
  )
ORDER BY c.table_name;
```

Or per table:

```sql
SELECT 'entity_projects' AS tbl, count(*) FROM entity_projects WHERE entity_id IS NULL
UNION ALL SELECT 'control_values', count(*) FROM control_values WHERE entity_id IS NULL
UNION ALL SELECT 'evidence', count(*) FROM evidence WHERE entity_id IS NULL
-- add other tables as needed
;
```

## Backfilling entity_id

Backfill should use the same rules as the migrations: derive `entity_id` from a related table (e.g. project or policy) or, if there is no relation, set it to a chosen default entity.

**1) Backfill from `entity_projects` (tables linked by project):**

For tables that have `project_slug` or `project_id`, set `entity_id` from the project:

```sql
-- Example: control_values
UPDATE control_values cv
SET entity_id = p.entity_id
FROM entity_projects p
WHERE cv.project_slug = p.slug AND cv.entity_id IS NULL AND p.entity_id IS NOT NULL;

-- Example: evidence
UPDATE evidence e
SET entity_id = p.entity_id
FROM entity_projects p
WHERE e.project_slug = p.slug AND e.entity_id IS NULL AND p.entity_id IS NOT NULL;
```

Repeat the same pattern for other project-scoped tables (`assessments`, `pillar_overrides`, `trust_evaluations`, `provenance_artifacts`, etc.), using either `project_slug` and `entity_projects.slug` or `project_id` and `entity_projects.id`.

**2) Backfill entity_slug from entity:**

After `entity_id` is set, you can backfill `entity_slug` from the `entity` table:

```sql
UPDATE control_values t
SET entity_slug = e.slug
FROM entity e
WHERE t.entity_id = e.id AND (t.entity_slug IS NULL OR t.entity_slug = '');

-- Repeat for other tables that have both entity_id and entity_slug
```

**3) Rows that cannot be linked (e.g. no project):**

If a row has no project (or other relation) to derive `entity_id` from, you must decide:

- Assign a **default entity** (e.g. first entity or a dedicated “legacy” entity), or  
- Leave it NULL and accept that it will not appear in entity-scoped UIs.

Example using the first entity as default:

```sql
-- Only for tables where you have no other way to get entity_id
UPDATE some_table
SET entity_id = (SELECT id FROM entity ORDER BY created_at NULLS LAST LIMIT 1)
WHERE entity_id IS NULL;
```

## Summary

- **Yes, empty entity_id/entity_slug causes problems:** those rows are excluded by entity-scoped queries and look like missing data.
- Fix by **backfilling** `entity_id` (and then `entity_slug`) from related data or a default entity, using the same logic as in the migrations (`fix_missing_entity_id_columns`, `backfill_entity_id`, `add_entity_slug_after_fix`).

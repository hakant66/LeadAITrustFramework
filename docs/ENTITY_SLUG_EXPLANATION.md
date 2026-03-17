# Entity Slug Column - How It Works

## Overview

The `entity_slug` column is a **denormalized** field that stores the human-readable entity identifier (slug) directly in tables that reference entities. This is similar to how `project_slug` works in tables that reference projects.

## Why Entity Slug?

### Benefits:

1. **Performance**: Avoids JOINs when filtering by entity
   ```sql
   -- Without entity_slug (requires JOIN):
   SELECT * FROM entity_projects ep
   JOIN entity e ON ep.entity_id = e.id
   WHERE e.slug = 'booking-holdings-inc';
   
   -- With entity_slug (direct filter):
   SELECT * FROM entity_projects
   WHERE entity_slug = 'booking-holdings-inc';
   ```

2. **Readability**: Human-readable slugs in queries and logs
   ```sql
   -- Instead of seeing UUIDs:
   entity_id: cc700c51-420f-42c4-a776-2ce2babe55aa
   
   -- You see readable slugs:
   entity_slug: booking-holdings-inc
   ```

3. **Consistency**: Matches the pattern used for `project_slug`
   - Tables already have `project_slug` for human-readable project identification
   - `entity_slug` follows the same pattern for entities

## How It Works

### 1. **Source of Truth**
- `entity.slug` is the **primary source** (unique, indexed)
- `entity_slug` in other tables is a **denormalized copy**

### 2. **Data Flow**

```
Entity Creation:
  entity.full_legal_name → entity.slug (generated)
  
Project Creation:
  entity_projects.entity_id → entity.id (FK)
  entity_projects.entity_slug → entity.slug (copied)
  
Aims Scope Creation:
  aims_scope.entity_id → entity.id (FK)
  aims_scope.entity_slug → entity.slug (copied)
```

### 3. **Maintenance**

**On INSERT/UPDATE:**
- When creating/updating records, `entity_slug` should be set from `entity.slug`
- This is typically done via:
  - Application code (recommended)
  - Database triggers (alternative)
  - Migration backfills (for existing data)

**On Entity Slug Change:**
- If `entity.slug` changes, all related `entity_slug` columns should be updated
- This is rare but should be handled by application code or triggers

## Current Implementation

### Tables with `entity_slug`:

✅ **Added:**
- `entity_projects` - Has `entity_id` and `entity_slug`
- `aims_scope` - Has `entity_id` and `entity_slug`

🔄 **Should Have (from migration):**
- `policies`
- `audit_events`
- `assessments`
- `pillar_overrides`
- `project_translations`
- `project_pillar_scores`
- `control_values`
- `control_values_history`
- `evidence`
- `evidence_audit`
- `jira_sync_metadata`
- `jira_risk_register`
- `ai_requirement_register`
- Provenance tables (via project relationship)

### Current State:

**entity_projects:**
```sql
Columns:
- entity_id (UUID) - Foreign key to entity.id
- entity_slug (TEXT) - Denormalized copy of entity.slug
- slug (VARCHAR) - Project slug (project identifier)

Indexes:
- ix_entity_projects_entity_slug - For fast filtering
```

**aims_scope:**
```sql
Columns:
- entity_id (UUID) - Foreign key to entity.id
- entity_slug (TEXT) - Denormalized copy of entity.slug

Indexes:
- ix_aims_scope_entity_slug - For fast filtering
```

## Usage Examples

### Query by Entity Slug:

```sql
-- Get all projects for an entity
SELECT * FROM entity_projects
WHERE entity_slug = 'booking-holdings-inc';

-- Get all aims_scope records for an entity
SELECT * FROM aims_scope
WHERE entity_slug = 'booking-holdings-inc';

-- Join projects with entity info (no need to join entity table)
SELECT 
  ep.slug as project_slug,
  ep.name as project_name,
  ep.entity_slug,
  ep.entity_id
FROM entity_projects ep
WHERE ep.entity_slug = 'booking-holdings-inc';
```

### Application Code:

```python
# When creating a project
async def create_project(project_data, entity_id: UUID):
    # Get entity slug
    entity = await get_entity_by_id(entity_id)
    
    # Insert project with both entity_id and entity_slug
    await conn.execute("""
        INSERT INTO entity_projects (
            slug, name, entity_id, entity_slug, ...
        ) VALUES (
            $1, $2, $3, $4, ...
        )
    """, 
        project_data.slug,
        project_data.name,
        entity_id,
        entity.slug,  # ← Denormalized slug
        ...
    )
```

## Important Notes

1. **Denormalization Trade-off:**
   - ✅ Faster queries (no JOINs needed)
   - ✅ More readable logs/queries
   - ⚠️ Requires maintaining consistency
   - ⚠️ Extra storage space

2. **Consistency:**
   - `entity_slug` should always match `entity.slug` for the same `entity_id`
   - Application code should ensure this on INSERT/UPDATE
   - Consider database triggers for automatic updates

3. **Migration:**
   - Existing records may have NULL `entity_slug` until backfilled
   - Backfill queries join `entity` table to populate `entity_slug`
   - New records should always set `entity_slug` on creation

4. **Query Strategy:**
   - Use `entity_slug` for filtering (fast, readable)
   - Use `entity_id` for JOINs and foreign keys (normalized, indexed)
   - Both can be used together for validation

## Next Steps

1. **Backfill Existing Data:**
   ```sql
   -- Backfill entity_projects
   UPDATE entity_projects ep
   SET entity_slug = e.slug
   FROM entity e
   WHERE ep.entity_id = e.id AND ep.entity_slug IS NULL;
   
   -- Backfill aims_scope
   UPDATE aims_scope a
   SET entity_slug = e.slug
   FROM entity e
   WHERE a.entity_id = e.id AND a.entity_slug IS NULL;
   ```

2. **Update Application Code:**
   - Ensure all INSERT/UPDATE operations set `entity_slug`
   - Add validation to ensure `entity_slug` matches `entity.slug`

3. **Add Database Triggers (Optional):**
   - Trigger to automatically update `entity_slug` when `entity.slug` changes
   - Trigger to validate `entity_slug` matches `entity.slug` on INSERT/UPDATE

# Granting entity access to users

If a user sees **"No entity access. You need to be granted access to an entity"** (or **"Entity access required"** on the dashboard), they are signed in but have no row in `user_entity_access` linking their backend user to any entity.

## Option 1: Grant all mapped users access to the first entity

Run this in your PostgreSQL database (e.g. `psql` or your DB client, or `docker exec -it postgres psql -U leadai -d leadai`):

```sql
-- Grant viewer access to the first entity (by id) for every user in user_mapping
INSERT INTO user_entity_access (user_id, entity_id, role)
SELECT um.backend_user_id, (SELECT id FROM entity LIMIT 1), 'viewer'
FROM user_mapping um
ON CONFLICT (user_id, entity_id) DO NOTHING;
```

If you prefer to use the most recently created entity:

```sql
INSERT INTO user_entity_access (user_id, entity_id, role)
SELECT um.backend_user_id, (SELECT id FROM entity ORDER BY created_at DESC NULLS LAST LIMIT 1), 'viewer'
FROM user_mapping um
ON CONFLICT (user_id, entity_id) DO NOTHING;
```

## Option 2: Grant a specific user access to a specific entity

1. Get the user’s backend UUID from `user_mapping` (they must have signed in at least once so a row exists):

   ```sql
   SELECT id, nextauth_user_id, backend_user_id FROM user_mapping;
   ```

2. List entities:

   ```sql
   SELECT id, full_legal_name, slug FROM entity;
   ```

3. Insert one row (use the chosen `backend_user_id` and `entity_id`):

   ```sql
   INSERT INTO user_entity_access (user_id, entity_id, role)
   VALUES (
     'backend-user-uuid-here',
     'entity-uuid-here',
     'viewer'   -- or 'editor' or 'admin'
   )
   ON CONFLICT (user_id, entity_id) DO NOTHING;
   ```

## Roles

- `viewer` – can view projects and dashboards for that entity.
- `editor` – can edit; required for some scorecard/evidence actions.
- `admin` – full admin for that entity.

After running the SQL, the user can refresh the dashboard (or click Retry); no need to sign in again.

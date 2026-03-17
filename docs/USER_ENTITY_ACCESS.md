# User Creation and Entity Authorization Guide

This guide explains how to create new users and grant them access to different entities in the LeadAI Trust Framework.

## Overview

The system uses a two-step process:
1. **User Registration**: Users register via NextAuth (email-based authentication)
2. **Entity Access Grant**: Users are granted access to specific entities with roles (admin, editor, viewer)

## User Registration

### Automatic Registration (Recommended)

Users can register themselves through the registration page:
- **URL**: `/register`
- Users provide their email address
- NextAuth handles account creation automatically
- A mapping is automatically created in `user_mapping` table

### Manual User Creation (Database)

If you need to create a user manually in the database:

1. **Create NextAuth User** (in `auth` schema):
```sql
-- Note: Table names are capitalized and quoted: auth."User", auth."Account"
-- Column names are camelCase: emailVerified (not email_verified)
-- Insert into NextAuth users table
INSERT INTO auth."User" (id, email, "emailVerified")
VALUES (
  'clxxxxxxxxxxxxx',  -- Generate a CUID (or use NextAuth's ID generation)
  'user@example.com',
  NULL  -- or a timestamp if verified
);

-- Create account record
INSERT INTO auth."Account" ("userId", type, provider, "providerAccountId")
VALUES (
  'clxxxxxxxxxxxxx',
  'email',
  'email',
  'user@example.com'
);
```

2. **Create User Mapping** (automatic on first login, or manual):
```sql
-- The mapping is created automatically when user first logs in
-- Or manually:
INSERT INTO user_mapping (nextauth_user_id, backend_user_id)
VALUES (
  'clxxxxxxxxxxxxx',  -- NextAuth user ID
  gen_random_uuid()   -- Backend UUID
);
```

## Granting Entity Access

### Method 1: Direct SQL (Quick Method)

Grant access to an entity directly via SQL:

```sql
-- First, find the user's backend_user_id
-- Note: Table name is auth."User" (capital U, quoted) and columns are camelCase
SELECT um.backend_user_id, um.nextauth_user_id, u.email
FROM user_mapping um
JOIN auth."User" u ON u.id = um.nextauth_user_id
WHERE u.email = 'user@example.com';

-- Find the entity_id
SELECT id, full_legal_name, slug
FROM entity
WHERE slug = 'blueprint-limited';  -- or use entity name

-- Grant access (replace with actual UUIDs)
INSERT INTO user_entity_access (user_id, entity_id, role, granted_at)
VALUES (
  '786653d2-9782-4595-a9be-2e039c6cc79d',  -- backend_user_id from above
  'acfd8ccd-29d3-4109-990f-6d71ce8c588e',  -- entity_id from above
  'viewer',  -- role: 'admin', 'editor', or 'viewer'
  NOW()
)
ON CONFLICT (user_id, entity_id) DO UPDATE
SET role = EXCLUDED.role;
```

### Method 2: Complete SQL Script

Here's a complete script to grant access:

```sql
-- Grant entity access to a user
DO $$
DECLARE
  v_backend_user_id UUID;
  v_entity_id UUID;
  v_user_email TEXT := 'user@example.com';
  v_entity_slug TEXT := 'blueprint-limited';
  v_role TEXT := 'viewer';  -- 'admin', 'editor', or 'viewer'
BEGIN
  -- Get backend user ID
  SELECT um.backend_user_id INTO v_backend_user_id
  FROM user_mapping um
  JOIN auth.users u ON u.id = um.nextauth_user_id
  WHERE u.email = v_user_email;
  
  IF v_backend_user_id IS NULL THEN
    RAISE EXCEPTION 'User not found: %', v_user_email;
  END IF;
  
  -- Get entity ID
  SELECT id INTO v_entity_id
  FROM entity
  WHERE slug = v_entity_slug;
  
  IF v_entity_id IS NULL THEN
    RAISE EXCEPTION 'Entity not found: %', v_entity_slug;
  END IF;
  
  -- Grant access
  INSERT INTO user_entity_access (user_id, entity_id, role, granted_at)
  VALUES (v_backend_user_id, v_entity_id, v_role, NOW())
  ON CONFLICT (user_id, entity_id) DO UPDATE
  SET role = EXCLUDED.role;
  
  RAISE NOTICE 'Granted % access to entity % for user %', v_role, v_entity_slug, v_user_email;
END $$;
```

### Method 3: Update Existing Access

To update a user's role for an entity:

```sql
UPDATE user_entity_access
SET role = 'admin'  -- new role
WHERE user_id = '786653d2-9782-4595-a9be-2e039c6cc79d'
  AND entity_id = 'acfd8ccd-29d3-4109-990f-6d71ce8c588e';
```

### Method 4: Remove Entity Access

To revoke a user's access to an entity:

```sql
DELETE FROM user_entity_access
WHERE user_id = '786653d2-9782-4595-a9be-2e039c6cc79d'
  AND entity_id = 'acfd8ccd-29d3-4109-990f-6d71ce8c588e';
```

## Role Hierarchy

The system supports three roles with the following hierarchy:

- **admin**: Full access (can manage users, settings, etc.)
- **editor**: Can create/edit data (projects, scorecards, etc.)
- **viewer**: Read-only access

Role hierarchy: `admin > editor > viewer`

## Useful Queries

### List all users and their entity access

```sql
SELECT 
  u.email,
  um.backend_user_id,
  e.full_legal_name AS entity_name,
  e.slug AS entity_slug,
  uea.role,
  uea.granted_at
FROM auth."User" u
JOIN user_mapping um ON um.nextauth_user_id = u.id
LEFT JOIN user_entity_access uea ON uea.user_id = um.backend_user_id
LEFT JOIN entity e ON e.id = uea.entity_id
ORDER BY u.email, e.full_legal_name;
```

### Find users with access to a specific entity

```sql
SELECT 
  u.email,
  um.backend_user_id,
  uea.role,
  uea.granted_at
FROM entity e
JOIN user_entity_access uea ON uea.entity_id = e.id
JOIN user_mapping um ON um.backend_user_id = uea.user_id
JOIN auth."User" u ON u.id = um.nextauth_user_id
WHERE e.slug = 'blueprint-limited'
ORDER BY u.email;
```

### Find all entities a user can access

```sql
SELECT 
  e.full_legal_name,
  e.slug,
  uea.role,
  uea.granted_at
FROM auth."User" u
JOIN user_mapping um ON um.nextauth_user_id = u.id
JOIN user_entity_access uea ON uea.user_id = um.backend_user_id
JOIN entity e ON e.id = uea.entity_id
WHERE u.email = 'user@example.com'
ORDER BY e.full_legal_name;
```

## System Admin (Master Admin) Users

In the UI this role is labeled **"System Admin"** (entity switcher shows **"Choose Entity"**). Master admins (defined by `MASTER_ADMIN_USER_IDS` environment variable) can access **all entities** without needing entries in `user_entity_access`. 

To make a user a master admin:
1. Find their `backend_user_id` from `user_mapping` table
2. Add the UUID to `MASTER_ADMIN_USER_IDS` environment variable (comma-separated)

Example:
```bash
MASTER_ADMIN_USER_IDS=786653d2-9782-4595-a9be-2e039c6cc79d,99a0f05c-9ee5-4ac1-8cb7-897822649e5d
```

## Database Schema

### Tables Involved

1. **`auth."User"`** (NextAuth schema)
   - `id`: CUID string (NextAuth user ID)
   - `email`: User's email address
   - `emailVerified`: DateTime (nullable, camelCase)
   - Note: Table name is capitalized and quoted: `auth."User"`

2. **`user_mapping`**
   - `nextauth_user_id`: CUID string (FK to `auth."User".id`)
   - `backend_user_id`: UUID (used in `user_entity_access`)

3. **`user_entity_access`**
   - `id`: UUID (primary key)
   - `user_id`: UUID (FK to `user_mapping.backend_user_id`)
   - `entity_id`: UUID (FK to `entity.id`)
   - `role`: TEXT ('admin', 'editor', 'viewer')
   - `granted_at`: TIMESTAMP
   - `granted_by`: UUID (optional, FK to user who granted access)
   - Unique constraint: `(user_id, entity_id)`

4. **`entity`**
   - `id`: UUID (primary key)
   - `full_legal_name`: TEXT
   - `slug`: TEXT (URL-friendly identifier)

## Example: Complete User Setup

Here's a complete example to create a user and grant access to multiple entities:

```sql
-- Step 1: User registers via /register page (automatic)
-- Or create manually:
-- INSERT INTO auth.users (id, email, ...) VALUES (...);

-- Step 2: Find the backend_user_id (created automatically on first login)
SELECT um.backend_user_id, u.email
FROM user_mapping um
JOIN auth."User" u ON u.id = um.nextauth_user_id
WHERE u.email = 'newuser@example.com';

-- Step 3: Grant access to multiple entities
INSERT INTO user_entity_access (user_id, entity_id, role, granted_at)
VALUES
  ('<backend_user_id>', '<entity_id_1>', 'admin', NOW()),
  ('<backend_user_id>', '<entity_id_2>', 'editor', NOW()),
  ('<backend_user_id>', '<entity_id_3>', 'viewer', NOW())
ON CONFLICT (user_id, entity_id) DO UPDATE
SET role = EXCLUDED.role;
```

## Troubleshooting

### User can't access entity

1. Check if user exists:
```sql
SELECT * FROM auth."User" WHERE email = 'user@example.com';
```

2. Check if mapping exists:
```sql
SELECT * FROM user_mapping 
WHERE nextauth_user_id = (SELECT id FROM auth."User" WHERE email = 'user@example.com');
```

3. Check if entity access is granted:
```sql
SELECT uea.*, e.full_legal_name
FROM user_entity_access uea
JOIN entity e ON e.id = uea.entity_id
JOIN user_mapping um ON um.backend_user_id = uea.user_id
JOIN auth.users u ON u.id = um.nextauth_user_id
WHERE u.email = 'user@example.com';
```

### User is master admin but still getting 403

- Verify `MASTER_ADMIN_USER_IDS` environment variable includes the correct `backend_user_id` (not `nextauth_user_id`)
- Restart the `core-svc` container after changing environment variables

## Future Enhancements

A UI for managing user-entity access is planned. For now, use SQL queries or create API endpoints as needed.

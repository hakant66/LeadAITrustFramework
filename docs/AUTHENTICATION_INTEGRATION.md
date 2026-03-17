# Authentication Integration Guide

## Overview

This document describes the authentication and authorization integration between the Next.js frontend (NextAuth) and the FastAPI backend.

## Architecture

### User ID Mapping

**Problem:** NextAuth uses `cuid()` (string) for user IDs, while the backend expects UUIDs.

**Solution:** A `user_mapping` table maps NextAuth user IDs to backend UUIDs.

```
NextAuth User (cuid) → user_mapping → Backend User UUID → user_entity_access
```

### Authentication Flow

1. **User signs in** via NextAuth (email-based authentication)
2. **Frontend proxy** (`/api/core/[...slug]/route.ts`) extracts NextAuth session
3. **Proxy forwards** `X-NextAuth-User-ID` header to backend
4. **Backend** (`get_current_user_id()`) maps NextAuth ID to UUID via `user_mapping` table
5. **Authorization** (`verify_entity_access()`) checks `user_entity_access` table
6. **Request proceeds** if user has access to the entity

## Database Schema

### user_mapping Table

```sql
CREATE TABLE user_mapping (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nextauth_user_id TEXT UNIQUE NOT NULL,  -- cuid from auth.User
    backend_user_id UUID UNIQUE NOT NULL,   -- UUID for backend
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

### user_entity_access Table

```sql
CREATE TABLE user_entity_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,      -- References backend_user_id
    entity_id UUID NOT NULL,    -- References entity.id
    role TEXT NOT NULL DEFAULT 'viewer',  -- admin, editor, viewer
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    granted_by UUID,
    UNIQUE(user_id, entity_id)
);
```

## Frontend Integration

### Using the API Client

The `apiClient.ts` utility automatically includes authentication and entity context:

```typescript
import { apiGet, apiPost } from "@/lib/apiClient";

// GET request with auth + entity_id
const projects = await apiGet("/projects");

// POST request with auth + entity_id
const result = await apiPost("/projects", { name: "New Project" });
```

### Manual Requests

For manual `fetch` calls, include headers:

```typescript
const entityId = sessionStorage.getItem("entityId");
const response = await fetch("/api/core/projects", {
  headers: {
    "X-Entity-ID": entityId || "",
  },
});
```

The proxy automatically adds `X-NextAuth-User-ID` from the session.

## Backend Integration

### Dependencies

All protected endpoints use authorization dependencies:

```python
from app.dependencies import (
    get_entity_id_with_auth_viewer,
    get_entity_id_with_auth_editor,
    get_entity_id_with_auth_admin,
)

@router.get("/projects")
async def list_projects(
    entity_id: UUID = Depends(get_entity_id_with_auth_viewer),
):
    # User access is already validated
    # entity_id is guaranteed to be valid and user has access
    ...
```

### Role Hierarchy

- **viewer**: Read-only access
- **editor**: Read + write access (includes viewer permissions)
- **admin**: Full access (includes editor permissions)

## Testing

### Integration Tests

Run authorization tests:

```bash
cd apps/core-svc
pytest tests/integration/test_authorization.py -v
```

### Manual Testing

1. **Sign in** via NextAuth (`/register`)
2. **Select/create entity** (sets `entityId` in sessionStorage)
3. **Make API calls** - should automatically include auth headers
4. **Verify access** - users can only access entities they have access to

## Migration Steps

1. **Run database migration:**
   ```bash
   docker exec -it core-svc alembic upgrade head
   ```

2. **Create user mappings** for existing NextAuth users:
   ```sql
   -- This happens automatically on first API call
   -- Or manually:
   INSERT INTO user_mapping (nextauth_user_id, backend_user_id)
   SELECT id, gen_random_uuid()
   FROM auth."User";
   ```

3. **Grant entity access** to users:
   ```sql
   INSERT INTO user_entity_access (user_id, entity_id, role)
   SELECT um.backend_user_id, $1, 'admin'
   FROM user_mapping um
   WHERE um.nextauth_user_id = $2;
   ```

## Security Considerations

1. **Never expose** NextAuth user IDs in API responses
2. **Always validate** entity access on every request
3. **Use role-based** authorization for write operations
4. **Log access** attempts for audit purposes
5. **Rate limit** authentication endpoints

## Troubleshooting

### "Authentication required" error

- Check that user is signed in via NextAuth
- Verify `X-NextAuth-User-ID` header is being sent
- Check `user_mapping` table for user entry

### "User does not have access to entity" error

- Verify `user_entity_access` entry exists
- Check entity_id matches the requested entity
- Ensure user role meets required role

### "Failed to authenticate user" error

- Check database connection
- Verify `user_mapping` table exists
- Check migration status

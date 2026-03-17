# Entity Slug URL Routing - Implementation Guide

## Question 1: How Entity Slug Works in URLs

### Current State

**✅ Implemented:**
- Entity Setup: `/{entity_slug}/scorecard/admin/governance-setup/entity-setup`
- Other governance-setup pages under `[entitySlug]`: aims-scope, ai-project-register, ai-system-register, ai-requirements-register, ai-kpi-register, ai-policy-register, control-register.
- Backend endpoint: `/api/core/entity/by-slug/{slug}`

Legacy routes under `/scorecard/admin/...` (without entity slug) remain for compatibility; `LEADAI_NAV_MODE=legacy` forces legacy redirects.

### How It Works

Once an entity is set up and `entity_slug` is created:

1. **URL Structure:**
   ```
   https://dev.theleadai.co.uk/{entity_slug}/scorecard/admin/governance-setup/{page}
   ```
   Implemented under `apps/web/src/app/[entitySlug]/scorecard/admin/governance-setup/` (e.g. aims-scope, ai-project-register, ai-system-register, etc.).

2. **Backward Compatibility:**
   - Legacy URLs (without entity_slug) still work; entity context is passed by header or resolved as the user's first entity.
   - `LEADAI_NAV_MODE=legacy` forces redirects to legacy routes.

## Question 2: Entity Name in Header

### Implementation

The Header component now supports displaying entity name:

**Before:**
```
LeadAI · Governance Setup
```

**After (with entity_slug in URL):**
```
LeadAI · Governance Setup - Booking Holdings Inc.
```

### How It Works

1. **Header Component Enhancement:**
   - Added `entityName` prop (optional)
   - Auto-fetches entity name if `entity_slug` is in URL params
   - Uses `useEntityName()` hook to fetch entity data

2. **Usage:**
   ```typescript
   // Automatic (recommended) - fetches from URL
   <Header title="Scope" subtitle="LeadAI · Governance Setup" />
   
   // Manual override
   <Header 
     title="Scope" 
     subtitle="LeadAI · Governance Setup" 
     entityName="Booking Holdings Inc." 
   />
   ```

3. **Hook Implementation:**
   - `useEntityName()` hook extracts `entitySlug` from URL params
   - Fetches entity data via `/api/core/entity/by-slug/{slug}`
   - Returns `fullLegalName` or `null`

### Example Pages

**Aims Scope Page:**
```typescript
// URL: /{entity_slug}/scorecard/admin/governance-setup/aims-scope
<Header title="Scope" subtitle="LeadAI · Governance Setup" />
// Displays: "LeadAI · Governance Setup - Booking Holdings Inc."
```

**AI System Register Page:**
```typescript
// URL: /{entity_slug}/scorecard/admin/governance-setup/ai-system-register
<Header title="AI System Register" subtitle="LeadAI · Governance Setup" />
// Displays: "LeadAI · Governance Setup - Booking Holdings Inc."
```

## Migration Checklist

- [x] Header component enhanced with entity name support
- [x] `useEntityName()` hook created
- [x] Entity Setup page migrated to entity_slug URL
- [ ] Aims Scope page migrated
- [ ] AI System Register page migrated
- [ ] Other governance-setup pages migrated
- [ ] Navigation links updated to include entity_slug
- [ ] API client updated to extract entity_id from slug
- [ ] Backward compatibility (redirects) implemented

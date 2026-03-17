# Entity Slug URL Routing - FAQ

## Question 1: Once entity is setup and entity_slug is created, are all related URLs using entity_slug?

### Answer: **Partially Implemented**

**Current Status:**

✅ **Implemented:**
- Entity Setup page: `/{entity_slug}/scorecard/admin/governance-setup/entity-setup`
- Backend API: `/api/core/entity/by-slug/{slug}` endpoint exists
- Header component: Auto-fetches and displays entity name

❌ **Not Yet Implemented:**
- Other governance-setup pages still use old URLs:
  - `/scorecard/admin/governance-setup/aims-scope` (old)
  - `/scorecard/admin/governance-setup/ai-system-register` (old)
  - Should be: `/{entity_slug}/scorecard/admin/governance-setup/aims-scope`
  - Should be: `/{entity_slug}/scorecard/admin/governance-setup/ai-system-register`

### How It Works:

1. **URL Pattern:**
   ```
   https://dev.theleadai.co.uk/{entity_slug}/scorecard/admin/governance-setup/{page}
   ```

2. **Next.js Dynamic Routes:**
   - Pages are placed in: `apps/web/src/app/[entitySlug]/scorecard/admin/governance-setup/{page}/page.tsx`
   - `entitySlug` is extracted from URL params automatically

3. **Entity Context:**
   - Frontend extracts `entitySlug` from URL: `const entitySlug = params?.entitySlug`
   - Fetches entity data: `/api/core/entity/by-slug/{slug}`
   - Gets `entity_id` from entity data
   - Includes `entity_id` in all API requests

4. **Migration Strategy:**
   - Create new pages under `[entitySlug]/` directory
   - Keep old pages for backward compatibility (redirect to new URLs)
   - Update all navigation links to include `{entity_slug}`

### Example Flow:

```
User visits: /booking-holdings-inc/scorecard/admin/governance-setup/aims-scope
  ↓
Next.js extracts: entitySlug = "booking-holdings-inc"
  ↓
Page component fetches: /api/core/entity/by-slug/booking-holdings-inc
  ↓
Gets entity data: { id: "...", fullLegalName: "Booking Holdings Inc.", ... }
  ↓
Header displays: "LeadAI · Governance Setup - Booking Holdings Inc."
  ↓
All API calls include: X-Entity-ID header with entity UUID
```

---

## Question 2: Can you include Entity Name in the Header?

### Answer: **✅ Implemented**

**Implementation:**

The Header component now automatically displays entity name when `entity_slug` is present in the URL.

**Before:**
```
LeadAI · Governance Setup
```

**After (with entity_slug in URL):**
```
LeadAI · Governance Setup - Booking Holdings Inc.
```

### How It Works:

1. **Header Component Enhancement:**
   - Added optional `entityName` prop
   - Auto-fetches entity name using `useEntityName()` hook
   - Displays entity name in subtitle if available

2. **Usage Examples:**

   **Automatic (Recommended):**
   ```typescript
   // Entity name is automatically fetched from URL
   <Header title="Scope" subtitle="LeadAI · Governance Setup" />
   // Displays: "LeadAI · Governance Setup - Booking Holdings Inc."
   ```

   **Manual Override:**
   ```typescript
   <Header 
     title="Scope" 
     subtitle="LeadAI · Governance Setup"
     entityName="Custom Entity Name"
   />
   ```

3. **Hook Implementation:**
   - `useEntityName()` hook extracts `entitySlug` from URL params
   - Fetches entity via `/api/core/entity/by-slug/{slug}`
   - Returns `fullLegalName` or `null`
   - Handles loading and error states

### Example Pages:

**Aims Scope:**
- URL: `/{entity_slug}/scorecard/admin/governance-setup/aims-scope`
- Header: "LeadAI · Governance Setup - Booking Holdings Inc."

**AI System Register:**
- URL: `/{entity_slug}/scorecard/admin/governance-setup/ai-system-register`
- Header: "LeadAI · Governance Setup - Booking Holdings Inc."

**Entity Setup:**
- URL: `/{entity_slug}/scorecard/admin/governance-setup/entity-setup`
- Header: "LeadAI · Governance Setup - Booking Holdings Inc."

---

## Implementation Summary

### ✅ Completed:

1. **Header Component:**
   - Enhanced to support entity name display
   - Auto-fetches entity name from URL slug
   - Backward compatible (works without entity_slug)

2. **Entity Name Hook:**
   - `useEntityName()` hook created
   - Fetches entity data by slug
   - Handles loading/error states

3. **Example Pages:**
   - Entity Setup page migrated
   - Aims Scope page migrated (new route)
   - AI System Register page migrated (new route)

4. **Documentation:**
   - Implementation guide created
   - FAQ document created

### 🔄 Remaining Work:

1. **Migrate Remaining Pages:**
   - ai-project-register
   - ai-kpi-register
   - ai-policy-register
   - ai-requirements-register
   - Other governance-setup pages

2. **Update Navigation:**
   - Sidebar links should include `{entity_slug}`
   - Breadcrumbs should include entity context
   - All internal links updated

3. **Backward Compatibility:**
   - Old URLs redirect to entity-specific URLs
   - Or fetch latest entity and redirect

4. **API Integration:**
   - Ensure all API calls include `entity_id`
   - Update API client to extract entity_id from slug

---

## Testing

To test the implementation:

1. **Create an entity** with slug (e.g., "booking-holdings-inc")
2. **Visit entity-specific URL:**
   ```
   http://localhost:3000/booking-holdings-inc/scorecard/admin/governance-setup/aims-scope
   ```
3. **Verify header shows:**
   ```
   LeadAI · Governance Setup - Booking Holdings Inc.
   ```
4. **Check API calls include:**
   - `X-Entity-ID` header with correct UUID

---

## Notes

- Entity name fetching is async and may show loading state briefly
- If entity_slug is invalid, entity name won't be displayed (graceful degradation)
- Header component is backward compatible - works with or without entity_slug
- All pages can be gradually migrated to entity_slug URLs

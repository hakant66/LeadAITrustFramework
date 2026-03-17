# Web GUI Changes Summary - Multi-Entity Migration

## Overview
This document summarizes all web GUI changes required for the multi-entity migration, including new pages, components, and updates to existing pages.

---

## 🆕 New Pages

### 1. Entity Management Page
**Route:** `/admin/entities`  
**Purpose:** Central hub for managing entities (Admin-only)

**Features:**
- List all entities user has access to
- Create new entity (if user has permission)
- Edit entity details (name, slug, status, region, etc.)
- View entity statistics:
  - Number of projects
  - Number of users
  - Last activity date
  - Entity status (active/inactive)
- Switch/select active entity
- Manage user access to entities (if admin role)
- Delete/deactivate entities (if admin)

**UI Components:**
- Entity list table with:
  - Entity name, slug, status
  - Project count, user count
  - Actions (edit, switch, delete)
  - Filters and search
- Entity creation modal/form
- Entity edit modal/form
- User access management table

---

### 2. User-Entity Access Management Page
**Route:** `/admin/entities/[entityId]/users`  
**Purpose:** Manage which users can access which entities (Admin-only)

**Features:**
- List all users with access to the entity
- Add users to entity (search/select users)
- Remove users from entity
- Assign roles per user-entity relationship:
  - Admin (full access)
  - Editor (create/edit data)
  - Viewer (read-only)
- View user permissions per entity
- Bulk user management (add/remove multiple users)

**UI Components:**
- User list table (filtered by entity)
- User search/selector component
- Role assignment dropdown per user
- Add/remove user buttons
- Permission matrix view (optional)

---

### 3. Entity Overview / Landing Page
**Route:** `/entities/[entityId]/overview`  
**Purpose:** Single entry point for entity-scoped governance

**Features:**
- Entity summary dashboard
- Quick stats:
  - Project count
  - User count
  - Overall trust score
  - Compliance status
- Recent activity feed
- Quick navigation links to:
  - Projects (`/entities/{id}/scorecard/admin/governance-setup/ai-project-register`)
  - Governance Setup (`/entities/{id}/scorecard/admin/governance-setup`)
  - Data Manager (`/entities/{id}/scorecard/admin/data-manager`)
  - Reports (`/entities/{id}/scorecard/admin/governance-dashboard-reporting`)
  - Settings (`/entities/{id}/settings`)
- Entity status indicator
- Entity information card

**UI Components:**
- Entity summary cards (stats)
- Activity feed component
- Quick navigation grid
- Entity info panel

---

### 4. Entity Settings Page
**Route:** `/entities/[entityId]/settings`  
**Purpose:** Entity-specific configuration

**Features:**
- Entity profile information display/edit
- Entity branding/logo upload
- Entity-specific settings:
  - Default language
  - Timezone
  - Date format
- Integration configurations per entity:
  - Jira configuration
  - Other integrations
- Entity-level permissions management
- Entity deletion (if admin)

**UI Components:**
- Settings form sections
- File upload for logo
- Integration configuration panels
- Permission management interface

---

## 🔄 Updated Pages (All Existing Pages)

### Pages Requiring Entity Filtering

**Admin Pages (30+ pages):**
- `/scorecard/admin` - Admin dashboard
- `/scorecard/admin/governance-setup` - Governance setup landing
- `/scorecard/admin/governance-setup/entity-setup` - Entity setup (current entity only)
- `/scorecard/admin/governance-setup/ai-project-register` - Project register
- `/scorecard/admin/governance-setup/ai-policy-register` - Policy register
- `/scorecard/admin/governance-setup/aims-scope` - AIMS scope
- `/scorecard/admin/data-manager` - Data manager landing
- `/scorecard/admin/data-manager/evidence` - Evidence manager
- `/scorecard/admin/data-manager/provenance` - Provenance manager
- `/scorecard/admin/data-manager/trust-axes` - Trust axes
- `/scorecard/admin/data-manager/trustmarks` - Trustmarks
- `/scorecard/admin/data-manager/interfaces` - Interfaces/Jira
- `/scorecard/admin/data-register` - Data register
- `/scorecard/admin/control-audit` - Control audit
- `/scorecard/admin/knowledgebase` - Knowledge base (if per-entity)
- `/scorecard/admin/governance-dashboard-reporting` - Dashboard reporting
- `/scorecard/admin/governance-execution` - Governance execution
- `/scorecard/admin/trustops` - TrustOps

**Project Pages (10+ pages):**
- `/scorecard/[projectId]` - Project overview
- `/scorecard/[projectId]/dashboard` - Project dashboard
- `/scorecard/[projectId]/dashboard/kpis_admin` - KPI admin
- `/scorecard/[projectId]/dashboard/pillars_admin` - Pillars admin
- `/scorecard/[projectId]/kpis/[kpiKey]` - KPI detail
- `/scorecard/[projectId]/pillars/[pillarKey]` - Pillar detail
- `/scorecard/[projectId]/report` - Project report
- `/scorecard/[projectId]/vipdashboard` - VIP dashboard

**Other Pages:**
- `/entity` - Entity landing (update to show entity list)
- `/ai_legal_standing` - AI Legal Standing (associate with entity)
- `/leadai-chatbot` - Chatbot (filter by entity)
- `/projects/register` - Project registration (auto-assign to entity)
- `/` - Home page (add entity selector if logged in)

---

## 🧩 New Components

### 1. EntitySelector Component
**File:** `apps/web/src/app/(components)/EntitySelector.tsx`

**Visual Design:**
- Dropdown/select component in **top-right** of header
- Shows current entity name with icon/badge
- Dropdown shows list of accessible entities
- Badge showing entity count (if multiple)
- Visual indicator (highlight) for current entity
- Smooth transition animation on switch

**Features:**
- Click to open dropdown
- Select entity to switch
- Keyboard navigation (arrow keys, enter)
- Search/filter entities in dropdown
- "Manage Entities" link (if user has admin permission)
- Loading state while switching
- **Required before accessing governance dashboards** - Shows modal/page if no entity selected

**Placement:** **Top-right dropdown in header** (always visible when logged in)

**Behavior:**
- **Blocks access** to `/entities/[entityId]/scorecard/...` routes if no entity selected
- Shows entity selection modal/page when user tries to access governance without entity
- Updates URL path when entity switched
- **When switching entities: dashboards & data update immediately**

---

### 2. EntityContext Provider
**File:** `apps/web/src/app/(components)/EntityContext.tsx`

**Purpose:** React context for entity state

**API:**
```typescript
// Hook usage
const { entity, switchEntity, isLoading } = useEntityContext();

// Context provides:
- currentEntity: Entity | null
- accessibleEntities: Entity[]
- switchEntity(entityId: string): Promise<void>
- isLoading: boolean
- error: string | null
```

**Features:**
- Persists entity selection in localStorage
- Validates entity access on mount
- Handles entity switching logic
- Provides loading/error states
- Syncs with URL (if route-based)

---

### 3. EntityBadge Component (Optional)
**File:** `apps/web/src/app/(components)/EntityBadge.tsx`

**Purpose:** Visual indicator of current entity

**Visual Design:**
- Small badge/chip showing entity name
- Optional entity logo/icon
- Color-coded by entity (optional)
- Clickable to open entity selector

**Placement:** 
- Header (next to EntitySelector)
- Breadcrumbs
- Page titles
- Data table headers

---

### 4. EntityGuard Component (Optional)
**File:** `apps/web/src/app/(components)/EntityGuard.tsx`

**Purpose:** Protect routes that require entity context

**Usage:**
```tsx
<EntityGuard>
  <YourPageComponent />
</EntityGuard>
```

**Behavior:**
- Redirects to entity selection if no entity selected
- Shows loading state while entity loads
- Validates entity access
- Shows error if entity access denied

---

## 🎨 Visual Design Changes

### Header Updates
**Before:**
```
[Logo] LeadAI    [Navigation]    [User Menu]
```

**After:**
```
[Logo] LeadAI    [EntitySelector ▼]    [Navigation]    [User Menu]
                  Entity Name (badge)
```

### Entity Selector Design
```
┌─────────────────────────────┐
│ Current Entity              │
│ ┌─────────────────────────┐ │
│ │ 🏢 Acme Corporation    ▼ │ │
│ └─────────────────────────┘ │
│                             │
│ Accessible Entities:        │
│ • Acme Corporation    ✓     │
│ • TechCorp Inc              │
│ • Global Systems            │
│                             │
│ [Manage Entities →]         │
└─────────────────────────────┘
```

### Page Title Updates
**Before:**
```
Projects
```

**After:**
```
Projects - Acme Corporation
[Entity Badge]
```

### Data Table Updates
**Before:**
```
Projects (15)
```

**After:**
```
Projects (15) - Filtered by: Acme Corporation
[Entity Badge] [Clear Filter]
```

---

## 🔀 Routing Changes

### ✅ Selected: Option A - Entity in URL Path

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

**Implementation:**
- Move scorecard routes under `entities/[entityId]/scorecard/` directory structure
- Extract entity_id from URL params in layouts using Next.js dynamic routes
- Update all internal links to include entity_id prefix
- Add redirects from old routes to new routes (with default entity during migration)
- Entity switching updates URL path
- Create layout at `entities/[entityId]/layout.tsx` to extract and validate entity_id

**Directory Structure:**
```
apps/web/src/app/
├── entities/
│   └── [entityId]/
│       ├── layout.tsx (extract entity_id, validate access)
│       ├── scorecard/
│       │   ├── layout.tsx (scorecard layout with entity context)
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

**Benefits:**
- ✅ Explicit entity context in URL
- ✅ Bookmarkable/shareable URLs
- ✅ Clear entity context
- ✅ Works with browser back/forward
- ✅ Better for debugging (entity visible in URL)
- ✅ SEO-friendly (if pages become public)

**Migration Strategy:**
1. Create new route structure alongside existing routes
2. Add redirects from old routes: `/scorecard/...` → `/entities/{defaultEntityId}/scorecard/...`
3. Update all links gradually to use new routes
4. Remove old routes after full migration

---

## 📱 User Experience Flows

### Flow 1: First-Time User Login
```
1. User logs in
   ↓
2. Check: Does user have entities?
   ├─ Yes → Check: Single or multiple?
   │   ├─ Single → Auto-select, redirect to /entities/{id}/overview
   │   └─ Multiple → Show entity selector modal/page
   │       └─ User MUST select entity before accessing governance dashboards
   │       └─ After selection → redirect to /entities/{id}/overview
   └─ No → Redirect to entity creation or show error
           "You need access to an entity. Request access or create one."
```

### Flow 2: Entity Switching
```
1. User clicks EntitySelector (top-right dropdown)
   ↓
2. Dropdown shows accessible entities
   ↓
3. User selects new entity
   ↓
4. URL updated: /entities/{newEntityId}/scorecard/...
   ↓
5. Entity context updated (from URL)
   ↓
6. Dashboards & data update immediately (React state update)
   ↓
7. Current page shows new entity's data (no full page reload needed)
```

### Flow 3: Creating New Project
```
1. User navigates to Project Register
   ↓
2. Form shows current entity context badge
   ↓
3. User fills project form
   ↓
4. On submit, entity_id automatically included
   ↓
5. Project created and assigned to current entity
   ↓
6. Redirect to new project dashboard
```

### Flow 4: Accessing Project from Different Entity
```
1. User tries to access /scorecard/project-xyz/dashboard
   ↓
2. System checks: Does project belong to current entity?
   ├─ Yes → Show project dashboard
   └─ No → Show 403 error or redirect to entity selector
            "This project belongs to Entity ABC. Switch entity?"
```

---

## 🔐 Access Control UI

### Entity Access Denied
**UI Element:** Error page/modal
```
┌─────────────────────────────────────┐
│ ⚠️ Access Denied                    │
│                                     │
│ You don't have access to this      │
│ entity.                             │
│                                     │
│ [Switch to Accessible Entity]      │
│ [Request Access]                    │
└─────────────────────────────────────┘
```

### No Entity Selected
**UI Element:** Entity selection modal
```
┌─────────────────────────────────────┐
│ Select Entity                        │
│                                     │
│ Please select an entity to continue:│
│                                     │
│ [Entity Selector Dropdown]          │
│                                     │
│ [Continue] [Create New Entity]      │
└─────────────────────────────────────┘
```

---

## 📊 Component Update Summary

### Components Requiring Entity Filtering
- ✅ ProjectRegisterPage - Auto-include entity_id
- ✅ EditKpis - Filter KPIs by entity (if per-entity)
- ✅ EditPillars - Filter pillars by entity (if per-entity)
- ✅ ControlValuesTable - Filter by entity
- ✅ AuditLogPageClient - Filter audit logs by entity
- ✅ JiraInterfacesClient - Filter Jira configs by entity
- ✅ ChatbotWidget - Include entity_id in queries
- ✅ DashboardHeader - Show entity context
- ✅ DashboardShell - Filter by entity
- ✅ PillarBar - Filter by entity (if per-entity)
- ✅ KpiTable - Filter by entity (if per-entity)
- ✅ All form components - Auto-include entity_id

### Components Requiring Entity Display
- ✅ Header - Entity selector
- ✅ AdminSidebar - Entity context, filtered menu
- ✅ LandingSidebar - Entity selector (if logged in)
- ✅ Breadcrumbs - Entity context
- ✅ Page titles - Entity badge
- ✅ Data tables - Entity filter indicator

---

## 🎯 Implementation Priority

### Phase 1: Core Entity Infrastructure
1. Create EntityContext provider
2. Create EntitySelector component
3. Update layout.tsx to include EntityContext
4. Update Header to show EntitySelector
5. Add entity_id to all API calls

### Phase 2: Entity Management
1. Create Entity Management page
2. Create Entity Settings page
3. Update entity/page.tsx to show entity list
4. Add entity creation flow

### Phase 3: Page Updates
1. Update all admin pages (filter by entity)
2. Update all project pages (validate entity)
3. Update all data display components
4. Update all forms (auto-include entity_id)

### Phase 4: UX Polish
1. Add entity badges/indicators
2. Add entity switching animations
3. Add entity context breadcrumbs
4. Add entity filter indicators
5. Improve error handling (403s, entity access)

---

## 📝 Translation Keys Needed

**New Translation Keys:**
```json
{
  "entity": {
    "selector": {
      "title": "Select Entity",
      "current": "Current Entity",
      "switch": "Switch Entity",
      "manage": "Manage Entities",
      "noAccess": "No entities available",
      "loading": "Loading entities..."
    },
    "management": {
      "title": "Entity Management",
      "create": "Create Entity",
      "edit": "Edit Entity",
      "delete": "Delete Entity",
      "switch": "Switch to Entity",
      "name": "Entity Name",
      "slug": "Entity Slug",
      "status": "Status",
      "projects": "Projects",
      "users": "Users"
    },
    "badge": {
      "filteredBy": "Filtered by: {entity}",
      "current": "Current: {entity}"
    },
    "errors": {
      "noEntitySelected": "Please select an entity to continue",
      "accessDenied": "You don't have access to this entity",
      "projectWrongEntity": "This project belongs to a different entity"
    }
  }
}
```

---

## ✅ Summary

### New Pages: 4
1. **Entity Management** (`/admin/entities`) - Admin-only, list/create/edit entities
2. **User-Entity Access Management** (`/admin/entities/[entityId]/users`) - Admin-only, manage user access
3. **Entity Overview / Landing** (`/entities/[entityId]/overview`) - Single entry point for entity governance
4. **Entity Settings** (`/entities/[entityId]/settings`) - Entity-specific configuration

### New Components: 4
1. EntitySelector
2. EntityContext Provider
3. EntityBadge (optional)
4. EntityGuard (optional)

### Updated Pages: 50+
- All admin pages (30+)
- All project pages (10+)
- All data management pages
- Landing/home pages
- Entity registration page

### Updated Components: 15+
- All data display components
- All form components
- Navigation components
- Dashboard components

### Visual Changes:
- Entity selector in header
- Entity badges/indicators throughout UI
- Entity context in page titles
- Entity filter indicators on data tables
- Entity switching UI/animations

---

## 🚀 Migration Strategy

**Step 1:** Add EntityContext and EntitySelector (non-breaking)
**Step 2:** Update API calls to include entity_id (defaults to single entity)
**Step 3:** Update pages to filter by entity (gradual rollout)
**Step 4:** Add entity management pages
**Step 5:** Enable multi-entity switching
**Step 6:** Add route-based entity context (optional)

This phased approach allows gradual migration without breaking existing functionality.

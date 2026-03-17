# Multi-Entity Migration - Remaining Work

**Last Updated:** February 10, 2026  
**Status:** Backend ~90% Complete, Frontend 0% Complete

---

## 🔴 CRITICAL - Must Fix Before Production

### 1. Authorization Integration (SECURITY RISK)
**Status:** 🔴 **NOT INTEGRATED** - Authorization service exists but routers don't use it

**Problem:**
- Authorization service (`verify_entity_access`, `get_entity_id_with_auth`) is fully implemented
- **NO routers currently use `get_entity_id_with_auth()`**
- All routers use `get_entity_id_optional()` without authorization checks
- Users can access any entity if they know the ID

**Impact:** 🔴 **CRITICAL SECURITY VULNERABILITY**

**Required Actions:**
1. Replace `get_entity_id_optional` with `get_entity_id_with_auth` in ALL protected endpoints
2. Update these routers (12+ routers):
   - `projects.py` - All endpoints
   - `admin.py` - All endpoints  
   - `trends.py` - All endpoints
   - `trust_axes.py` - All endpoints
   - `kpidetail.py` - All endpoints
   - `ai_reports.py` - All endpoints
   - `evidence.py` - All endpoints
   - `reports.py` - All endpoints
   - `audit.py` - All endpoints
   - `jira.py` - All endpoints
   - `provenance_admin.py` - All endpoints
   - `scorecard.py` - All endpoints

**Code Pattern:**
```python
# BEFORE (insecure):
entity_id: Optional[UUID] = Depends(get_entity_id_optional)

# AFTER (secure):
entity_id: UUID = Depends(get_entity_id_with_auth)
```

**Estimated Time:** 1-2 days  
**Priority:** 🔴 **CRITICAL - BLOCKS PRODUCTION**

---

### 2. User Authentication Integration
**Status:** ⚠️ **NOT PRODUCTION-READY**

**Problem:**
- `get_current_user_id()` currently uses `X-User-ID` header (not secure)
- Needs integration with JWT/session (NextAuth)
- TODO comment indicates need for real auth integration

**Required Actions:**
1. Update `get_current_user_id()` to extract from JWT token or NextAuth session
2. Integrate with NextAuth authentication
3. Handle unauthenticated requests properly
4. Remove header-based fallback (or make it dev-only)

**Estimated Time:** 2-3 days  
**Priority:** 🟡 **HIGH - REQUIRED FOR PRODUCTION**

---

## 🟡 HIGH PRIORITY - Complete Backend

### 3. Background Jobs - KPI Recompute Scheduler
**Status:** ⚠️ **NEEDS ENTITY_ID FILTERING**

**Problem:**
- `_kpi_recompute_scheduler()` in `main.py` doesn't filter by entity_id
- Processes all projects globally instead of per-entity

**Required Actions:**
1. Update `recompute_all()` function to accept `entity_id` parameter
2. Update scheduler to iterate per entity (like provenance scheduler)
3. Filter projects by entity_id before recomputing

**Code Pattern:**
```python
# Process per-entity
for entity_id in entities:
    await recompute_all(entity_id=entity_id)
```

**Estimated Time:** 1 day  
**Priority:** 🟡 **HIGH**

---

### 4. Review AI Legal Standing Router
**Status:** ❓ **NEEDS REVIEW**

**Problem:**
- `ai_legal_standing.py` router exists but unclear if it needs entity_id
- Currently only has `/health` and `/assess` endpoints
- `/assess` is pure calculation (no database storage)

**Required Actions:**
1. Determine if assessments should be stored per entity
2. If stored: Add entity_id filtering and storage
3. If public: Document why it doesn't need entity filtering

**Estimated Time:** 0.5 day  
**Priority:** 🟡 **MEDIUM**

---

## 🟢 MEDIUM PRIORITY - Integration Testing

### 5. Integration Tests (55 tests pending)
**Status:** ⚠️ **0% COMPLETE**

**Problem:**
- Unit tests exist (62 passing ✅)
- Integration tests require database setup (55 tests pending)

**Required Actions:**
1. Set up test database connection
2. Create test fixtures for entities, users, projects
3. Implement entity isolation tests
4. Implement authorization tests
5. Implement router integration tests

**Test Categories:**
- Entity isolation (15 tests)
- Authorization (15 tests)
- Router integration (25 tests)

**Estimated Time:** 2-3 days  
**Priority:** 🟢 **MEDIUM - QUALITY ASSURANCE**

---

## ❌ NOT STARTED - Frontend Implementation

### 6. Frontend Entity Infrastructure
**Status:** ❌ **0% COMPLETE**

**Required Components:**

#### 6.1 EntityContext Provider
- React context for entity state management
- Current entity state
- Entity switching logic
- Entity persistence (localStorage/sessionStorage)
- Entity validation (check user access)
- Entity loading states

**File:** `apps/web/src/app/(components)/EntityContext.tsx`

#### 6.2 EntitySelector Component
- Global entity switcher/selector
- Dropdown showing current entity
- List of accessible entities
- Quick switch functionality
- Badge showing entity count
- Visual indicator of current entity
- "Manage Entities" link (if admin)

**File:** `apps/web/src/app/(components)/EntitySelector.tsx`  
**Placement:** Top-right dropdown in header (always visible when logged in)

**Behavior:**
- **Required before accessing governance dashboards** - Shows modal/page if no entity selected
- Blocks access to `/entities/[entityId]/scorecard/...` routes if no entity selected
- Updates URL path when entity switched
- Persists selection in localStorage (fallback)

#### 6.3 Entity Management Pages
- **Entity List Page** (`/admin/entities` or `/entities`)
  - List all entities user has access to
  - Create new entity (if user has permission)
  - Edit entity details
  - View entity statistics
  - Switch/select active entity

- **User-Entity Access Management** (`/admin/entities/[entityId]/users`)
  - Manage which users can access which entities
  - Assign roles (admin, editor, viewer)
  - Remove user access

- **Entity Overview/Landing** (`/entities/[entityId]/overview`)
  - Single entry point for entity governance
  - Entity dashboard
  - Quick stats and links

**Estimated Time:** 3-5 days  
**Priority:** 🟢 **MEDIUM - REQUIRED FOR MULTI-ENTITY UI**

---

### 7. Frontend Route Updates
**Status:** ❌ **NOT STARTED**

**Required Changes:**

#### 7.1 Update Route Structure
- Add entity_id to all routes: `/entities/[entityId]/scorecard/...`
- Update all page components to extract entity_id from URL
- Update navigation to include entity context

#### 7.2 Update API Calls
- Add `entity_id` parameter to all API calls
- Update API client libraries (`coreApiBase`, `regApiBase`)
- Ensure entity_id is passed from URL context

#### 7.3 Update Components (50+ components)
- All admin pages (30+)
- All project pages (10+)
- All data management pages
- Landing/home pages
- Entity registration page

**Components Requiring Updates:**
- ProjectRegisterPage - Auto-include entity_id
- EditKpis - Filter KPIs by entity
- EditPillars - Filter pillars by entity
- ControlValuesTable - Filter by entity
- AuditLogPageClient - Filter audit logs by entity
- JiraInterfacesClient - Filter Jira configs by entity
- ChatbotWidget - Include entity_id in queries
- DashboardHeader - Show entity context
- DashboardShell - Filter by entity
- All form components - Auto-include entity_id

**Estimated Time:** 5-7 days  
**Priority:** 🟢 **MEDIUM - REQUIRED FOR MULTI-ENTITY UI**

---

## 📊 Summary

### Backend Status: ~90% Complete
- ✅ Database migrations (100%)
- ✅ Backend dependencies (100%)
- ✅ Authorization service (100%)
- ✅ Router updates (90% - needs authorization integration)
- ✅ Core services (95%)
- ⚠️ Background jobs (70% - KPI scheduler needs update)
- ❌ Integration tests (0%)

### Frontend Status: 0% Complete
- ❌ EntityContext Provider
- ❌ EntitySelector Component
- ❌ Entity Management Pages
- ❌ Route updates
- ❌ Component updates
- ❌ API integration

### Critical Path to Production:
1. **Authorization Integration** (1-2 days) - 🔴 BLOCKS PRODUCTION
2. **User Authentication Integration** (2-3 days) - 🟡 REQUIRED FOR PRODUCTION
3. **KPI Scheduler Update** (1 day) - 🟡 HIGH PRIORITY
4. **Integration Tests** (2-3 days) - 🟢 QUALITY ASSURANCE

### Total Estimated Time:
- **Backend Completion:** 4-6 days
- **Frontend Implementation:** 8-12 days
- **Total:** 12-18 days

---

## 🎯 Recommended Order

1. **Week 1: Security & Backend Completion**
   - Day 1-2: Authorization integration
   - Day 3-5: User authentication integration
   - Day 6: KPI scheduler update

2. **Week 2: Frontend Foundation**
   - Day 1-2: EntityContext Provider
   - Day 3-4: EntitySelector Component
   - Day 5: Entity Management Pages

3. **Week 3: Frontend Integration**
   - Day 1-3: Route updates
   - Day 4-5: Component updates
   - Day 6-7: API integration

4. **Week 4: Testing & Polish**
   - Day 1-3: Integration tests
   - Day 4-5: Frontend testing
   - Day 6-7: Bug fixes and polish

---

## 📝 Notes

- Backend is nearly complete but **cannot go to production** without authorization integration
- Frontend work can proceed in parallel with backend security fixes
- Integration tests should be done after authorization is integrated
- Consider phased rollout: Backend first, then frontend gradually

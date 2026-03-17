# Test Summary

## Overview

This document summarizes the tests created for the LeadAI Trust Framework frontend and backend.

## Backend Tests (Python/FastAPI)

### New Test Files Created

1. **`test_dependencies.py`** - Tests for entity ID extraction functions
   - `get_entity_id_from_path` - Extract from URL path
   - `get_entity_id_optional` - Extract from query/header (optional)
   - `get_entity_id` - Extract from query/header (required)
   - 15 tests covering validation, error handling, and precedence

2. **`test_evidence_dao.py`** - Tests for evidence database access object
   - `insert_evidence` - Insert evidence with entity_id
   - `update_evidence_uploaded` - Update evidence status
   - `get_evidence` - Get evidence with/without entity_id filter
   - `list_evidence` - List evidence filtered by entity_id
   - `insert_audit` - Insert audit entries
   - `list_audit` - List audit entries with entity_id filter
   - 12 tests covering all DAO functions

3. **`test_guardrails_engine.py`** - Tests for guardrails engine
   - `_table_exists` - Check if table exists
   - `load_fact_sources` - Load fact sources from DB
   - `load_guardrail_rules` - Load guardrail rules
   - `compute_project_facts` - Compute project facts
   - `apply_guardrails_for_project` - Apply guardrail caps
   - `compute_raw_pillars_for_project` - Compute raw pillar scores
   - `diagnose_guardrails_for_project` - Full diagnostic
   - 30+ tests covering all engine functions

4. **`test_evidence_router.py`** - Tests for evidence router endpoints
   - `evidence_init` - Initialize evidence upload
   - `evidence_finalize` - Finalize evidence upload
   - `evidence_list_route` - List evidence items
   - `evidence_audit_route` - Get audit trail
   - `evidence_download_url` - Get download URL
   - `evidence_download_file` - Download file
   - `resolve_control_id` - Resolve control ID
   - Helper functions: `_normalize_path`, `_local_path_from_uri`, `_get_entity_id_from_project_slug_sync`
   - 23 tests covering all endpoints and error cases

### Test Statistics

- **Total Backend Tests**: 80+ tests
- **Coverage**: Dependencies, DAO, Guardrails Engine, Evidence Router
- **Status**: All tests passing ✅

## Frontend Tests (Next.js/React)

### Test Infrastructure Setup

1. **Vitest Configuration** (`vitest.config.ts`)
   - Configured for React/Next.js
   - JSdom environment for DOM testing
   - Path aliases configured

2. **Test Setup** (`tests/setup.ts`)
   - React Testing Library cleanup
   - Jest DOM matchers
   - Global fetch mocking

3. **Playwright Configuration** (`playwright.config.ts`)
   - E2E test configuration
   - Multiple browser support
   - Local dev server integration

### New Test Files Created

1. **`tests/lib/evidenceClient.test.ts`** - Unit tests for evidence client library
   - `initEvidence` - Initialize evidence upload with fallback
   - `putEvidenceBytes` - Upload file bytes
   - `finalizeEvidence` - Finalize upload
   - `listEvidence` - List evidence with normalization
   - `resolveControlId` - Resolve control ID
   - `getDownloadUrl` - Get download URL
   - `deleteEvidence` - Delete evidence
   - `uploadEvidenceFile` - Complete upload flow
   - 15+ tests covering all client functions

2. **`tests/components/ProjectRegisterPage.test.tsx`** - Component tests
   - Form rendering
   - Form validation
   - Form submission
   - Error handling
   - Edit mode
   - 8+ tests covering component behavior

3. **`tests/e2e/evidence-upload.spec.ts`** - E2E tests for evidence upload
   - Upload button visibility
   - File picker interaction
   - Upload progress
   - Success/error handling
   - Evidence listing
   - Download functionality
   - Delete functionality
   - 8+ E2E tests covering user flows

### Test Statistics

- **Total Frontend Tests**: 30+ tests
- **Coverage**: Client library, Components, E2E flows
- **Status**: Ready for execution ✅

## Running Tests

### Backend Tests

```bash
cd apps/core-svc
docker compose run --rm core-svc python -m pytest tests/ -v
```

### Frontend Tests

```bash
cd apps/web

# Unit/Component tests
pnpm test

# E2E tests
npx playwright test
```

## Test Coverage Areas

### Backend
- ✅ Entity ID extraction and validation
- ✅ Evidence DAO with entity_id support
- ✅ Guardrails engine functionality
- ✅ Evidence router endpoints
- ✅ Error handling and edge cases

### Frontend
- ✅ Evidence client library functions
- ✅ Project registration component
- ✅ Evidence upload E2E flow
- ✅ API integration and error handling

## Next Steps

1. Install frontend test dependencies:
   ```bash
   cd apps/web
   pnpm install
   ```

2. Run frontend tests:
   ```bash
   pnpm test
   npx playwright install
   npx playwright test
   ```

3. Add more component tests as needed
4. Expand E2E test coverage for other user flows
5. Set up CI/CD integration for automated testing

# Frontend Tests

This directory contains tests for the Next.js frontend application.

## Test Structure

- `lib/` - Unit tests for utility libraries
- `components/` - Component tests using React Testing Library
- `e2e/` - End-to-end tests using Playwright

## Running Tests

### Unit and Component Tests (Vitest)

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test --watch

# Run tests with UI
pnpm test:ui

# Run tests with coverage
pnpm test:coverage
```

### E2E Tests (Playwright)

```bash
# Install Playwright browsers (first time only)
npx playwright install

# Run E2E tests
npx playwright test

# Run E2E tests in UI mode
npx playwright test --ui

# Run specific test file
npx playwright test tests/e2e/evidence-upload.spec.ts
```

## Test Files

### `lib/evidenceClient.test.ts`
Tests for the evidence client library functions:
- `initEvidence` - Initialize evidence upload
- `putEvidenceBytes` - Upload file bytes
- `finalizeEvidence` - Finalize upload
- `listEvidence` - List evidence items
- `resolveControlId` - Resolve control ID
- `getDownloadUrl` - Get download URL
- `deleteEvidence` - Delete evidence
- `uploadEvidenceFile` - Complete upload flow

### `components/ProjectRegisterPage.test.tsx`
Component tests for ProjectRegisterPage:
- Form rendering
- Form validation
- Form submission
- Error handling
- Edit mode

### `e2e/evidence-upload.spec.ts`
End-to-end tests for evidence upload flow:
- Upload button visibility
- File picker interaction
- Upload progress
- Success/error handling
- Evidence listing
- Download functionality
- Delete functionality

## Writing New Tests

### Unit Tests

```typescript
import { describe, it, expect } from 'vitest';
import { myFunction } from '@/lib/myModule';

describe('myFunction', () => {
  it('should do something', () => {
    expect(myFunction()).toBe(expected);
  });
});
```

### Component Tests

```typescript
import { render, screen } from '@testing-library/react';
import { MyComponent } from '@/app/(components)/MyComponent';

describe('MyComponent', () => {
  it('should render', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

### E2E Tests

```typescript
import { test, expect } from '@playwright/test';

test('should do something', async ({ page }) => {
  await page.goto('/my-page');
  await expect(page.getByText('Hello')).toBeVisible();
});
```

## Mocking

- API calls are mocked using `vi.mock()` in Vitest
- Fetch API is mocked globally in `setup.ts`
- E2E tests use Playwright's `route()` for API mocking

## Coverage

Run coverage reports with:
```bash
pnpm test:coverage
```

Coverage reports are generated in `coverage/` directory.

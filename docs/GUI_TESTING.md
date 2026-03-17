# GUI Smoke & Authenticated Testing (Playwright)

This document captures exactly how the GUI smoke tests were created and how to run them against **https://dev.theleadai.co.uk**, including Cloudflare Access configuration, test bypass, and expected outcomes.

---

## 1) What We Built

**Smoke test suites (Playwright):**
- `apps/web/tests/e2e/smoke-dev.spec.ts`
  - Unauthenticated smoke checks (public pages + basic routing)
- `apps/web/tests/e2e/smoke-auth-dev.spec.ts`
  - Authenticated smoke checks (admin/privileged pages)

**Playwright config updates:**
- `apps/web/playwright.config.ts`
  - Supports remote base URL via `PLAYWRIGHT_BASE_URL`
  - Skips local web server for remote tests (`PLAYWRIGHT_SKIP_WEBSERVER=1`)
  - Injects Cloudflare Access headers when present

**Local-only e2e test:**
- `apps/web/tests/e2e/evidence-upload.spec.ts`
  - Marked **local-only** and skipped for remote runs

---

## 2) Prerequisites

### Tooling
- Node + pnpm
- Playwright browser binaries

Install dependencies:
```bash
pnpm -C apps/web install
pnpm -C apps/web exec playwright install
```

### Cloudflare Access (Required for dev)
Dev is protected by Cloudflare Access. To run tests headlessly:

1) Create a **Service Token** in Cloudflare Zero Trust  
2) Add a **Service Auth** policy to the `leadai_ai_governance_dashboard` app:
   - Action: `Service Auth`
   - Include: the Service Token created above
   - Move to top of policy order
3) Verify token works:
```bash
curl -I \
  -H "CF-Access-Client-Id: <id>" \
  -H "CF-Access-Client-Secret: <secret>" \
  https://dev.theleadai.co.uk/blueprint-limited/scorecard/admin/governance-setup
```
Expected: **HTTP 200** (not a redirect to `cloudflareaccess.com`)

---

## 3) Test Bypass (Dev Only)

Some admin endpoints require authentication. For consistent automated tests, we enabled a **dev-only bypass** in core-svc.

**Environment variables (core-svc):**
```
TEST_BYPASS_ENABLED=1
TEST_BYPASS_USER_ID=<backend-user-uuid>
```

On local dev (Docker Compose):
```bash
docker compose up -d --force-recreate core-svc
```

Verify:
```bash
docker compose exec -T core-svc printenv TEST_BYPASS_ENABLED TEST_BYPASS_USER_ID
```

---

## 4) Environment Variables Used by Playwright

```
PLAYWRIGHT_BASE_URL=https://dev.theleadai.co.uk
PLAYWRIGHT_SKIP_WEBSERVER=1
CF_ACCESS_CLIENT_ID=<service-token-id>
CF_ACCESS_CLIENT_SECRET=<service-token-secret>
```

Notes:
- **Never commit** the Cloudflare token values.
- Tokens can be rotated after a test run.

---

## 5) How the Smoke Tests Work

### Unauthenticated Smoke (`smoke-dev.spec.ts`)
Validates:
- Page loads (HTTP < 400)
- No generic error screens (404/“Something went wrong”)
- Basic expected UI text appears

Pages covered:
- `/`
- `/ai_legal_standing`
- `/aireadinesscheck`
- `/register`
- `/scorecard/admin/governance-dashboard-reporting` (may resolve or redirect)
- `/blueprint-limited/scorecard/admin/governance-dashboard-reporting`
- `/blueprint-limited/scorecard/ai-document-processing-blueprint/vipdashboard`

### Authenticated Smoke (`smoke-auth-dev.spec.ts`)
Validates with bypass + Cloudflare Access:
- Governance setup pages load
- Entity onboarding loads
- Projects register page loads
- AI project management page loads
- VIP dashboard loads

Pages covered:
- `/blueprint-limited/scorecard/admin/governance-setup`
- `/blueprint-limited/scorecard/admin/governance-setup/entity-setup`
- `/blueprint-limited/projects/register`
- `/blueprint-limited/scorecard/admin/governance-execution/ai-project-management`
- `/blueprint-limited/scorecard/ai-document-processing-blueprint/vipdashboard`

---

## 6) Running the Tests

### Unauthenticated smoke only
```bash
PLAYWRIGHT_BASE_URL=https://dev.theleadai.co.uk \
PLAYWRIGHT_SKIP_WEBSERVER=1 \
CF_ACCESS_CLIENT_ID=... \
CF_ACCESS_CLIENT_SECRET=... \
pnpm -C apps/web exec playwright test tests/e2e/smoke-dev.spec.ts
```

### Authenticated smoke only
```bash
PLAYWRIGHT_BASE_URL=https://dev.theleadai.co.uk \
PLAYWRIGHT_SKIP_WEBSERVER=1 \
CF_ACCESS_CLIENT_ID=... \
CF_ACCESS_CLIENT_SECRET=... \
pnpm -C apps/web exec playwright test tests/e2e/smoke-auth-dev.spec.ts
```

### Full GUI smoke suite (auth + unauth)
```bash
PLAYWRIGHT_BASE_URL=https://dev.theleadai.co.uk \
PLAYWRIGHT_SKIP_WEBSERVER=1 \
CF_ACCESS_CLIENT_ID=... \
CF_ACCESS_CLIENT_SECRET=... \
pnpm -C apps/web exec playwright test \
  tests/e2e/smoke-dev.spec.ts \
  tests/e2e/smoke-auth-dev.spec.ts
```

---

## 7) Outcomes & Interpretation

**When tests pass:**
- Core routes load correctly
- App renders without generic error pages
- Basic admin pages are reachable with bypass

**When tests fail:**
- Usually indicates one of:
  - Cloudflare Access misconfiguration
  - Auth bypass not enabled
  - Route regression or missing data
  - UI page failed to render

---

## 8) Artifacts & Logs

Playwright stores output in:
```
apps/web/test-results/
```

Each failure includes an `error-context.md` snapshot for quick debugging.

---

## 9) Coverage Notes

These are **smoke tests**, not full functional regression tests.  
They ensure pages load and basic UI content appears, but they do **not**:
- create or delete data
- submit complex forms
- validate business rules deeply

For deeper coverage, expand to functional flows (CRUD, report generation, KPI edits, etc.).

---

## Latest Run (2026-02-16)

### Playwright Smoke Suite
Command:
```bash
PLAYWRIGHT_BASE_URL=https://dev.theleadai.co.uk \
PLAYWRIGHT_SKIP_WEBSERVER=1 \
CF_ACCESS_CLIENT_ID=*** \
CF_ACCESS_CLIENT_SECRET=*** \
pnpm -C apps/web exec playwright test \
  tests/e2e/smoke-dev.spec.ts \
  tests/e2e/smoke-auth-dev.spec.ts
```

Result:
```
39 passed (11.5s)
```

### Endpoint Health Checks
```
https://dev.theleadai.co.uk/                               → 200
https://dev.theleadai.co.uk/blueprint-limited/scorecard/admin/governance-setup/control-register → 200
https://api.theleadai.co.uk/entity/health                  → 200
```

### LLM Report Health Checks (Ollama)
```
/admin/ai-reports/projects/ai-document-processing-blueprint/ai-summary-llm → 200
/admin/ai-reports/projects/ai-document-processing-blueprint/governance-requirements-report → 200
```

Notes:
- Warnings about `NO_COLOR` in Playwright are harmless.
- Health checks verify route availability and LLM endpoints respond, but do not validate report content.

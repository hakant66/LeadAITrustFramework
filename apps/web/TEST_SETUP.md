# Test Setup Guide

## Fixing Installation Issues

If you encounter `ERR_PNPM_SPEC_NOT_SUPPORTED_BY_ANY_RESOLVER` error:

1. **Clean install**:
   ```bash
   cd apps/web
   rm -rf node_modules pnpm-lock.yaml
   pnpm install
   ```

2. **If that doesn't work, try**:
   ```bash
   pnpm install --no-frozen-lockfile
   ```

## Installing Dependencies

Run these commands **one at a time** (don't include comments in the same line):

```bash
cd apps/web
pnpm install
```

Then run tests:

```bash
pnpm test
```

## Installing Playwright

After dependencies are installed:

```bash
npx playwright install
```

Then run E2E tests:

```bash
npx playwright test
```

## Troubleshooting

### Vitest not found
- Make sure `pnpm install` completed successfully
- Check that `node_modules/.bin/vitest` exists
- Try: `pnpm exec vitest`

### Playwright errors
- Make sure `@playwright/test` is in devDependencies
- Run `pnpm install` first
- Then `npx playwright install`

### Module resolution errors
- Check that `vitest.config.ts` has correct path aliases
- Verify `tsconfig.json` paths match vitest config

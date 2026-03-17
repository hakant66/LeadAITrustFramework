import { test, expect } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
const isRemote =
  !baseURL.includes('localhost') && !baseURL.includes('127.0.0.1');

async function expectNoErrorPage(page: any) {
  await expect(
    page.locator(
      'text=/Something went wrong|Bir şeyler ters gitti|This page could not be found|Bu sayfa bulunamadı/i'
    )
  ).toHaveCount(0);
}

test.describe('Authenticated dev smoke (bypass)', () => {
  test.skip(
    isRemote && !process.env.CF_ACCESS_CLIENT_ID,
    'Cloudflare Access headers required for remote dev tests'
  );

  test.beforeEach(async ({ page }) => {
    if (isRemote) {
      await page.addStyleTag({ content: '* { animation: none !important; }' });
    }
  });

  test('Entity governance setup loads', async ({ page }) => {
    const resp = await page.goto(
      '/blueprint-limited/scorecard/admin/governance-setup',
      { waitUntil: 'domcontentloaded' }
    );
    expect(resp?.status()).toBeLessThan(400);
    await expectNoErrorPage(page);
    await expect(
      page.getByRole('heading', { name: /AI Governance Setup/i })
    ).toBeVisible();
  });

  test('Entity onboarding loads', async ({ page }) => {
    const resp = await page.goto(
      '/blueprint-limited/scorecard/admin/governance-setup/entity-setup',
      { waitUntil: 'domcontentloaded' }
    );
    expect(resp?.status()).toBeLessThan(400);
    await expectNoErrorPage(page);
    await expect(
      page.getByRole('heading', { name: /Entity Onboarding/i })
    ).toBeVisible();
  });

  test('Projects register loads', async ({ page }) => {
    const resp = await page.goto('/blueprint-limited/projects/register', {
      waitUntil: 'domcontentloaded',
    });
    expect(resp?.status()).toBeLessThan(400);
    await expectNoErrorPage(page);
    await expect(
      page.getByRole('heading', { name: /AI Projects Register/i })
    ).toBeVisible();
  });

  test('AI project management loads', async ({ page }) => {
    const resp = await page.goto(
      '/blueprint-limited/scorecard/admin/governance-execution/ai-project-management',
      { waitUntil: 'domcontentloaded' }
    );
    expect(resp?.status()).toBeLessThan(400);
    await expectNoErrorPage(page);
    await expect(
      page.getByRole('heading', { name: /AI Project Management/i })
    ).toBeVisible();
  });

  test('AI control register loads', async ({ page }) => {
    const resp = await page.goto(
      '/blueprint-limited/scorecard/admin/governance-setup/control-register',
      { waitUntil: 'domcontentloaded' }
    );
    expect(resp?.status()).toBeLessThan(400);
    await expectNoErrorPage(page);
    await expect(
      page.getByRole('heading', { name: /AI Control Register/i })
    ).toBeVisible();
  });

  test('Entity VIP dashboard loads', async ({ page }) => {
    const resp = await page.goto(
      '/blueprint-limited/scorecard/ai-document-processing-blueprint/vipdashboard',
      { waitUntil: 'domcontentloaded' }
    );
    expect(resp?.status()).toBeLessThan(400);
    await expectNoErrorPage(page);
    await expect(
      page.locator('text=Project Trust Score').first()
    ).toBeVisible();
  });
});

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

function expectUrlMatch(actual: string, patterns: RegExp[], label: string) {
  const ok = patterns.some((p) => p.test(actual));
  expect(ok, `${label} url mismatch: ${actual}`).toBeTruthy();
}

test.describe('Dev smoke', () => {
  test.beforeEach(async ({ page }) => {
    if (isRemote) {
      // Keep remote runs stable by disabling animations.
      await page.addStyleTag({ content: '* { animation: none !important; }' });
    }
  });

  test('Landing page loads', async ({ page }) => {
    const resp = await page.goto('/', { waitUntil: 'domcontentloaded' });
    expect(resp?.status()).toBeLessThan(400);
    await expectNoErrorPage(page);
    await expect(page.getByText(/LeadAI/i).first()).toBeVisible();
  });

  test('AI Legal Standing loads', async ({ page }) => {
    const resp = await page.goto('/ai_legal_standing', {
      waitUntil: 'domcontentloaded',
    });
    expect(resp?.status()).toBeLessThan(400);
    await expectNoErrorPage(page);
  });

  test('AI Readiness Check loads', async ({ page }) => {
    const resp = await page.goto('/aireadinesscheck', {
      waitUntil: 'domcontentloaded',
    });
    expect(resp?.status()).toBeLessThan(400);
    await expectNoErrorPage(page);
  });

  test('Register page loads', async ({ page }) => {
    const resp = await page.goto('/register', {
      waitUntil: 'domcontentloaded',
    });
    expect(resp?.status()).toBeLessThan(400);
    await expectNoErrorPage(page);
    await expect(page.getByRole('textbox')).toBeVisible();
  });

  test('Governance dashboard resolves (register or direct)', async ({
    page,
  }) => {
    const resp = await page.goto('/scorecard/admin/governance-dashboard-reporting', {
      waitUntil: 'domcontentloaded',
    });
    expect(resp?.status()).toBeLessThan(400);
    await expectNoErrorPage(page);
    expectUrlMatch(
      page.url(),
      [
        /\/register/,
        /cloudflareaccess\.com/,
        /\/scorecard\/admin\/governance-dashboard-reporting/,
        /\/blueprint-limited\/scorecard\/admin\/governance-dashboard-reporting/,
      ],
      'governance dashboard'
    );
  });

  test('Entity governance dashboard resolves', async ({ page }) => {
    const resp = await page.goto(
      '/blueprint-limited/scorecard/admin/governance-dashboard-reporting',
      { waitUntil: 'domcontentloaded' }
    );
    expect(resp?.status()).toBeLessThan(400);
    await expectNoErrorPage(page);
    expectUrlMatch(
      page.url(),
      [/\/register/, /blueprint-limited\//, /cloudflareaccess\.com/],
      'entity governance dashboard'
    );
  });

  test('Entity VIP dashboard resolves', async ({ page }) => {
    const resp = await page.goto(
      '/blueprint-limited/scorecard/ai-document-processing-blueprint/vipdashboard',
      { waitUntil: 'domcontentloaded' }
    );
    expect(resp?.status()).toBeLessThan(400);
    await expectNoErrorPage(page);
    expectUrlMatch(
      page.url(),
      [/\/register/, /vipdashboard/, /cloudflareaccess\.com/],
      'entity vip dashboard'
    );
  });
});

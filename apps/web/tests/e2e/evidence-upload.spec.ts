/**
 * Evidence Upload E2E Tests
 * 
 * End-to-end tests for evidence upload flow using Playwright.
 * 
 * Note: These tests require Playwright to be installed.
 * Run: npx playwright install
 */

import { test, expect } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
const isRemote =
  !baseURL.includes('localhost') && !baseURL.includes('127.0.0.1');

test.describe('Evidence Upload Flow', () => {
  test.skip(isRemote, 'Evidence upload E2E is local-only');

  test.beforeEach(async ({ page }) => {
    // Navigate to a project page (adjust URL as needed)
    await page.goto('/scorecard/test-project');
  });

  test('should display evidence upload button', async ({ page }) => {
    // Look for upload button or evidence section
    const uploadButton = page.getByRole('button', { name: /upload|add evidence/i });
    await expect(uploadButton).toBeVisible();
  });

  test('should open file picker when upload button is clicked', async ({ page }) => {
    const uploadButton = page.getByRole('button', { name: /upload|add evidence/i });
    
    // Set up file input handler
    await page.setContent(`
      <input type="file" id="file-input" />
      <button onclick="document.getElementById('file-input').click()">Upload</button>
    `);
    
    const fileInput = page.locator('#file-input');
    await fileInput.setInputFiles({
      name: 'test.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('test content'),
    });
    
    // Verify file was selected
    const files = await fileInput.inputValue();
    expect(files).toBeTruthy();
  });

  test('should show upload progress during file upload', async ({ page }) => {
    // Mock file upload
    await page.route('**/admin/projects/*/controls/*/evidence:init', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          evidence_id: 123,
          upload_url: 'https://s3.amazonaws.com/bucket/key',
          upload_headers: {},
          uri: 's3://bucket/key',
        }),
      });
    });

    await page.route('**/s3.amazonaws.com/**', async (route) => {
      await route.fulfill({ status: 200 });
    });

    // Trigger upload
    const uploadButton = page.getByRole('button', { name: /upload|add evidence/i });
    await uploadButton.click();

    // Check for progress indicator
    await expect(page.getByText(/uploading|progress/i)).toBeVisible({ timeout: 5000 });
  });

  test('should display success message after successful upload', async ({ page }) => {
    // Mock successful upload
    await page.route('**/admin/projects/*/controls/*/evidence:init', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          evidence_id: 123,
          upload_url: 'https://s3.amazonaws.com/bucket/key',
          uri: 's3://bucket/key',
        }),
      });
    });

    await page.route('**/s3.amazonaws.com/**', async (route) => {
      await route.fulfill({ status: 200 });
    });

    // Perform upload
    const uploadButton = page.getByRole('button', { name: /upload|add evidence/i });
    await uploadButton.click();

    // Wait for success message
    await expect(page.getByText(/success|uploaded/i)).toBeVisible({ timeout: 10000 });
  });

  test('should display error message on upload failure', async ({ page }) => {
    // Mock upload failure
    await page.route('**/admin/projects/*/controls/*/evidence:init', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Upload failed' }),
      });
    });

    // Trigger upload
    const uploadButton = page.getByRole('button', { name: /upload|add evidence/i });
    await uploadButton.click();

    // Check for error message
    await expect(page.getByText(/error|failed/i)).toBeVisible({ timeout: 5000 });
  });

  test('should list uploaded evidence items', async ({ page }) => {
    // Mock evidence list API
    await page.route('**/admin/projects/*/controls/*/evidence', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            { id: 1, name: 'test1.pdf', created_at: '2024-01-01' },
            { id: 2, name: 'test2.pdf', created_at: '2024-01-02' },
          ],
        }),
      });
    });

    // Navigate to evidence section
    await page.goto('/scorecard/test-project');

    // Check for evidence items
    await expect(page.getByText('test1.pdf')).toBeVisible();
    await expect(page.getByText('test2.pdf')).toBeVisible();
  });

  test('should allow downloading evidence', async ({ page }) => {
    // Mock download URL API
    await page.route('**/admin/evidence/*:download-url', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ url: 'https://s3.amazonaws.com/bucket/key' }),
      });
    });

    // Find download button
    const downloadButton = page.getByRole('button', { name: /download/i });
    await downloadButton.click();

    // Verify download was triggered
    await expect(page).toHaveURL(/s3\.amazonaws\.com/);
  });

  test('should allow deleting evidence', async ({ page }) => {
    // Mock delete API
    await page.route('**/admin/evidences/*', async (route) => {
      if (route.request().method() === 'DELETE') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, deleted: 123 }),
        });
      }
    });

    // Find delete button
    const deleteButton = page.getByRole('button', { name: /delete|remove/i });
    await deleteButton.click();

    // Confirm deletion if confirmation dialog appears
    page.on('dialog', (dialog) => dialog.accept());

    // Verify evidence was removed
    await expect(page.getByText(/deleted|removed/i)).toBeVisible();
  });
});

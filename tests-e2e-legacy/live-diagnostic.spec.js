const { test, expect } = require('@playwright/test');

/**
 * Live diagnostic tests against the deployed site.
 * Run: npx playwright test tests/live-diagnostic.spec.js --project=chromium
 */

const BASE_URL = process.env.BASE_URL || 'https://vcard-studio-314.web.app';

test.describe('Live Site Diagnostics', () => {
  test('landing page loads and Firebase initializes', async ({ page }) => {
    const logs = [];
    const errors = [];
    page.on('console', msg => {
      const text = msg.text();
      logs.push(`[${msg.type()}] ${text}`);
      if (msg.type() === 'error') errors.push(text);
    });
    page.on('pageerror', err => errors.push(`PAGE ERROR: ${err.message}`));

    await page.goto(`${BASE_URL}/`);
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveTitle(/NownCard/);

    // Check for Firebase init in console
    const hasFirebaseInit = logs.some(l => l.includes('App Check') || l.includes('firebase'));
    console.log('Console logs:', logs.slice(0, 20).join('\n'));
    console.log('Console errors:', errors.join('\n') || 'none');
    expect(errors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });

  test('debug page shows Firebase health', async ({ page }) => {
    await page.goto(`${BASE_URL}/debug`);
    await page.waitForTimeout(2000);

    // Check basic diagnostics rendered
    const appInit = await page.locator('#d-app').textContent();
    const dbReady = await page.locator('#d-db').textContent();
    console.log('App initialized:', appInit);
    console.log('DB ready:', dbReady);
    expect(appInit).toBe('YES');
    expect(dbReady).toBe('YES');
  });

  test('debug page can write and read Firestore', async ({ page }) => {
    await page.goto(`${BASE_URL}/debug`);
    await page.waitForTimeout(1000);

    // Sign in anonymously
    await page.click('text=Sign In Anonymously');
    await page.waitForTimeout(2000);

    // Run Firestore tests
    await page.click('text=Run Tests');
    await page.waitForTimeout(3000);

    const writeResult = await page.locator('#d-write').textContent();
    const readbackResult = await page.locator('#d-readback').textContent();
    const deleteResult = await page.locator('#d-delete').textContent();
    console.log('Write test:', writeResult);
    console.log('Readback test:', readbackResult);
    console.log('Delete test:', deleteResult);

    // debug.html shows publicCards read count in #d-write, cards read in #d-readback, write+read result in #d-delete
    expect(writeResult).toMatch(/docs readable/);
    expect(readbackResult).toMatch(/own cards|NEEDS AUTH/);
    expect(deleteResult).toMatch(/WRITE\+READ OK|NEEDS AUTH/);
  });

  test('public card page loads without JS errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto(`${BASE_URL}/card/test-slug-12345`);
    await page.waitForTimeout(2000);

    console.log('Public card page errors:', errors.join('\n') || 'none');
    expect(errors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });
});

const { test, expect } = require('@playwright/test');

test.describe('NownCard Smoke Tests', () => {
  test('landing page loads', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/NownCard/);
    await expect(page.locator('.hero-title')).toContainText('Digital Business Cards');
  });

  test('auth modal opens', async ({ page }) => {
    await page.goto('/');
    await page.click('#nav-auth-btn');
    await expect(page.locator('#auth-modal')).toHaveClass(/active/);
  });

  test('mobile drawer opens', async ({ page }) => {
    await page.goto('/');
    await page.setViewportSize({ width: 375, height: 667 });
    await page.click('#hamburger');
    await expect(page.locator('#mobile-drawer')).toHaveClass(/active/);
  });

  test('pricing section visible', async ({ page }) => {
    await page.goto('/');
    await page.click('header nav a[href="#pricing"]');
    await expect(page.locator('.pricing-card')).toHaveCount(3);
  });

  test('public card 404', async ({ page }) => {
    await page.goto('/card/nonexistent-slug-12345');
    await expect(page.locator('text=Card Not Found')).toBeVisible();
  });
});

const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.BASE_URL || 'https://vcard-studio-314.web.app';

test('capture mobile screenshots', async ({ page }) => {
  // Public card at mobile viewport
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`${BASE_URL}/card/test-slug-12345`);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'test-results/mobile-card-front.png', fullPage: false });

  // Flip the card only if it exists (card may not exist in production)
  const cardScene = page.locator('.card-scene');
  if (await cardScene.count() > 0) {
    await cardScene.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: 'test-results/mobile-card-back.png', fullPage: false });
  } else {
    // Screenshot the "not found" / "loading" state so we still have a back reference
    await page.screenshot({ path: 'test-results/mobile-card-back.png', fullPage: false });
  }

  // Landing page at mobile
  await page.goto(`${BASE_URL}/`);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'test-results/mobile-landing.png', fullPage: true });
});

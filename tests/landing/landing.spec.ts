import { test, expect } from '@playwright/test';

// T006: Hero section is visible without scrolling
test('hero section visible above fold', async ({ page }) => {
  await page.goto('/landing/index.html');
  const hero = page.locator('[data-testid="hero"]');
  await expect(hero).toBeVisible();
  const viewport = page.viewportSize()!;
  const box = await hero.boundingBox();
  expect(box!.y).toBeLessThan(viewport.height);
});

// T007: Install command copy CTA is interactive
test('install command copy CTA is present and interactive', async ({ page }) => {
  await page.goto('/landing/index.html');
  const copyBtn = page.locator('[data-testid="copy-btn"]');
  await expect(copyBtn).toBeVisible();
  await copyBtn.click();
  const feedback = page.locator('[data-testid="copy-feedback"]');
  await expect(feedback).toBeVisible();
});

// T008: Feature sections display screenshots
test('feature sections contain screenshots', async ({ page }) => {
  await page.goto('/landing/index.html');
  const featureImgs = page.locator('[data-testid^="feature-img-"]');
  const count = await featureImgs.count();
  expect(count).toBeGreaterThanOrEqual(3);
});

// T009: Responsive layout at 390px
test('responsive layout renders at 390px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/landing/index.html');
  const hero = page.locator('[data-testid="hero"]');
  await expect(hero).toBeVisible();
  // No horizontal scrollbar
  const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(390);
});

// Social proof badges are present
test('social proof badges section is present', async ({ page }) => {
  await page.goto('/landing/index.html');
  const badges = page.locator('[data-testid="social-proof"]');
  await expect(badges).toBeVisible();
});

// Open Graph meta tags are present
test('Open Graph meta tags are present', async ({ page }) => {
  await page.goto('/landing/index.html');
  const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content');
  expect(ogTitle).toBeTruthy();
  const ogDescription = await page.locator('meta[property="og:description"]').getAttribute('content');
  expect(ogDescription).toBeTruthy();
  const ogImage = await page.locator('meta[property="og:image"]').getAttribute('content');
  expect(ogImage).toBeTruthy();
});

// Footer links are present
test('footer contains GitHub and npm links', async ({ page }) => {
  await page.goto('/landing/index.html');
  const footer = page.locator('[data-testid="footer"]');
  await expect(footer).toBeVisible();
  const githubLink = footer.locator('a[href*="github.com"]');
  await expect(githubLink.first()).toBeVisible();
  const npmLink = footer.locator('a[href*="npmjs.com"]');
  await expect(npmLink.first()).toBeVisible();
});

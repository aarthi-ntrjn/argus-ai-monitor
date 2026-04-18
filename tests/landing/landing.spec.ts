import { test, expect } from '@playwright/test';

// T006: Hero section is visible without scrolling
test('hero section visible above fold', async ({ page }) => {
  await page.goto('/');
  const hero = page.locator('[data-testid="hero"]');
  await expect(hero).toBeVisible();
  const viewport = page.viewportSize()!;
  const box = await hero.boundingBox();
  expect(box!.y).toBeLessThan(viewport.height);
});

// T007: Install command copy CTA is interactive
test('install command copy CTA is present', async ({ page }) => {
  await page.goto('/');
  const copyBtn = page.locator('[data-testid="copy-btn"]');
  await expect(copyBtn).toBeVisible();
  // Primary GitHub CTA also present
  const githubCta = page.locator('a[href*="github.com/aarthi-ntrjn/argus"]');
  await expect(githubCta.first()).toBeVisible();
});

// T008: Feature sections display screenshots
test('feature sections contain screenshots', async ({ page }) => {
  await page.goto('/');
  const featureImgs = page.locator('[data-testid^="feature-img-"]');
  const count = await featureImgs.count();
  expect(count).toBeGreaterThanOrEqual(3);
});

// T009: Responsive layout at 390px
test('responsive layout renders at 390px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const hero = page.locator('[data-testid="hero"]');
  await expect(hero).toBeVisible();
  // No horizontal scrollbar
  const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(390);
});

// Social proof badges are present (T025)
test('social proof badges section is present', async ({ page }) => {
  await page.goto('/');
  const badges = page.locator('[data-testid="social-proof"]');
  await expect(badges).toBeVisible();
  // At least one badge img with "GitHub Stars" or "Weekly Downloads"
  const badgeImg = page.locator('img[alt*="GitHub Stars"], img[alt*="Weekly Downloads"]');
  const count = await badgeImg.count();
  expect(count).toBeGreaterThanOrEqual(1);
});

// T018: Feature headings present
test('feature section headings Monitor, Control, How It Works exist', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Monitor', exact: true })).toBeVisible();
  await expect(page.getByTestId('feature-control').getByRole('heading', { name: 'Control', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'How It Works', exact: true })).toBeVisible();
});

// T019: How It Works has exactly 3 steps
test('How It Works section has 3 numbered steps', async ({ page }) => {
  await page.goto('/');
  const steps = page.locator('.step-card');
  await expect(steps).toHaveCount(3);
});

// Open Graph meta tags are present
test('Open Graph meta tags are present', async ({ page }) => {
  await page.goto('/');
  const ogTitle = await page.$eval('meta[property="og:title"]', (el) => el.getAttribute('content'));
  expect(ogTitle).toBeTruthy();
  const ogDescription = await page.$eval('meta[property="og:description"]', (el) => el.getAttribute('content'));
  expect(ogDescription).toBeTruthy();
  const ogImage = await page.$eval('meta[property="og:image"]', (el) => el.getAttribute('content'));
  expect(ogImage).toBeTruthy();
});

// Footer links are present
test('footer contains GitHub and npm links', async ({ page }) => {
  await page.goto('/');
  const footer = page.locator('[data-testid="footer"]');
  await expect(footer).toBeVisible();
  const githubLink = footer.locator('a[href*="github.com"]');
  await expect(githubLink.first()).toBeVisible();
  const npmLink = footer.locator('a[href*="npmjs.com"]');
  await expect(npmLink.first()).toBeVisible();
});

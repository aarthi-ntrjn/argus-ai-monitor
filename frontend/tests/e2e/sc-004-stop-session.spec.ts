import { test, expect } from '@playwright/test';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const SESSION_ID = 'test-session-stop';

const SESSION_ACTIVE = {
  id: SESSION_ID, repositoryId: 'repo-1', type: 'claude-code', pid: null,
  status: 'active', startedAt: new Date().toISOString(),
  endedAt: null, lastActivityAt: new Date().toISOString(), summary: null, expiresAt: null,
};

const SESSION_ENDED = { ...SESSION_ACTIVE, status: 'ended', endedAt: new Date().toISOString() };

// Note: ControlPanel is not wired into the UI. The only stop/interrupt
// mechanism exposed in the current UI is the SessionPromptBar ⋮ menu → Esc.

test.describe('SC-004: Stop Session', () => {

  test.beforeEach(async ({ page }) => {
    await page.route(`**/api/v1/sessions/${SESSION_ID}/output**`, route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify({ items: [], nextBefore: null, total: 0 }) })
    );
  });

  test('actions menu button is visible for active session', async ({ page }) => {
    await page.route(`**/api/v1/sessions/${SESSION_ID}`, route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify(SESSION_ACTIVE) })
    );
    await page.goto(`/sessions/${SESSION_ID}`);
    await expect(page.getByRole('button', { name: /session actions menu/i })).toBeVisible({ timeout: 5000 });
  });

  test('actions menu shows Esc (interrupt) option', async ({ page }) => {
    await page.route(`**/api/v1/sessions/${SESSION_ID}`, route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify(SESSION_ACTIVE) })
    );
    await page.goto(`/sessions/${SESSION_ID}`);
    await page.getByRole('button', { name: /session actions menu/i }).click();
    await expect(page.getByRole('button', { name: /^Esc$/i })).toBeVisible({ timeout: 3000 });
  });

  test('clicking Esc calls interrupt API and menu closes', async ({ page }) => {
    let interrupted = false;
    await page.route(`**/api/v1/sessions/${SESSION_ID}`, route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify(SESSION_ACTIVE) })
    );
    await page.route(`**/api/v1/sessions/${SESSION_ID}/interrupt`, route => {
      interrupted = true;
      route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ actionId: 'a1', status: 'completed' }) });
    });

    await page.goto(`/sessions/${SESSION_ID}`);
    await page.getByRole('button', { name: /session actions menu/i }).click();
    await page.getByRole('button', { name: /^Esc$/i }).click();

    await expect(page.getByRole('button', { name: /^Esc$/i })).not.toBeVisible({ timeout: 3000 });
    expect(interrupted).toBe(true);
  });

  test('status badge shows ended state on session page', async ({ page }) => {
    await page.route(`**/api/v1/sessions/${SESSION_ID}`, route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify(SESSION_ENDED) })
    );
    await page.goto(`/sessions/${SESSION_ID}`);
    await expect(page.getByText('ended', { exact: true })).toBeVisible({ timeout: 5000 });
  });
});

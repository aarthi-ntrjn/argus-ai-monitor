import { test, expect } from '@playwright/test';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const SESSION_ID = 'test-session-stop';

const SESSION_ACTIVE = {
  id: SESSION_ID, repositoryId: 'repo-1', type: 'claude-code',
  launchMode: 'pty', pid: 1234, pidSource: 'pty_registry',
  status: 'active', startedAt: new Date().toISOString(),
  endedAt: null, lastActivityAt: new Date().toISOString(),
  summary: null, expiresAt: null, model: 'claude-opus-4-6',
};

const SESSION_ENDED = { ...SESSION_ACTIVE, status: 'ended', endedAt: new Date().toISOString() };

const EMPTY_OUTPUT = { items: [], nextBefore: null, total: 0 };

// The session detail page uses SessionPromptBar for interrupt control.
// PTY sessions show an input field; pressing Escape in it calls POST /interrupt.

test.describe('SC-004: Stop Session', () => {

  test.beforeEach(async ({ page }) => {
    await page.route(`**/api/v1/sessions/${SESSION_ID}/output**`, route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify(EMPTY_OUTPUT) })
    );
  });

  test('prompt bar is visible for active PTY session', async ({ page }) => {
    await page.route(`**/api/v1/sessions/${SESSION_ID}`, route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify(SESSION_ACTIVE) })
    );
    await page.goto(`/sessions/${SESSION_ID}`);
    await expect(page.getByRole('textbox', { name: /send a prompt/i })).toBeVisible({ timeout: 5000 });
  });

  test('pressing Escape in prompt bar calls interrupt API', async ({ page }) => {
    let interrupted = false;
    await page.route(`**/api/v1/sessions/${SESSION_ID}`, route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify(SESSION_ACTIVE) })
    );
    await page.route(`**/api/v1/sessions/${SESSION_ID}/interrupt`, route => {
      interrupted = true;
      route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ actionId: 'a1', status: 'completed' }) });
    });

    await page.goto(`/sessions/${SESSION_ID}`);
    const input = page.getByRole('textbox', { name: /send a prompt/i });
    await input.click();
    await input.press('Escape');

    await expect.poll(() => interrupted, { timeout: 3000 }).toBe(true);
  });

  test('prompt bar shows read-only message for detected sessions', async ({ page }) => {
    const detected = { ...SESSION_ACTIVE, launchMode: 'detected', pid: null, pidSource: null };
    await page.route(`**/api/v1/sessions/${SESSION_ID}`, route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify(detected) })
    );
    await page.goto(`/sessions/${SESSION_ID}`);
    await expect(page.getByText(/read-only/i)).toBeVisible({ timeout: 5000 });
  });

  test('status badge shows ended state on session page', async ({ page }) => {
    await page.route(`**/api/v1/sessions/${SESSION_ID}`, route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify(SESSION_ENDED) })
    );
    await page.goto(`/sessions/${SESSION_ID}`);
    await expect(page.getByText('ended', { exact: true })).toBeVisible({ timeout: 5000 });
  });
});

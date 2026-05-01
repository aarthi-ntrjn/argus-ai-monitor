import { test, expect } from './fixtures';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const SESSION_ID = 'test-session-kill';

const SESSION_ACTIVE = {
  id: SESSION_ID, repositoryId: 'repo-1', type: 'claude-code',
  launchMode: 'pty', pid: 9999, pidSource: 'pty_registry',
  status: 'active', startedAt: new Date().toISOString(),
  endedAt: null, lastActivityAt: new Date().toISOString(),
  summary: 'Building feature', expiresAt: null, model: 'claude-opus-4-6',
};

const SESSION_ENDED = { ...SESSION_ACTIVE, status: 'ended', endedAt: new Date().toISOString(), pid: null };

const REPO = { id: 'repo-1', name: 'test-repo', rootPath: '/tmp/repo', source: 'ui', addedAt: new Date().toISOString(), lastScannedAt: null };

const EMPTY_OUTPUT = { items: [], nextBefore: null, total: 0 };

test.describe('SC-027: Kill Session', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('argus:onboarding', JSON.stringify({
        schemaVersion: 1, userId: null,
        dashboardTour: { status: 'completed', completedAt: '2024-01-01T00:00:00.000Z', skippedAt: null, seenRepoSteps: true },
        sessionHints: { dismissed: [] },
      }));
    });
  });

  async function mockDashboard(page: import('@playwright/test').Page, sessions: unknown[]) {
    await page.route('**/api/v1/repositories', route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify([REPO]) })
    );
    // Per-session output routes (registered before broad sessions route for LIFO priority)
    for (const s of sessions) {
      const sid = (s as { id: string }).id;
      await page.route(`**/api/v1/sessions/${sid}/output**`, route =>
        route.fulfill({ contentType: 'application/json', body: JSON.stringify(EMPTY_OUTPUT) })
      );
    }
    await page.route('**/api/v1/sessions**', route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify(sessions) })
    );
  }

  test('kill button visible on dashboard card for active session with PID', async ({ page }) => {
    await mockDashboard(page, [SESSION_ACTIVE]);
    await page.goto('/');
    await expect(page.getByRole('button', { name: /kill session/i })).toBeVisible({ timeout: 5000 });
  });

  test('clicking kill button on card opens confirmation dialog', async ({ page }) => {
    await mockDashboard(page, [SESSION_ACTIVE]);
    await page.goto('/');
    await page.getByRole('button', { name: /kill session/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText(/are you sure/i)).toBeVisible();
  });

  test('confirming kill calls stop API', async ({ page }) => {
    let stopCalled = false;
    await mockDashboard(page, [SESSION_ACTIVE]);
    await page.route(`**/api/v1/sessions/${SESSION_ID}/stop`, route => {
      stopCalled = true;
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ended' }) });
    });

    await page.goto('/');
    await page.getByRole('button', { name: /kill session/i }).click();
    await page.getByRole('dialog').getByRole('button', { name: /kill session/i }).click();
    await expect.poll(() => stopCalled, { timeout: 3000 }).toBe(true);
  });

  test('cancel dismisses dialog without calling API', async ({ page }) => {
    let stopCalled = false;
    await mockDashboard(page, [SESSION_ACTIVE]);
    await page.route(`**/api/v1/sessions/${SESSION_ID}/stop`, route => {
      stopCalled = true;
      route.fulfill({ status: 200 });
    });

    await page.goto('/');
    await page.getByRole('button', { name: /kill session/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: /cancel/i }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    expect(stopCalled).toBe(false);
  });

  test('kill button hidden for ended sessions on dashboard', async ({ page }) => {
    await mockDashboard(page, [SESSION_ENDED]);
    await page.addInitScript(() => {
      localStorage.setItem('argus:settings', JSON.stringify({ hideEndedSessions: false }));
    });
    await page.goto('/');
    await expect(page.getByText('ended', { exact: true })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: /kill session/i })).not.toBeVisible();
  });

  test('kill button visible on session detail page', async ({ page }) => {
    await page.route(`**/api/v1/sessions/${SESSION_ID}/output**`, route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify(EMPTY_OUTPUT) })
    );
    await page.route(`**/api/v1/sessions/${SESSION_ID}`, route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify(SESSION_ACTIVE) })
    );
    await page.goto(`/sessions/${SESSION_ID}`);
    await expect(page.getByRole('button', { name: /kill session/i })).toBeVisible({ timeout: 5000 });
  });
});

import { test, expect } from '@playwright/test';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const SESSION_ID = 'test-session-026-resting';

const SESSION = {
  id: SESSION_ID,
  repositoryId: 'repo-1',
  type: 'claude-code',
  launchMode: 'pty',
  pid: 1234,
  pidSource: 'pty_registry',
  status: 'active',
  startedAt: new Date().toISOString(),
  endedAt: null,
  lastActivityAt: new Date().toISOString(),
  summary: null,
  expiresAt: null,
  model: 'claude-opus-4-6',
  yoloMode: false,
};

const REPO = {
  id: 'repo-1',
  name: 'my-project',
  path: 'C:\\projects\\my-project',
  source: 'ui',
  addedAt: new Date().toISOString(),
  lastScannedAt: null,
  branch: 'main',
};

async function stubDashboard(page: import('@playwright/test').Page) {
  // Stateful settings so PATCH requests are reflected in subsequent GETs and in the returned body.
  let currentSettings: Record<string, unknown> = { port: 7411, yoloMode: false, restingThresholdMinutes: 20 };

  await page.addInitScript(() => {
    localStorage.setItem('argus:onboarding', JSON.stringify({
      schemaVersion: 1, userId: null,
      dashboardTour: { status: 'completed', completedAt: '2024-01-01T00:00:00.000Z', skippedAt: null, seenRepoSteps: true },
      sessionHints: { dismissed: [] },
    }));
  });
  await page.route('**/api/v1/repositories', route =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify([REPO]) })
  );
  await page.route('**/api/v1/sessions**', route =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify([SESSION]) })
  );
  await page.route(`**/api/v1/sessions/${SESSION_ID}/output**`, route =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ items: [], nextBefore: null, total: 0 }) })
  );
  await page.route('**/api/v1/settings', async route => {
    if (route.request().method() === 'PATCH') {
      const patch = route.request().postDataJSON() as Record<string, unknown>;
      currentSettings = { ...currentSettings, ...patch };
    }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(currentSettings) });
  });
  await page.route('**/api/v1/integrations', route =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ integrationsEnabled: false, slack: { connectionStatus: 'unconfigured', notifier: null, listener: null }, teams: { connectionStatus: 'unconfigured', notifier: null, listener: null } }) })
  );
  await page.route('**/ws**', route => route.abort());
}

async function openSettings(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: /settings/i }).click();
  await page.getByRole('button', { name: /advanced settings/i }).click();
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('SC-026: Resting Threshold (mocked API)', () => {

  test.beforeEach(async ({ page }) => {
    await stubDashboard(page);
  });

  test('settings panel shows threshold input with default value of 20', async ({ page }) => {
    await page.goto('/');
    await openSettings(page);
    const input = page.getByRole('spinbutton', { name: /resting after/i });
    await expect(input).toBeVisible({ timeout: 3000 });
    await expect(input).toHaveValue('20');
  });

  test('hide inactive sessions label reflects the current threshold', async ({ page }) => {
    await page.goto('/');
    await openSettings(page);
    await expect(page.getByText(/>20 min/i)).toBeVisible({ timeout: 3000 });
  });

  test('changing the threshold updates the label dynamically', async ({ page }) => {
    await page.goto('/');
    await openSettings(page);
    const input = page.getByRole('spinbutton', { name: /resting after/i });
    await input.fill('5');
    await input.blur();
    await expect(page.getByText(/>5 min/i)).toBeVisible({ timeout: 3000 });
  });

  test('entering 0 shows a validation error', async ({ page }) => {
    await page.goto('/');
    await openSettings(page);
    const input = page.getByRole('spinbutton', { name: /resting after/i });
    await input.fill('0');
    await input.blur();
    await expect(page.getByRole('alert')).toBeVisible({ timeout: 3000 });
  });

  test('clicking Reset restores the input to 20', async ({ page }) => {
    await page.goto('/');
    await openSettings(page);
    const input = page.getByRole('spinbutton', { name: /resting after/i });
    await input.fill('5');
    await input.blur();
    await page.getByRole('button', { name: /reset/i }).click();
    await expect(input).toHaveValue('20');
  });

  test('clicking Reset clears the validation error', async ({ page }) => {
    await page.goto('/');
    await openSettings(page);
    const input = page.getByRole('spinbutton', { name: /resting after/i });
    await input.fill('0');
    await input.blur();
    await expect(page.getByRole('alert')).toBeVisible({ timeout: 3000 });
    await page.getByRole('button', { name: /reset/i }).click();
    await expect(page.getByRole('alert')).not.toBeVisible({ timeout: 3000 });
  });

  test('threshold persists across page navigation', async ({ page }) => {
    await page.goto('/');
    await openSettings(page);
    const input = page.getByRole('spinbutton', { name: /resting after/i });
    await input.fill('10');
    await input.blur();
    // Navigate away and back
    await page.goto('/');
    await openSettings(page);
    await expect(page.getByRole('spinbutton', { name: /resting after/i })).toHaveValue('10');
  });
});

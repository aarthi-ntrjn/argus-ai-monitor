import { test, expect } from '@playwright/test';

const REPOS_RESPONSE = [
  {
    id: 'repo-1', name: 'my-project', path: 'C:\\projects\\my-project',
    source: 'ui', addedAt: new Date().toISOString(), lastScannedAt: null, branch: 'main',
  },
];

const SESSIONS_RESPONSE = [
  {
    id: 'session-1', repositoryId: 'repo-1', type: 'claude-code', pid: 1234,
    status: 'active', startedAt: new Date().toISOString(), endedAt: null,
    lastActivityAt: new Date().toISOString(), summary: 'Writing tests', expiresAt: null, model: null,
    launchMode: 'pty',
  },
  {
    id: 'session-2', repositoryId: 'repo-1', type: 'claude-code', pid: 5678,
    status: 'active', startedAt: new Date().toISOString(), endedAt: null,
    lastActivityAt: new Date().toISOString(), summary: 'Reviewing code', expiresAt: null, model: null,
    launchMode: 'detected',
  },
];

async function mockApi(page: import('@playwright/test').Page) {
  await page.route('**/api/v1/repositories', route =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(REPOS_RESPONSE) })
  );
  await page.route('**/api/v1/sessions**', route =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(SESSIONS_RESPONSE) })
  );
  await page.route('**/api/v1/tools**', route =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ claude: true, copilot: false, claudeCmd: 'claude', copilotCmd: null }) })
  );
  await page.route('**/api/v1/integrations', route =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ integrationsEnabled: false, slack: { connectionStatus: 'unconfigured', notifier: null, listener: null }, teams: { connectionStatus: 'unconfigured', notifier: null, listener: null } }) })
  );
  await page.route('**/api/v1/settings', route =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ port: 7411, watchDirectories: [], sessionRetentionHours: 24, outputRetentionMbPerSession: 10, autoRegisterRepos: false, yoloMode: false, restingThresholdMinutes: 20, telemetryEnabled: false, telemetryPromptSeen: true }) })
  );
  await page.route('**/ws**', route => route.abort());
}

async function clearOnboarding(page: import('@playwright/test').Page) {
  await page.evaluate(() => localStorage.removeItem('argus:onboarding'));
}

async function seedOnboardingCompleted(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    localStorage.setItem('argus:onboarding', JSON.stringify({
      schemaVersion: 1, userId: null,
      dashboardTour: { status: 'completed', completedAt: new Date().toISOString(), skippedAt: null, seenRepoSteps: true },
      sessionHints: { dismissed: [] },
    }));
  });
}

// ─── User Story 1: First-Time Dashboard Orientation ─────────────────────────

test.describe('US1: First-Time Dashboard Tour', () => {
  test('auto-launches tour for new user and completes all steps', async ({ page }) => {
    await page.goto('/');
    await mockApi(page);
    await clearOnboarding(page);
    await page.reload();

    // Welcome step should appear
    await expect(page.locator('.react-joyride__tooltip')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Welcome!')).toBeVisible();

    // Advance through all 7 steps
    for (let i = 0; i < 6; i++) {
      const nextBtn = page.getByRole('button', { name: /next/i });
      await expect(nextBtn).toBeVisible();
      await nextBtn.click();
    }

    // Final step — close / finish
    const lastBtn = page.getByRole('button', { name: /close|done|finish/i }).last();
    await lastBtn.click();

    // Tour should be gone
    await expect(page.getByText('Welcome!')).not.toBeVisible();

    // Reload — tour must NOT re-launch
    await page.reload();
    await expect(page.getByText('Welcome!')).not.toBeVisible({ timeout: 3000 });

    // Verify localStorage state
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('argus:onboarding') ?? '{}'));
    expect(stored.dashboardTour.status).toBe('completed');
  });

  test('tour dismisses silently when user clicks Skip', async ({ page }) => {
    await page.goto('/');
    await mockApi(page);
    await clearOnboarding(page);
    await page.reload();

    // Wait for tour
    await expect(page.getByText('Welcome!')).toBeVisible({ timeout: 5000 });

    // Click skip
    const skipBtn = page.getByRole('button', { name: /skip/i });
    await skipBtn.click();

    // Tour should be gone immediately
    await expect(page.getByText('Welcome!')).not.toBeVisible();

    // App still fully functional — dashboard renders
    await expect(page.locator('h1')).toContainText('Argus');

    // Reload — tour does NOT re-launch (status is skipped, not not_started)
    await page.reload();
    await expect(page.getByText('Welcome!')).not.toBeVisible({ timeout: 3000 });

    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('argus:onboarding') ?? '{}'));
    expect(stored.dashboardTour.status).toBe('skipped');
  });
});

// ─── User Story 3: Replay Tour On Demand ────────────────────────────────────

test.describe('US3: Restart Tour from Settings', () => {
  test('returning user can restart tour from settings panel', async ({ page }) => {
    await page.goto('/');
    await mockApi(page);
    await seedOnboardingCompleted(page);
    await page.reload();

    // Tour should NOT auto-launch (already completed)
    await expect(page.getByText('Welcome!')).not.toBeVisible({ timeout: 2000 });

    // Open settings
    await page.getByRole('button', { name: /settings/i }).click();
    await page.getByRole('button', { name: /advanced settings/i }).click();
    await page.getByRole('button', { name: /about/i }).click();
    await expect(page.getByRole('button', { name: /restart tour/i })).toBeVisible();

    // Click Restart Tour
    await page.getByRole('button', { name: /restart tour/i }).click();

    // Tour should replay from step 1
    await expect(page.getByText('Welcome!')).toBeVisible({ timeout: 5000 });
  });
});

// ─── User Story 4: Onboarding State Reset ────────────────────────────────────

test.describe('US4: Reset Onboarding', () => {
  test('restart tour resets onboarding state and restores first-time tour on next load', async ({ page }) => {
    await page.goto('/');
    await mockApi(page);
    await seedOnboardingCompleted(page);
    await page.reload();

    // Open settings and click Restart Tour
    await page.getByRole('button', { name: /settings/i }).click();
    await page.getByRole('button', { name: /advanced settings/i }).click();
    await page.getByRole('button', { name: /about/i }).click();
    await expect(page.getByRole('button', { name: /restart tour/i })).toBeVisible();
    await page.getByRole('button', { name: /restart tour/i }).click();

    // Reload — first-time tour auto-launches
    await page.reload();
    await expect(page.getByText('Welcome!')).toBeVisible({ timeout: 5000 });

    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('argus:onboarding') ?? '{}'));
    expect(stored.dashboardTour.status).toBe('not_started');
  });
});

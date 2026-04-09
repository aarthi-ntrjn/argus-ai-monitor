import { test, expect, request } from '@playwright/test';
import { BASE_URL, TEST_REPO_A } from './test-config.js';

// ─── Onboarding real-server tests ─────────────────────────────────────────────
//
// Onboarding state lives entirely in localStorage (no backend API), so these
// tests verify that tour logic operates correctly with a real backend, real page
// navigation, and real reloads — no page.route() mocking.
//
// A single repo is seeded so the dashboard renders with content (tour step
// targets need the DOM to be populated).
//
// Note: "complete all tour steps" is not tested here because step 4 targets
// [data-tour-id="dashboard-session-card"] which only renders when sessions
// exist. Sessions cannot be seeded via API (they are discovered from OS
// processes). That scenario is fully covered in the mock-based tier.

let repoId: string;

const COMPLETED_STATE = JSON.stringify({
  schemaVersion: 1,
  userId: null,
  dashboardTour: { status: 'completed', completedAt: '2024-01-01T00:00:00.000Z', skippedAt: null, seenRepoSteps: true },
  sessionHints: { dismissed: [] },
});

test.describe('Onboarding (real server): SC-001 & SC-006', () => {

  test.beforeAll(async () => {
    const api = await request.newContext({ baseURL: BASE_URL });
    const res = await api.post('/api/v1/repositories', { data: { path: TEST_REPO_A } });
    expect(res.status(), `Failed to register ${TEST_REPO_A}: ${await res.text()}`).toBe(201);
    repoId = (await res.json()).id;
    await api.dispose();
  });

  test.afterAll(async () => {
    const api = await request.newContext({ baseURL: BASE_URL });
    if (repoId) await api.delete(`/api/v1/repositories/${repoId}`);
    await api.dispose();
  });

  // ── SC-001: First-time tour auto-launches ────────────────────────────────────

  test('tour auto-launches for new user with no onboarding state', async ({ page }) => {
    // Fresh browser context = no localStorage = first-time experience
    await page.goto('/');
    await expect(page.locator('.react-joyride__tooltip')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Welcome!')).toBeVisible();
  });

  // ── SC-001 + SC-006: Skip tour persists state ────────────────────────────────

  test('skipping tour persists skipped status and suppresses re-launch on real reload', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Welcome!')).toBeVisible({ timeout: 5000 });

    await page.locator('[data-action="skip"]').click();
    await expect(page.getByText('Welcome!')).not.toBeVisible();

    // SC-006: Real page.reload() must not re-launch the tour
    await page.reload();
    await expect(page.getByText('Welcome!')).not.toBeVisible({ timeout: 3000 });

    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('argus:onboarding') ?? '{}'));
    expect(stored.dashboardTour.status).toBe('skipped');
  });

  // ── SC-006: Returning user sees no tour ─────────────────────────────────────

  test('returning user (completed state) sees no tour on load or reload', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('argus:onboarding', JSON.stringify({
        schemaVersion: 1, userId: null,
        dashboardTour: { status: 'completed', completedAt: '2024-01-01T00:00:00.000Z', skippedAt: null },
        sessionHints: { dismissed: [] },
      }));
    });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'test-repo-alpha' })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Welcome!')).not.toBeVisible({ timeout: 2000 });

    await page.reload();
    await expect(page.getByText('Welcome!')).not.toBeVisible({ timeout: 2000 });
  });

  // ── US3: Restart tour from settings ─────────────────────────────────────────

  test('returning user can restart tour from settings panel', async ({ page }) => {
    // Use evaluate (not addInitScript) so the state is not re-applied on later reloads
    await page.goto('/');
    await page.evaluate((s) => localStorage.setItem('argus:onboarding', s), COMPLETED_STATE);
    await page.reload();

    await expect(page.getByText('Welcome!')).not.toBeVisible({ timeout: 2000 });

    await page.getByRole('button', { name: /settings/i }).click();
    await expect(page.getByRole('button', { name: /restart tour/i })).toBeVisible({ timeout: 3000 });
    await page.getByRole('button', { name: /restart tour/i }).click();

    await expect(page.getByText('Welcome!')).toBeVisible({ timeout: 5000 });
  });

  // ── US4: Reset onboarding ────────────────────────────────────────────────────

  test('reset onboarding restores first-time tour on next real reload', async ({ page }) => {
    // Use evaluate (not addInitScript) so the reload after Reset is not overridden
    await page.goto('/');
    await page.evaluate((s) => localStorage.setItem('argus:onboarding', s), COMPLETED_STATE);
    await page.reload();

    await expect(page.getByText('Welcome!')).not.toBeVisible({ timeout: 2000 });

    await page.getByRole('button', { name: /settings/i }).click();
    await expect(page.getByRole('button', { name: /restart tour/i })).toBeVisible({ timeout: 3000 });
    await page.getByRole('button', { name: /restart tour/i }).click();

    // Real reload must auto-launch the tour again
    await page.reload();
    await expect(page.getByText('Welcome!')).toBeVisible({ timeout: 5000 });

    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('argus:onboarding') ?? '{}'));
    expect(stored.dashboardTour.status).toBe('not_started');
  });

});

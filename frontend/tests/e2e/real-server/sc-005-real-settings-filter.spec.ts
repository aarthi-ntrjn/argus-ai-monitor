import { test, expect, request } from '@playwright/test';
import { BASE_URL, TEST_REPO_A, TEST_REPO_B } from './test-config.js';

// ─── Settings filter tests against a real backend ─────────────────────────────
//
// Settings are stored in localStorage (no backend API), so these tests verify
// that filter logic operates correctly against real repository and session data
// rather than mocked shapes. No sessions are seeded — the backend starts empty,
// so these tests focus on the "repos with no sessions" paths and persistence.

let repoAId: string;
let repoBId: string;

test.describe('SC-005 (real server): Dashboard Settings — Repos with No Sessions', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('argus:onboarding', JSON.stringify({
        schemaVersion: 1, userId: null,
        dashboardTour: { status: 'completed', completedAt: '2024-01-01T00:00:00.000Z', skippedAt: null, seenRepoSteps: true },
        sessionHints: { dismissed: [] },
      }));
    });
  });

  test.beforeAll(async () => {
    const api = await request.newContext({ baseURL: BASE_URL });

    const resA = await api.post('/api/v1/repositories', { data: { path: TEST_REPO_A } });
    expect(resA.status(), `Failed to register ${TEST_REPO_A}: ${await resA.text()}`).toBe(201);
    repoAId = (await resA.json()).id;

    const resB = await api.post('/api/v1/repositories', { data: { path: TEST_REPO_B } });
    expect(resB.status(), `Failed to register ${TEST_REPO_B}: ${await resB.text()}`).toBe(201);
    repoBId = (await resB.json()).id;

    await api.dispose();
  });

  test.afterAll(async () => {
    const api = await request.newContext({ baseURL: BASE_URL });
    if (repoAId) await api.delete(`/api/v1/repositories/${repoAId}`);
    if (repoBId) await api.delete(`/api/v1/repositories/${repoBId}`);
    await api.dispose();
  });

  // ── Filter: repos with no sessions ──────────────────────────────────────────

  test('repos with no sessions are visible when hideReposWithNoActiveSessions is off (default)', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'test-repo-alpha' })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('heading', { name: 'test-repo-beta' })).toBeVisible({ timeout: 5000 });
  });

  test('repos with no sessions are hidden when hideReposWithNoActiveSessions is on', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('argus:settings', JSON.stringify({ hideReposWithNoActiveSessions: true }));
    });
    await page.goto('/');
    // Both repos have no sessions → both hidden → global empty state shown
    await expect(page.getByRole('heading', { name: 'test-repo-alpha' })).not.toBeVisible();
    await expect(page.getByRole('heading', { name: 'test-repo-beta' })).not.toBeVisible();
    await expect(page.getByText(/no repositories/i)).toBeVisible({ timeout: 5000 });
  });

  test('repos with no sessions remain visible when only hideEndedSessions is on', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('argus:settings', JSON.stringify({ hideEndedSessions: true }));
    });
    await page.goto('/');
    // hideEndedSessions filters sessions, not repos — repos with no sessions stay visible
    await expect(page.getByRole('heading', { name: 'test-repo-alpha' })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('heading', { name: 'test-repo-beta' })).toBeVisible({ timeout: 5000 });
  });

  // ── Persistence ──────────────────────────────────────────────────────────────

  test('hideReposWithNoActiveSessions=true persists across real page reload', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('argus:settings', JSON.stringify({ hideReposWithNoActiveSessions: true }));
    });
    await page.goto('/');
    await expect(page.getByText(/no repositories/i)).toBeVisible({ timeout: 5000 });
    await page.reload();
    await expect(page.getByText(/no repositories/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('heading', { name: 'test-repo-alpha' })).not.toBeVisible();
  });

  test('corrupt localStorage falls back to default (show all repos)', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('argus:settings', 'not-valid-json');
    });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'test-repo-alpha' })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('heading', { name: 'test-repo-beta' })).toBeVisible({ timeout: 5000 });
  });

  // ── Settings panel UI with real data ────────────────────────────────────────

  test('settings panel opens and shows all three toggles against real backend', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: /settings/i })).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: /settings/i }).click();
    await expect(page.getByRole('checkbox', { name: /hide ended sessions/i })).toBeVisible({ timeout: 3000 });
    await expect(page.getByRole('checkbox', { name: /hide repos with no active sessions/i })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: /hide inactive sessions/i })).toBeVisible();
  });

  test('toggling hideReposWithNoActiveSessions via panel immediately hides repos with no sessions', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'test-repo-alpha' })).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: /settings/i }).click();
    await page.getByRole('checkbox', { name: /hide repos with no active sessions/i }).check();
    await expect(page.getByRole('heading', { name: 'test-repo-alpha' })).not.toBeVisible();
    await expect(page.getByText(/no repositories/i)).toBeVisible({ timeout: 2000 });
  });

  test('re-toggling hideReposWithNoActiveSessions off restores repos', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('argus:settings', JSON.stringify({ hideReposWithNoActiveSessions: true }));
    });
    await page.goto('/');
    await expect(page.getByText(/no repositories/i)).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: /settings/i }).click();
    await page.getByRole('checkbox', { name: /hide repos with no active sessions/i }).uncheck();
    await expect(page.getByRole('heading', { name: 'test-repo-alpha' })).toBeVisible({ timeout: 2000 });
    await expect(page.getByRole('heading', { name: 'test-repo-beta' })).toBeVisible({ timeout: 2000 });
  });

});

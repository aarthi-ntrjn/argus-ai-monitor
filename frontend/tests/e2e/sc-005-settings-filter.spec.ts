import { test, expect } from '@playwright/test';

const REPOS = [
  { id: 'repo-1', name: 'active-repo', path: 'C:\\projects\\active-repo', source: 'ui', addedAt: new Date().toISOString(), lastScannedAt: null },
];

const SESSIONS = [
  { id: 's-active', repositoryId: 'repo-1', type: 'copilot-cli', pid: 1, status: 'active', startedAt: new Date().toISOString(), endedAt: null, lastActivityAt: new Date().toISOString(), summary: 'Active session', expiresAt: null },
  { id: 's-completed', repositoryId: 'repo-1', type: 'claude-code', pid: null, status: 'completed', startedAt: new Date().toISOString(), endedAt: new Date().toISOString(), lastActivityAt: new Date().toISOString(), summary: 'Completed session', expiresAt: null },
  { id: 's-ended', repositoryId: 'repo-1', type: 'copilot-cli', pid: null, status: 'ended', startedAt: new Date().toISOString(), endedAt: new Date().toISOString(), lastActivityAt: new Date().toISOString(), summary: 'Ended session', expiresAt: null },
];

function mockApis(page: import('@playwright/test').Page) {
  return Promise.all([
    page.route('**/api/v1/repositories', route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify(REPOS) })
    ),
    page.route('**/api/v1/sessions**', route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify(SESSIONS) })
    ),
  ]);
}

test.describe('SC-005: Dashboard Settings — Filter Ended Sessions', () => {

  // US1: Toggle visibility
  test('hides ended/completed sessions when showEndedSessions is false', async ({ page }) => {
    await mockApis(page);
    await page.addInitScript(() => {
      localStorage.setItem('argus:settings', JSON.stringify({ showEndedSessions: false }));
    });
    await page.goto('/');
    await expect(page.getByText('active-repo')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Active session')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Completed session')).not.toBeVisible();
    await expect(page.getByText('Ended session')).not.toBeVisible();
  });

  test('shows all sessions when showEndedSessions is true (default)', async ({ page }) => {
    await mockApis(page);
    await page.addInitScript(() => {
      localStorage.setItem('argus:settings', JSON.stringify({ showEndedSessions: true }));
    });
    await page.goto('/');
    await expect(page.getByText('Active session')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Completed session')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Ended session')).toBeVisible({ timeout: 5000 });
  });

  test('shows all sessions by default when no setting is stored', async ({ page }) => {
    await mockApis(page);
    await page.goto('/');
    await expect(page.getByText('Active session')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Completed session')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Ended session')).toBeVisible({ timeout: 5000 });
  });

  // US2: Persistence
  test('persists showEndedSessions=false preference across page reload', async ({ page }) => {
    await mockApis(page);
    await page.addInitScript(() => {
      localStorage.setItem('argus:settings', JSON.stringify({ showEndedSessions: false }));
    });
    await page.goto('/');
    await expect(page.getByText('Completed session')).not.toBeVisible();
    await page.reload();
    await expect(page.getByText('Active session')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Completed session')).not.toBeVisible();
  });

  test('falls back to default (show all) when stored settings are corrupt', async ({ page }) => {
    await mockApis(page);
    await page.addInitScript(() => {
      localStorage.setItem('argus:settings', 'not-valid-json');
    });
    await page.goto('/');
    await expect(page.getByText('Completed session')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Ended session')).toBeVisible({ timeout: 5000 });
  });

  // US3: Settings panel discoverability
  test('gear icon is visible in the dashboard header', async ({ page }) => {
    await mockApis(page);
    await page.goto('/');
    await expect(page.getByRole('button', { name: /settings/i })).toBeVisible({ timeout: 5000 });
  });

  test('clicking gear icon opens settings panel with Show ended sessions toggle', async ({ page }) => {
    await mockApis(page);
    await page.goto('/');
    await page.getByRole('button', { name: /settings/i }).click();
    await expect(page.getByText('Show ended sessions')).toBeVisible({ timeout: 3000 });
  });

  test('toggling Show ended sessions off via panel hides ended sessions immediately', async ({ page }) => {
    await mockApis(page);
    await page.goto('/');
    await expect(page.getByText('Completed session')).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: /settings/i }).click();
    await page.getByRole('checkbox', { name: /show ended sessions/i }).uncheck();
    await expect(page.getByText('Completed session')).not.toBeVisible();
    await expect(page.getByText('Ended session')).not.toBeVisible();
    await expect(page.getByText('Active session')).toBeVisible();
  });
});

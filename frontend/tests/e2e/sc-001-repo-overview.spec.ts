import { test, expect } from '@playwright/test';

test.describe('SC-001: Repository Overview', () => {
  test.beforeEach(async ({ page }) => {
    // Mock API responses
    await page.route('**/api/v1/repositories', (route) => {
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'repo-1', name: 'my-project', path: 'C:\\projects\\my-project', source: 'ui', addedAt: new Date().toISOString(), lastScannedAt: null },
          { id: 'repo-2', name: 'another-repo', path: 'C:\\projects\\another-repo', source: 'config', addedAt: new Date().toISOString(), lastScannedAt: null },
        ]),
      });
    });

    await page.route('**/api/v1/sessions**', (route) => {
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'session-1', repositoryId: 'repo-1', type: 'copilot-cli', pid: 1234, status: 'active', startedAt: new Date().toISOString(), endedAt: null, lastActivityAt: new Date().toISOString(), summary: 'Test session', expiresAt: null },
        ]),
      });
    });
    await page.route('**/api/v1/integrations', route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify({ integrationsEnabled: false, slack: { connectionStatus: 'unconfigured', notifier: null, listener: null }, teams: { connectionStatus: 'unconfigured', notifier: null, listener: null } }) })
    );
  });

  test('shows both repository cards within 5s', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'my-project' })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('heading', { name: 'another-repo' })).toBeVisible({ timeout: 5000 });
  });

  test('shows session count badge on repo with sessions', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('1 session')).toBeVisible({ timeout: 5000 });
  });

  test('shows session type badges', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('copilot-cli')).toBeVisible({ timeout: 5000 });
  });
});

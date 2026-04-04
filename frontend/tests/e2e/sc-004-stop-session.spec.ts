import { test, expect } from '@playwright/test';

test.describe('SC-004: Stop Session', () => {
  const sessionId = 'test-session-stop';

  test.beforeEach(async ({ page }) => {
    let sessionStatus = 'active';

    await page.route(`**/api/v1/sessions/${sessionId}`, (route) => {
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          id: sessionId, repositoryId: 'repo-1', type: 'copilot-cli', pid: 1234,
          status: sessionStatus, startedAt: new Date().toISOString(),
          endedAt: sessionStatus === 'ended' ? new Date().toISOString() : null,
          lastActivityAt: new Date().toISOString(), summary: null, expiresAt: null,
        }),
      });
    });

    await page.route(`**/api/v1/sessions/${sessionId}/output**`, (route) => {
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ items: [], nextBefore: null, total: 0 }),
      });
    });

    await page.route(`**/api/v1/sessions/${sessionId}/stop`, (route) => {
      sessionStatus = 'ended';
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ actionId: 'action-1', status: 'completed' }),
        status: 202,
      });
    });
  });

  test('stop button is visible for active session', async ({ page }) => {
    await page.goto(`/sessions/${sessionId}`);
    await expect(page.getByText('Stop Session')).toBeVisible({ timeout: 5000 });
  });

  test('confirms before stopping', async ({ page }) => {
    await page.goto(`/sessions/${sessionId}`);
    page.on('dialog', (dialog) => dialog.dismiss());
    await page.getByText('Stop Session').click();
    // After dismissing, session should still be active
    await expect(page.getByText('active')).toBeVisible({ timeout: 2000 });
  });
});

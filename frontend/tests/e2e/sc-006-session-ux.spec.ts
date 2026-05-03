import { test, expect } from './fixtures';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('argus:onboarding', JSON.stringify({
      schemaVersion: 1, userId: null,
      dashboardTour: { status: 'completed', completedAt: '2024-01-01T00:00:00.000Z', skippedAt: null, seenRepoSteps: true },
      sessionHints: { dismissed: [] },
    }));
  });
});

const REPOS = [
  { id: 'repo-1', name: 'my-project', path: 'C:\\projects\\my-project', source: 'ui', addedAt: new Date().toISOString(), lastScannedAt: null },
];

const SESSIONS = [
  { id: 'session-abc-123', repositoryId: 'repo-1', type: 'claude-code', launchMode: 'pty', pid: null, status: 'active', startedAt: new Date().toISOString(), endedAt: null, lastActivityAt: new Date().toISOString(), summary: 'Working on feature', expiresAt: null },
  { id: 'session-def-456', repositoryId: 'repo-1', type: 'copilot-cli', launchMode: 'pty', pid: 9999, status: 'active', startedAt: new Date().toISOString(), endedAt: null, lastActivityAt: new Date().toISOString(), summary: 'Another session', expiresAt: null },
];

const OUTPUT = [
  { id: 'out-1', sessionId: 'session-abc-123', timestamp: new Date().toISOString(), type: 'message', role: 'assistant', content: 'Hello from Claude', toolName: null, sequenceNumber: 1 },
];

async function mockApis(page: import('@playwright/test').Page) {
  await Promise.all([
    page.route('**/api/v1/repositories', route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify(REPOS) })
    ),
    page.route('**/api/v1/sessions**', route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify(SESSIONS) })
    ),
    page.route('**/api/v1/sessions/session-abc-123/output**', route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify({ items: OUTPUT, nextBefore: null, total: OUTPUT.length }) })
    ),
    page.route('**/api/v1/sessions/session-def-456/output**', route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify({ items: [], nextBefore: null, total: 0 }) })
    ),
  ]);
}

test.describe('SC-006: Session Detail UX', () => {

  // ─── US1: Two-Pane Layout ───────────────────────────────────────────────────

  test('US1: clicking a session card opens output pane on the right', async ({ page }) => {
    await mockApis(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'my-project' })).toBeVisible({ timeout: 5000 });

    // OutputPane should not be visible initially
    await expect(page.getByRole('region', { name: /session output/i })).not.toBeVisible();

    // Click the first session card
    await page.getByText('Working on feature').click();

    // Output pane should appear
    await expect(page.getByRole('region', { name: /session output/i })).toBeVisible({ timeout: 3000 });
  });

  test('US1: output pane shows streamed content for selected session', async ({ page }) => {
    await mockApis(page);
    await page.goto('/');
    await expect(page.getByText('Working on feature')).toBeVisible({ timeout: 5000 });
    await page.getByText('Working on feature').click();
    await expect(page.getByRole('region', { name: /session output/i }).getByText('Hello from Claude')).toBeVisible({ timeout: 3000 });
  });

  test('US1: closing the output pane returns to single-column layout', async ({ page }) => {
    await mockApis(page);
    await page.goto('/');
    await page.getByText('Working on feature').click();
    await expect(page.getByRole('region', { name: /session output/i })).toBeVisible({ timeout: 3000 });

    // Close button
    await page.getByRole('button', { name: /close output pane/i }).click();
    await expect(page.getByRole('region', { name: /session output/i })).not.toBeVisible();
  });

  test('US1: Escape key closes the output pane', async ({ page }) => {
    await mockApis(page);
    await page.goto('/');
    await page.getByText('Working on feature').click();
    await expect(page.getByRole('region', { name: /session output/i })).toBeVisible({ timeout: 3000 });
    await page.keyboard.press('Escape');
    await expect(page.getByRole('region', { name: /session output/i })).not.toBeVisible();
  });

  // ─── US3: Inline Prompt Input ───────────────────────────────────────────────

  test('US3: session card shows prompt input field for claude-code sessions', async ({ page }) => {
    await mockApis(page);
    await page.goto('/');
    await expect(page.getByText('Working on feature')).toBeVisible({ timeout: 5000 });
    await expect(page.getByPlaceholder(/send a prompt/i).first()).toBeVisible();
  });

  test('US3: copilot-cli card also shows prompt input field', async ({ page }) => {
    await mockApis(page);
    await page.goto('/');
    await expect(page.getByText('Another session')).toBeVisible({ timeout: 5000 });
    await expect(page.getByPlaceholder(/send a prompt/i).nth(1)).toBeVisible();
  });

  // ─── US4: Last Output Preview ───────────────────────────────────────────────

  test('US4: session card shows truncated last output line', async ({ page }) => {
    await mockApis(page);
    await page.goto('/');
    await expect(page.getByText('Working on feature')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Hello from Claude')).toBeVisible({ timeout: 3000 });
  });

  // ─── US5: Drill-In Link ──────────────────────────────────────────────────────

  test('US5: session card has a link to the full detail page', async ({ page }) => {
    await mockApis(page);
    await page.goto('/');
    await expect(page.getByText('Working on feature')).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('link', { name: /view details/i }).first()).toBeVisible();
  });

  // ─── US6: Claude session shows ID when no PID ────────────────────────────────

  test('US6: claude-code session shows truncated session ID when no PID', async ({ page }) => {
    await mockApis(page);
    await page.goto('/');
    await expect(page.getByText('Working on feature')).toBeVisible({ timeout: 5000 });
    // session-abc-123 has no PID — claudeShortId falls back to id.slice(0,8) = 'session-'
    await expect(page.getByText(/ID: session-/)).toBeVisible({ timeout: 3000 });
  });
});

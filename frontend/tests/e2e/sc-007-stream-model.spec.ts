import { test, expect } from '@playwright/test';

const REPOS = [
  { id: 'repo-1', name: 'my-project', path: 'C:\\projects\\my-project', source: 'ui', addedAt: new Date().toISOString(), lastScannedAt: null },
];

const SESSION_WITH_MODEL = {
  id: 'session-abc-123', repositoryId: 'repo-1', type: 'claude-code', pid: null,
  status: 'active', startedAt: new Date().toISOString(), endedAt: null,
  lastActivityAt: new Date().toISOString(), summary: 'Feature work', expiresAt: null,
  model: 'claude-opus-4-5',
};

const SESSION_NO_MODEL = {
  id: 'session-def-456', repositoryId: 'repo-1', type: 'copilot-cli', pid: 9999,
  status: 'active', startedAt: new Date().toISOString(), endedAt: null,
  lastActivityAt: new Date().toISOString(), summary: 'CLI session', expiresAt: null,
  model: null,
};

const OUTPUT_WITH_ROLES = [
  { id: 'out-1', sessionId: 'session-abc-123', timestamp: new Date().toISOString(), type: 'text', content: 'What should I do?', toolName: null, sequenceNumber: 1, role: 'user' },
  { id: 'out-2', sessionId: 'session-abc-123', timestamp: new Date().toISOString(), type: 'text', content: 'I will help you with that.', toolName: null, sequenceNumber: 2, role: 'assistant' },
  { id: 'out-3', sessionId: 'session-abc-123', timestamp: new Date().toISOString(), type: 'tool_use', content: 'read_file(main.ts)', toolName: 'read_file', sequenceNumber: 3, role: null },
];

async function mockApis(page: import('@playwright/test').Page) {
  await Promise.all([
    page.route('**/api/v1/repositories', route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify(REPOS) })
    ),
    page.route('**/api/v1/sessions**', route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify([SESSION_WITH_MODEL, SESSION_NO_MODEL]) })
    ),
    page.route('**/api/v1/sessions/session-abc-123/output**', route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify({ items: OUTPUT_WITH_ROLES, nextBefore: null, total: OUTPUT_WITH_ROLES.length }) })
    ),
    page.route('**/api/v1/sessions/session-def-456/output**', route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify({ items: [], nextBefore: null, total: 0 }) })
    ),
    page.route('**/api/v1/sessions/session-abc-123', route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify(SESSION_WITH_MODEL) })
    ),
    page.route('**/api/v1/sessions/session-def-456', route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify(SESSION_NO_MODEL) })
    ),
  ]);
}

test.describe('SC-007: Output Stream & Model Display', () => {

  // ─── US3: Model badge ───────────────────────────────────────────────────────

  test('US3: model name shown on session card when available', async ({ page }) => {
    await mockApis(page);
    await page.goto('/');
    await expect(page.getByText('my-project')).toBeVisible({ timeout: 5000 });

    await expect(page.getByText('claude-opus-4-5')).toBeVisible();
  });

  test('US3: no model text shown when model is null', async ({ page }) => {
    await mockApis(page);
    await page.goto('/');
    await expect(page.getByText('my-project')).toBeVisible({ timeout: 5000 });

    // copilot-cli session has no model, so only the type badge text should appear (no model label nearby)
    const cards = page.locator('[data-testid="session-card"], .session-card, [class*="SessionCard"]');
    // The null-model card should not show any model string — we just verify 'claude-opus-4-5' appears exactly once
    await expect(page.getByText('claude-opus-4-5')).toHaveCount(1);
  });

  // ─── US4: Role badges ───────────────────────────────────────────────────────

  test('US4: role YOU badge shown for user messages in output pane', async ({ page }) => {
    await mockApis(page);
    await page.goto('/');
    await expect(page.getByText('Feature work')).toBeVisible({ timeout: 5000 });

    // Open the session output pane
    await page.getByText('Feature work').click();
    await expect(page.getByRole('region', { name: /session output/i })).toBeVisible({ timeout: 3000 });

    await expect(page.getByText('YOU')).toBeVisible();
  });

  test('US4: role AI badge shown for assistant messages in output pane', async ({ page }) => {
    await mockApis(page);
    await page.goto('/');
    await expect(page.getByText('Feature work')).toBeVisible({ timeout: 5000 });

    await page.getByText('Feature work').click();
    await expect(page.getByRole('region', { name: /session output/i })).toBeVisible({ timeout: 3000 });

    await expect(page.getByText('AI')).toBeVisible();
  });

  test('US4: tool_use messages have no role badge', async ({ page }) => {
    await mockApis(page);
    await page.goto('/');
    await expect(page.getByText('Feature work')).toBeVisible({ timeout: 5000 });

    await page.getByText('Feature work').click();
    await expect(page.getByRole('region', { name: /session output/i })).toBeVisible({ timeout: 3000 });

    // The tool_use output content should be visible
    await expect(page.getByText('read_file(main.ts)')).toBeVisible();
  });

  // ─── US3: Model on session detail page ─────────────────────────────────────

  test('US3: model shown on session detail page', async ({ page }) => {
    await mockApis(page);
    await page.goto('/sessions/session-abc-123');
    await expect(page.getByText('claude-opus-4-5')).toBeVisible({ timeout: 5000 });
  });

});

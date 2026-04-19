import { test, expect, type Page } from '@playwright/test';

const SESSION_ID = 'session-detail-8c20d263-780c-4321-abcd-ef1234567890';

const BASE_SESSION = {
  id: SESSION_ID,
  repositoryId: 'repo-detail-1',
  type: 'claude-code',
  pid: null,
  status: 'active',
  startedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  endedAt: null,
  lastActivityAt: new Date().toISOString(),
  summary: 'Implementing authentication module',
  expiresAt: null,
  model: 'claude-opus-4-5',
};

async function mockSession(
  page: Page,
  sessionOverrides: Record<string, unknown> = {},
  outputItems: unknown[] = []
) {
  const session = { ...BASE_SESSION, ...sessionOverrides };
  await Promise.all([
    page.route(`**/api/v1/sessions/${SESSION_ID}`, route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify(session) })
    ),
    page.route(`**/api/v1/sessions/${SESSION_ID}/output**`, route =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ items: outputItems, nextBefore: null, total: outputItems.length }),
      })
    ),
  ]);
}

let seq = 0;
function makeOutput(overrides: Record<string, unknown>) {
  seq += 1;
  return {
    id: `out-${seq}`,
    sessionId: SESSION_ID,
    timestamp: new Date().toISOString(),
    type: 'message',
    role: null,
    content: 'output content',
    toolName: null,
    sequenceNumber: seq,
    ...overrides,
  };
}

test.describe('Session Detail Page', () => {

  // ─── Header: type badges ────────────────────────────────────────────────────

  test('shows claude-code type badge', async ({ page }) => {
    await mockSession(page, { type: 'claude-code' });
    await page.goto(`/sessions/${SESSION_ID}`);
    await expect(page.getByText('claude-code')).toBeVisible({ timeout: 5000 });
  });

  test('shows copilot-cli type badge', async ({ page }) => {
    await mockSession(page, { type: 'copilot-cli', pid: 5678 });
    await page.goto(`/sessions/${SESSION_ID}`);
    await expect(page.getByText('copilot-cli')).toBeVisible({ timeout: 5000 });
  });

  // ─── Header: status badges ──────────────────────────────────────────────────

  test('shows "running" label for active sessions', async ({ page }) => {
    await mockSession(page, { status: 'active' });
    await page.goto(`/sessions/${SESSION_ID}`);
    await expect(page.getByText('running')).toBeVisible({ timeout: 5000 });
  });

  test('shows "resting" badge for sessions with no activity for 20+ minutes', async ({ page }) => {
    await mockSession(page, { lastActivityAt: new Date(Date.now() - 25 * 60 * 1000).toISOString() });
    await page.goto(`/sessions/${SESSION_ID}`);
    await expect(page.getByText('resting')).toBeVisible({ timeout: 5000 });
  });

  test('shows "waiting" status badge', async ({ page }) => {
    await mockSession(page, { status: 'waiting' });
    await page.goto(`/sessions/${SESSION_ID}`);
    await expect(page.getByText('waiting', { exact: true })).toBeVisible({ timeout: 5000 });
  });

  test('shows "error" status badge', async ({ page }) => {
    await mockSession(page, { status: 'error' });
    await page.goto(`/sessions/${SESSION_ID}`);
    await expect(page.getByText('error')).toBeVisible({ timeout: 5000 });
  });

  test('shows "completed" status badge', async ({ page }) => {
    await mockSession(page, { status: 'completed', endedAt: new Date().toISOString() });
    await page.goto(`/sessions/${SESSION_ID}`);
    await expect(page.getByText('completed')).toBeVisible({ timeout: 5000 });
  });

  test('shows "ended" status badge', async ({ page }) => {
    await mockSession(page, { status: 'ended', endedAt: new Date().toISOString() });
    await page.goto(`/sessions/${SESSION_ID}`);
    await expect(page.getByText('ended')).toBeVisible({ timeout: 5000 });
  });

  test('shows "resting" amber badge for sessions inactive over 20 minutes', async ({ page }) => {
    await mockSession(page, {
      status: 'active',
      lastActivityAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    });
    await page.goto(`/sessions/${SESSION_ID}`);
    await expect(page.getByText('resting')).toBeVisible({ timeout: 5000 });
  });

  // ─── Header: model and identity ─────────────────────────────────────────────

  test('shows model name when available', async ({ page }) => {
    await mockSession(page, { model: 'claude-opus-4-5' });
    await page.goto(`/sessions/${SESSION_ID}`);
    await expect(page.getByText('claude-opus-4-5')).toBeVisible({ timeout: 5000 });
  });

  test('does not show model text when model is null', async ({ page }) => {
    await mockSession(page, { type: 'copilot-cli', pid: 9999, model: null });
    await page.goto(`/sessions/${SESSION_ID}`);
    await expect(page.getByText('copilot-cli')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('claude-opus-4-5')).not.toBeVisible();
  });

  test('shows PID when session has a PID', async ({ page }) => {
    await mockSession(page, { type: 'copilot-cli', pid: 1234 });
    await page.goto(`/sessions/${SESSION_ID}`);
    await expect(page.getByText('PID: 1234')).toBeVisible({ timeout: 5000 });
  });

  test('shows truncated session ID for claude-code session without PID', async ({ page }) => {
    await mockSession(page, { type: 'claude-code', pid: null });
    await page.goto(`/sessions/${SESSION_ID}`);
    // claudeShortId() extracts the first 8 hex chars of the UUID segment: "8c20d263"
    await expect(page.getByText('ID: 8c20d263')).toBeVisible({ timeout: 5000 });
  });

  test('shows session duration', async ({ page }) => {
    await mockSession(page);
    await page.goto(`/sessions/${SESSION_ID}`);
    await expect(page.getByText(/\d+m/)).toBeVisible({ timeout: 5000 });
  });

  test('shows session summary', async ({ page }) => {
    await mockSession(page, { summary: 'Implementing authentication module' });
    await page.goto(`/sessions/${SESSION_ID}`);
    await expect(page.getByText('Implementing authentication module')).toBeVisible({ timeout: 5000 });
  });

  test('shows full session ID in the output pane header', async ({ page }) => {
    await mockSession(page);
    await page.goto(`/sessions/${SESSION_ID}`);
    await expect(page.getByText(SESSION_ID)).toBeVisible({ timeout: 5000 });
  });

  // ─── Navigation ─────────────────────────────────────────────────────────────

  test('"Back" button navigates to /', async ({ page }) => {
    await mockSession(page);
    await page.goto(`/sessions/${SESSION_ID}`);
    await expect(page.getByRole('button', { name: /Back/i })).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: /Back/i }).first().click();
    await expect(page).toHaveURL('/');
  });

  test('shows "Session not found." when session returns 404', async ({ page }) => {
    await page.route(`**/api/v1/sessions/${SESSION_ID}`, route =>
      route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'NOT_FOUND' }) })
    );
    await page.route(`**/api/v1/sessions/${SESSION_ID}/output**`, route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify({ items: [], nextBefore: null, total: 0 }) })
    );
    await page.goto(`/sessions/${SESSION_ID}`);
    await expect(page.getByText('Session not found.')).toBeVisible({ timeout: 5000 });
  });

  test('"Back" button visible on 404 page', async ({ page }) => {
    await page.route(`**/api/v1/sessions/${SESSION_ID}`, route =>
      route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'NOT_FOUND' }) })
    );
    await page.route(`**/api/v1/sessions/${SESSION_ID}/output**`, route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify({ items: [], nextBefore: null, total: 0 }) })
    );
    await page.goto(`/sessions/${SESSION_ID}`);
    await expect(page.getByText('Session not found.')).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: /Back/i })).toBeVisible();
  });

  // ─── Stop Session button ─────────────────────────────────────────────────────

  test('Stop Session button is hidden for ended sessions', async ({ page }) => {
    await mockSession(page, { status: 'ended', endedAt: new Date().toISOString() });
    await page.goto(`/sessions/${SESSION_ID}`);
    await expect(page.getByText('ended')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Stop Session')).not.toBeVisible();
  });

  test('Stop Session button is hidden for completed sessions', async ({ page }) => {
    await mockSession(page, { status: 'completed', endedAt: new Date().toISOString() });
    await page.goto(`/sessions/${SESSION_ID}`);
    await expect(page.getByText('completed')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Stop Session')).not.toBeVisible();
  });

  // ─── Output Stream section ───────────────────────────────────────────────────

  test('shows output pane with session output', async ({ page }) => {
    await mockSession(page);
    await page.goto(`/sessions/${SESSION_ID}`);
    await expect(page.getByRole('region', { name: /session output/i })).toBeVisible({ timeout: 5000 });
  });

  test('shows empty state when there are no output items', async ({ page }) => {
    await mockSession(page);
    await page.goto(`/sessions/${SESSION_ID}`);
    await expect(page.getByText('No output yet. Waiting for session activity...')).toBeVisible({ timeout: 5000 });
  });

  // ─── Output type badges ──────────────────────────────────────────────────────

  test('shows YOU badge for user messages', async ({ page }) => {
    await mockSession(page, {}, [makeOutput({ type: 'message', role: 'user', content: 'Hello from user' })]);
    await page.goto(`/sessions/${SESSION_ID}`);
    await expect(page.getByText('YOU', { exact: true })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Hello from user')).toBeVisible();
  });

  test('shows AI badge for assistant messages', async ({ page }) => {
    await mockSession(page, {}, [makeOutput({ type: 'message', role: 'assistant', content: 'Response from assistant' })]);
    await page.goto(`/sessions/${SESSION_ID}`);
    await expect(page.getByText('AI', { exact: true })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Response from assistant')).toBeVisible();
  });

  test('shows MSG badge for message items with no role', async ({ page }) => {
    await mockSession(page, {}, [makeOutput({ type: 'message', role: null, content: 'Roleless message' })]);
    await page.goto(`/sessions/${SESSION_ID}`);
    await expect(page.getByText('MSG', { exact: true })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Roleless message')).toBeVisible();
  });

  test('shows TOOL badge for tool_use items', async ({ page }) => {
    await mockSession(page, {}, [makeOutput({ type: 'tool_use', role: null, content: 'ls -la', toolName: 'bash' })]);
    await page.goto(`/sessions/${SESSION_ID}`);
    await expect(page.getByText('TOOL', { exact: true })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('ls -la')).toBeVisible();
  });

  test('shows RESULT badge for tool_result items', async ({ page }) => {
    // Verbose mode required: orphaned tool_result items are hidden in focused mode
    await page.addInitScript(() => {
      localStorage.setItem('argus:settings', JSON.stringify({ outputDisplayMode: 'verbose' }));
    });
    await mockSession(page, {}, [makeOutput({ type: 'tool_result', role: null, content: 'file1.ts\nfile2.ts', toolName: 'bash' })]);
    await page.goto(`/sessions/${SESSION_ID}`);
    await expect(page.getByText('RESULT', { exact: true })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/file1\.ts/)).toBeVisible();
  });

  test('shows ERR badge for error items', async ({ page }) => {
    await mockSession(page, {}, [makeOutput({ type: 'error', role: null, content: 'Something went wrong' })]);
    await page.goto(`/sessions/${SESSION_ID}`);
    await expect(page.getByText('ERR', { exact: true })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Something went wrong')).toBeVisible();
  });

  test('shows STATUS badge for status_change items', async ({ page }) => {
    await mockSession(page, {}, [makeOutput({ type: 'status_change', role: null, content: 'Session became active' })]);
    await page.goto(`/sessions/${SESSION_ID}`);
    await expect(page.getByText('STATUS', { exact: true })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Session became active')).toBeVisible();
  });

  test('shows tool name badge for tool_use items', async ({ page }) => {
    await mockSession(page, {}, [makeOutput({ type: 'tool_use', role: null, content: 'cat README.md', toolName: 'bash' })]);
    await page.goto(`/sessions/${SESSION_ID}`);
    // Tool name appears as a colored badge pill (not bracket notation)
    await expect(page.getByText('bash', { exact: true })).toBeVisible({ timeout: 5000 });
  });

  test('renders message content as Markdown (bold and inline code)', async ({ page }) => {
    await mockSession(page, {}, [makeOutput({ type: 'message', role: 'assistant', content: '**bold text** and `inline code`' })]);
    await page.goto(`/sessions/${SESSION_ID}`);
    await expect(page.getByText('AI', { exact: true })).toBeVisible({ timeout: 5000 });
    await expect(page.locator('strong').filter({ hasText: 'bold text' })).toBeVisible();
    await expect(page.locator('code').filter({ hasText: 'inline code' })).toBeVisible();
  });

  test('renders multiple output items of different types together', async ({ page }) => {
    // Verbose mode so all badges and content are visible without expanding pairs
    await page.addInitScript(() => {
      localStorage.setItem('argus:settings', JSON.stringify({ outputDisplayMode: 'verbose' }));
    });
    const items = [
      makeOutput({ id: 'multi-1', type: 'message', role: 'user', content: 'Run the tests', sequenceNumber: 1 }),
      makeOutput({ id: 'multi-2', type: 'tool_use', role: null, content: 'npm test', toolName: 'bash', sequenceNumber: 2 }),
      makeOutput({ id: 'multi-3', type: 'tool_result', role: null, content: 'All tests passed', toolName: 'bash', sequenceNumber: 3 }),
      makeOutput({ id: 'multi-4', type: 'message', role: 'assistant', content: 'Done, all green', sequenceNumber: 4 }),
    ];
    await mockSession(page, {}, items);
    await page.goto(`/sessions/${SESSION_ID}`);
    await expect(page.getByText('YOU', { exact: true })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('TOOL', { exact: true })).toBeVisible();
    await expect(page.getByText('RESULT', { exact: true })).toBeVisible();
    await expect(page.getByText('AI', { exact: true })).toBeVisible();
    await expect(page.getByText('Run the tests')).toBeVisible();
    await expect(page.getByText('npm test')).toBeVisible();
    await expect(page.getByText('All tests passed')).toBeVisible();
    await expect(page.getByText('Done, all green')).toBeVisible();
  });

  test('shows tool name badge for tool_result items', async ({ page }) => {
    // Verbose mode required: orphaned tool_result items are hidden in focused mode
    await page.addInitScript(() => {
      localStorage.setItem('argus:settings', JSON.stringify({ outputDisplayMode: 'verbose' }));
    });
    await mockSession(page, {}, [makeOutput({ type: 'tool_result', role: null, content: 'exit code 0', toolName: 'bash' })]);
    await page.goto(`/sessions/${SESSION_ID}`);
    await expect(page.getByText('RESULT', { exact: true })).toBeVisible({ timeout: 5000 });
    // Tool name appears as a colored badge pill (not bracket notation)
    await expect(page.getByText('bash', { exact: true })).toBeVisible();
  });

  test('shows formatted timestamp for each output item', async ({ page }) => {
    await mockSession(page, {}, [makeOutput({ type: 'message', role: 'assistant', content: 'Check the time' })]);
    await page.goto(`/sessions/${SESSION_ID}`);
    await expect(page.getByText('AI', { exact: true })).toBeVisible({ timeout: 5000 });
    // Timestamps are formatted as HH:MM:SS by formatTime()
    await expect(page.getByText(/\d{1,2}:\d{2}:\d{2}/)).toBeVisible();
  });

  // ─── Prompt bar on detail page ───────────────────────────────────────────────

  test('prompt bar is visible on the detail page', async ({ page }) => {
    await mockSession(page, { launchMode: 'pty' });
    await page.goto(`/sessions/${SESSION_ID}`);
    await expect(page.getByPlaceholder('Send a prompt…')).toBeVisible({ timeout: 5000 });
  });

  test('prompt bar Send button is disabled when input is empty', async ({ page }) => {
    await mockSession(page, { launchMode: 'pty' });
    await page.goto(`/sessions/${SESSION_ID}`);
    await expect(page.getByRole('button', { name: 'Send' })).toBeDisabled({ timeout: 5000 });
  });

  test('prompt bar sends prompt on the detail page and clears input', async ({ page }) => {
    await mockSession(page, { launchMode: 'pty' });
    let sendCalled = false;
    await page.route(`**/api/v1/sessions/${SESSION_ID}/send`, route => {
      sendCalled = true;
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ id: 'act-dp-1', sessionId: SESSION_ID, type: 'send_prompt', payload: null, status: 'completed' }),
      });
    });
    await page.goto(`/sessions/${SESSION_ID}`);
    const input = page.getByPlaceholder('Send a prompt…');
    await input.fill('detail page prompt');
    await page.getByRole('button', { name: 'Send' }).click();
    await expect(input).toHaveValue('', { timeout: 3000 });
    expect(sendCalled).toBe(true);
  });

});

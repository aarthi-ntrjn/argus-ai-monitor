import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('argus:onboarding', JSON.stringify({
      schemaVersion: 1, userId: null,
      dashboardTour: { status: 'completed', completedAt: '2024-01-01T00:00:00.000Z', skippedAt: null },
      sessionHints: { dismissed: [] },
    }));
  });
});

// ── Fixtures ──────────────────────────────────────────────────────────────────

const REPO = {
  id: 'r-sc001-card',
  name: 'test-project',
  path: 'C:\\projects\\test-project',
  source: 'ui',
  addedAt: new Date().toISOString(),
  lastScannedAt: null,
};

// claude-code: no PID, has model, status=active, recent activity
const SESSION_CLAUDE = {
  id: 'claude-startup-8c20d263-780c-4321-abcd-ef1234567890',
  repositoryId: 'r-sc001-card',
  type: 'claude-code',
  pid: null,
  status: 'active',
  startedAt: new Date().toISOString(),
  endedAt: null,
  lastActivityAt: new Date().toISOString(),
  summary: 'Writing unit tests for auth module',
  expiresAt: null,
  model: 'claude-opus-4-5',
};

// copilot-cli: has PID, no model, status=active
const SESSION_COPILOT = {
  id: 'session-copilot-pid-4321',
  repositoryId: 'r-sc001-card',
  type: 'copilot-cli',
  pid: 4321,
  status: 'active',
  startedAt: new Date().toISOString(),
  endedAt: null,
  lastActivityAt: new Date().toISOString(),
  summary: 'Scaffolding CRUD endpoints',
  expiresAt: null,
  model: null,
};

// inactive: lastActivityAt 25 min ago, still "active" status
const STALE_ACTIVITY = new Date(Date.now() - 25 * 60 * 1000).toISOString();
const SESSION_INACTIVE = {
  id: 'session-inactive-card-1',
  repositoryId: 'r-sc001-card',
  type: 'claude-code',
  pid: null,
  status: 'active',
  startedAt: new Date().toISOString(),
  endedAt: null,
  lastActivityAt: STALE_ACTIVITY,
  summary: 'Idle for a while',
  expiresAt: null,
  model: null,
};

const OUTPUT_WITH_TOOL_RESULT = [
  { id: 'o-msg', sessionId: SESSION_CLAUDE.id, timestamp: new Date().toISOString(), type: 'message', role: 'assistant', content: 'Not the preview — message comes before tool_result', toolName: null, sequenceNumber: 1 },
  { id: 'o-tr', sessionId: SESSION_CLAUDE.id, timestamp: new Date().toISOString(), type: 'tool_result', role: null, content: 'Tool result content shown', toolName: 'bash', sequenceNumber: 2 },
];

const OUTPUT_MESSAGE_ONLY = [
  { id: 'o-msg2', sessionId: SESSION_CLAUDE.id, timestamp: new Date().toISOString(), type: 'message', role: 'assistant', content: 'Message only content', toolName: null, sequenceNumber: 1 },
];

type Page = import('@playwright/test').Page;

/**
 * Register all API routes needed for the dashboard with a set of sessions.
 * Output routes are registered AFTER the broad sessions route so they take
 * precedence (Playwright uses LIFO ordering for route matching).
 * An optional outputOverride seeds specific output items for one session.
 */
async function mockApis(
  page: Page,
  sessions: typeof SESSION_CLAUDE[] | typeof SESSION_COPILOT[] | unknown[],
  outputOverride?: { sessionId: string; items: unknown[] }
) {
  await Promise.all([
    page.route('**/api/v1/repositories', route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify([REPO]) })
    ),
    // Broad sessions route — registered first, checked last (LIFO)
    page.route('**/api/v1/sessions**', route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify(sessions) })
    ),
    // Per-session output routes — registered last, checked first (LIFO)
    ...(sessions as Array<{ id: string }>).map(s =>
      page.route(`**/api/v1/sessions/${s.id}/output**`, route =>
        route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            items: outputOverride?.sessionId === s.id ? outputOverride.items : [],
            nextBefore: null,
            total: outputOverride?.sessionId === s.id ? outputOverride.items.length : 0,
          }),
        })
      )
    ),
  ]);
}

// ── SC-005: Type Badges ───────────────────────────────────────────────────────

test.describe('SC-005: Session Card — Type Badges', () => {

  test('claude-code session shows "claude-code" type badge', async ({ page }) => {
    await mockApis(page, [SESSION_CLAUDE]);
    await page.goto('/');
    await expect(page.getByText('claude-code').first()).toBeVisible({ timeout: 5000 });
  });

  test('copilot-cli session shows "copilot-cli" type badge', async ({ page }) => {
    await mockApis(page, [SESSION_COPILOT]);
    await page.goto('/');
    await expect(page.getByText('copilot-cli').first()).toBeVisible({ timeout: 5000 });
  });

  test('both type badges are visible when both session types are present', async ({ page }) => {
    await mockApis(page, [SESSION_CLAUDE, SESSION_COPILOT]);
    await page.goto('/');
    await expect(page.getByText('claude-code').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('copilot-cli').first()).toBeVisible({ timeout: 5000 });
  });

});

// ── SC-003: Status Badges ─────────────────────────────────────────────────────

test.describe('SC-003: Session Card — Status Badges', () => {

  test('active session shows "running" (not "active")', async ({ page }) => {
    await mockApis(page, [SESSION_CLAUDE]);
    await page.goto('/');
    await expect(page.getByText('running')).toBeVisible({ timeout: 5000 });
    // The raw status value "active" should not appear as a label
    await expect(page.getByText('active', { exact: true })).not.toBeVisible();
  });

  test('completed session shows "completed" status badge', async ({ page }) => {
    const s = { ...SESSION_COPILOT, status: 'completed', endedAt: new Date().toISOString() };
    await mockApis(page, [s]);
    await page.goto('/');
    await expect(page.getByText('completed')).toBeVisible({ timeout: 5000 });
  });

  test('ended session shows "ended" status badge', async ({ page }) => {
    const s = { ...SESSION_COPILOT, status: 'ended', endedAt: new Date().toISOString() };
    await mockApis(page, [s]);
    await page.goto('/');
    await expect(page.getByText('ended')).toBeVisible({ timeout: 5000 });
  });

  test('idle session shows "idle" status badge', async ({ page }) => {
    const s = { ...SESSION_CLAUDE, status: 'idle' };
    await mockApis(page, [s]);
    await page.goto('/');
    await expect(page.getByText('idle')).toBeVisible({ timeout: 5000 });
  });

  test('waiting session shows "waiting" status badge', async ({ page }) => {
    const s = { ...SESSION_CLAUDE, status: 'waiting' };
    await mockApis(page, [s]);
    await page.goto('/');
    await expect(page.getByText('waiting')).toBeVisible({ timeout: 5000 });
  });

  test('error session shows "error" status badge', async ({ page }) => {
    const s = { ...SESSION_CLAUDE, status: 'error' };
    await mockApis(page, [s]);
    await page.goto('/');
    await expect(page.getByText('error')).toBeVisible({ timeout: 5000 });
  });

  test('inactive session (>20 min stale) shows "resting" badge instead of status badge', async ({ page }) => {
    await mockApis(page, [SESSION_INACTIVE]);
    await page.goto('/');
    await expect(page.getByText('resting')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('running')).not.toBeVisible();
  });

});

// ── SC-003: Meta Row ──────────────────────────────────────────────────────────

test.describe('SC-003: Session Card — Meta Row', () => {

  test('copilot-cli session with a PID shows "PID: 4321" in the meta row', async ({ page }) => {
    await mockApis(page, [SESSION_COPILOT]);
    await page.goto('/');
    await expect(page.getByText(/PID: 4321/)).toBeVisible({ timeout: 5000 });
  });

  test('claude-code session without a PID shows short session ID', async ({ page }) => {
    await mockApis(page, [SESSION_CLAUDE]);
    await page.goto('/');
    // claudeShortId extracts the first 8 hex chars from the first UUID segment
    await expect(page.getByText(/ID: 8c20d263/)).toBeVisible({ timeout: 5000 });
  });

  test('session with a model shows the model name in the meta row', async ({ page }) => {
    await mockApis(page, [SESSION_CLAUDE]);
    await page.goto('/');
    await expect(page.getByText(/claude-opus-4-5/)).toBeVisible({ timeout: 5000 });
  });

  test('session without a model does not show a model name', async ({ page }) => {
    await mockApis(page, [SESSION_COPILOT]);
    await page.goto('/');
    await expect(page.getByText(/PID: 4321/)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/claude-opus/)).not.toBeVisible();
  });

  test('elapsed time appears in the meta row', async ({ page }) => {
    await mockApis(page, [SESSION_CLAUDE]);
    await page.goto('/');
    // Elapsed format: "0s", "1m 5s", "2h 10m", etc.
    await expect(page.getByText(/\d+s/)).toBeVisible({ timeout: 5000 });
  });

});

// ── SC-001: Summary & Output Preview ─────────────────────────────────────────

test.describe('SC-001: Session Card — Summary & Output Preview', () => {

  test('session summary text is displayed on the card', async ({ page }) => {
    await mockApis(page, [SESSION_CLAUDE]);
    await page.goto('/');
    await expect(page.getByText('Writing unit tests for auth module')).toBeVisible({ timeout: 5000 });
  });

  test('session without a summary shows no summary line', async ({ page }) => {
    const s = { ...SESSION_CLAUDE, summary: null };
    await mockApis(page, [s]);
    await page.goto('/');
    // Page loads (type badge visible) but no summary text
    await expect(page.getByText('claude-code').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Writing unit tests for auth module')).not.toBeVisible();
  });

  test('output preview prefers tool_result over message content', async ({ page }) => {
    await mockApis(page, [SESSION_CLAUDE], { sessionId: SESSION_CLAUDE.id, items: OUTPUT_WITH_TOOL_RESULT });
    await page.goto('/');
    await expect(page.getByText('Tool result content shown')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Not the preview — message comes before tool_result')).not.toBeVisible();
  });

  test('output preview falls back to message content when no tool_result exists', async ({ page }) => {
    await mockApis(page, [SESSION_CLAUDE], { sessionId: SESSION_CLAUDE.id, items: OUTPUT_MESSAGE_ONLY });
    await page.goto('/');
    await expect(page.getByText('Message only content')).toBeVisible({ timeout: 5000 });
  });

  test('no output preview section rendered when session has no output', async ({ page }) => {
    await mockApis(page, [SESSION_CLAUDE]);
    await page.goto('/');
    await expect(page.getByText('Writing unit tests for auth module')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Tool result content shown')).not.toBeVisible();
    await expect(page.getByText('Message only content')).not.toBeVisible();
  });

});

// ── SC-001: View Details Link ─────────────────────────────────────────────────

test.describe('SC-001: Session Card — View Details Link', () => {

  test('"View details" link navigates to the session detail page', async ({ page }) => {
    await mockApis(page, [SESSION_CLAUDE]);
    await page.goto('/');
    await expect(page.getByText('Writing unit tests for auth module')).toBeVisible({ timeout: 5000 });
    await page.getByRole('link', { name: /view details/i }).first().click();
    await expect(page).toHaveURL(/\/sessions\/claude-startup-8c20d263/, { timeout: 3000 });
  });

});

// ── SC-001: Prompt Bar — Send ─────────────────────────────────────────────────

test.describe('SC-001: Session Card — Prompt Bar Send', () => {

  test('Send button is disabled when prompt input is empty', async ({ page }) => {
    await mockApis(page, [SESSION_CLAUDE]);
    await page.goto('/');
    await expect(page.getByText('Writing unit tests for auth module')).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: 'Send' }).first()).toBeDisabled();
  });

  test('Send button becomes enabled after typing in the prompt input', async ({ page }) => {
    await mockApis(page, [SESSION_CLAUDE]);
    await page.goto('/');
    await expect(page.getByText('Writing unit tests for auth module')).toBeVisible({ timeout: 5000 });
    await page.getByPlaceholder('Send a prompt…').first().fill('Hello');
    await expect(page.getByRole('button', { name: 'Send' }).first()).toBeEnabled();
  });

  test('clicking Send POSTs to /sessions/{id}/send and clears the input', async ({ page }) => {
    await mockApis(page, [SESSION_CLAUDE]);
    let sendCalled = false;
    await page.route(`**/api/v1/sessions/${SESSION_CLAUDE.id}/send`, route => {
      sendCalled = true;
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ id: 'act-1', sessionId: SESSION_CLAUDE.id, type: 'send_prompt', payload: null, status: 'completed' }),
      });
    });
    await page.goto('/');
    await expect(page.getByText('Writing unit tests for auth module')).toBeVisible({ timeout: 5000 });
    const input = page.getByPlaceholder('Send a prompt…').first();
    await input.fill('do something useful');
    await page.getByRole('button', { name: 'Send' }).first().click();
    await expect(input).toHaveValue('', { timeout: 3000 });
    expect(sendCalled).toBe(true);
  });

  test('pressing Enter in the prompt input sends the prompt', async ({ page }) => {
    await mockApis(page, [SESSION_CLAUDE]);
    let sendCalled = false;
    await page.route(`**/api/v1/sessions/${SESSION_CLAUDE.id}/send`, route => {
      sendCalled = true;
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ id: 'act-2', sessionId: SESSION_CLAUDE.id, type: 'send_prompt', payload: null, status: 'completed' }),
      });
    });
    await page.goto('/');
    await expect(page.getByText('Writing unit tests for auth module')).toBeVisible({ timeout: 5000 });
    await page.getByPlaceholder('Send a prompt…').first().fill('enter key send');
    await page.keyboard.press('Enter');
    await expect(page.getByPlaceholder('Send a prompt…').first()).toHaveValue('', { timeout: 3000 });
    expect(sendCalled).toBe(true);
  });

  test('inline error is shown when the send API returns an error', async ({ page }) => {
    await mockApis(page, [SESSION_CLAUDE]);
    await page.route(`**/api/v1/sessions/${SESSION_CLAUDE.id}/send`, route =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Server error occurred' }),
      })
    );
    await page.goto('/');
    await expect(page.getByText('Writing unit tests for auth module')).toBeVisible({ timeout: 5000 });
    await page.getByPlaceholder('Send a prompt…').first().fill('trigger error');
    await page.getByRole('button', { name: 'Send' }).first().click();
    await expect(page.getByText('Server error occurred')).toBeVisible({ timeout: 3000 });
  });

});

// ── SC-001: Prompt Bar — Actions Menu ────────────────────────────────────────

test.describe('SC-001: Session Card — Actions Menu', () => {

  test('Esc (interrupt) command fires immediately without a confirmation modal', async ({ page }) => {
    await mockApis(page, [SESSION_CLAUDE]);
    let interruptCalled = false;
    await page.route(`**/api/v1/sessions/${SESSION_CLAUDE.id}/interrupt`, route => {
      interruptCalled = true;
      return route.fulfill({
        contentType: 'application/json',
        status: 202,
        body: JSON.stringify({ actionId: 'act-3', status: 'completed' }),
      });
    });
    await page.goto('/');
    await expect(page.getByText('Writing unit tests for auth module')).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: /session actions menu/i }).first().click();
    await page.getByRole('button', { name: /^Esc$/i }).click();
    // No confirmation modal
    await expect(page.getByText(/cancel/i)).not.toBeVisible();
    expect(interruptCalled).toBe(true);
  });

  test('Exit command shows a confirmation modal', async ({ page }) => {
    await mockApis(page, [SESSION_CLAUDE]);
    await page.goto('/');
    await expect(page.getByText('Writing unit tests for auth module')).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: /session actions menu/i }).first().click();
    await page.getByRole('button', { name: /^Exit$/i }).click();
    await expect(page.getByText('Send /exit to close the session?')).toBeVisible({ timeout: 2000 });
  });

  test('Cancel on confirmation modal dismisses without sending', async ({ page }) => {
    await mockApis(page, [SESSION_CLAUDE]);
    let sendCalled = false;
    await page.route(`**/api/v1/sessions/${SESSION_CLAUDE.id}/send`, route => {
      sendCalled = true;
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({}) });
    });
    await page.goto('/');
    await expect(page.getByText('Writing unit tests for auth module')).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: /session actions menu/i }).first().click();
    await page.getByRole('button', { name: /^Exit$/i }).click();
    await expect(page.getByText('Send /exit to close the session?')).toBeVisible({ timeout: 2000 });
    await page.getByRole('button', { name: /^Cancel$/i }).click();
    await expect(page.getByText('Send /exit to close the session?')).not.toBeVisible();
    expect(sendCalled).toBe(false);
  });

  test('Confirm on confirmation modal executes the command', async ({ page }) => {
    await mockApis(page, [SESSION_CLAUDE]);
    let sendCalled = false;
    await page.route(`**/api/v1/sessions/${SESSION_CLAUDE.id}/send`, route => {
      sendCalled = true;
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ id: 'act-4', sessionId: SESSION_CLAUDE.id, type: 'send_prompt', payload: null, status: 'completed' }),
      });
    });
    await page.goto('/');
    await expect(page.getByText('Writing unit tests for auth module')).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: /session actions menu/i }).first().click();
    await page.getByRole('button', { name: /^Exit$/i }).click();
    await page.getByRole('button', { name: /^Confirm$/i }).click();
    expect(sendCalled).toBe(true);
    await expect(page.getByText('Send /exit to close the session?')).not.toBeVisible();
  });

  test('Merge command shows its confirmation message', async ({ page }) => {
    await mockApis(page, [SESSION_CLAUDE]);
    await page.goto('/');
    await expect(page.getByText('Writing unit tests for auth module')).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: /session actions menu/i }).first().click();
    await page.getByRole('button', { name: /^Merge$/i }).click();
    await expect(page.getByText('Merge current branch with main?')).toBeVisible({ timeout: 2000 });
  });

  test('Pull latest command shows its confirmation message', async ({ page }) => {
    await mockApis(page, [SESSION_CLAUDE]);
    await page.goto('/');
    await expect(page.getByText('Writing unit tests for auth module')).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: /session actions menu/i }).first().click();
    await page.getByRole('button', { name: /^Pull latest$/i }).click();
    await expect(page.getByText('Pull latest changes from main?')).toBeVisible({ timeout: 2000 });
  });

  test('actions menu closes when Escape key is pressed', async ({ page }) => {
    await mockApis(page, [SESSION_CLAUDE]);
    await page.goto('/');
    await expect(page.getByText('Writing unit tests for auth module')).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: /session actions menu/i }).first().click();
    await expect(page.getByRole('button', { name: /^Exit$/i })).toBeVisible({ timeout: 2000 });
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: /^Exit$/i })).not.toBeVisible();
  });

  test('actions menu closes when clicking outside', async ({ page }) => {
    await mockApis(page, [SESSION_CLAUDE]);
    await page.goto('/');
    await expect(page.getByText('Writing unit tests for auth module')).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: /session actions menu/i }).first().click();
    await expect(page.getByRole('button', { name: /^Exit$/i })).toBeVisible({ timeout: 2000 });
    await page.getByRole('heading', { name: 'test-project' }).click();
    await expect(page.getByRole('button', { name: /^Exit$/i })).not.toBeVisible();
  });

});

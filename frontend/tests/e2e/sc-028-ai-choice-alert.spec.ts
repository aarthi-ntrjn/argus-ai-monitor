import { test, expect } from './fixtures';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const SESSION_ID = 'test-session-028-choice';

const REPO = {
  id: 'repo-1',
  name: 'my-project',
  path: 'C:\\projects\\my-project',
  source: 'ui',
  addedAt: new Date().toISOString(),
  lastScannedAt: null,
  branch: 'main',
};

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    id: SESSION_ID,
    repositoryId: 'repo-1',
    type: 'claude-code',
    launchMode: null,
    pid: null,
    pidSource: null,
    status: 'active',
    startedAt: new Date().toISOString(),
    endedAt: null,
    lastActivityAt: new Date().toISOString(),
    summary: 'session summary',
    expiresAt: null,
    model: null,
    yoloMode: false,
    ...overrides,
  };
}

function makeOutput(overrides: Record<string, unknown> = {}) {
  return {
    id: 'out-1',
    sessionId: SESSION_ID,
    timestamp: new Date().toISOString(),
    type: 'message',
    content: '',
    toolName: null,
    toolCallId: null,
    role: 'assistant',
    sequenceNumber: 1,
    ...overrides,
  };
}

function makePendingChoiceMessage(question: string, choices: string[]) {
  return JSON.stringify({
    type: 'session.pending_choice',
    data: {
      sessionId: SESSION_ID,
      question,
      choices,
      allQuestions: [{ question, choices }],
    },
  });
}

async function stubDashboard(
  page: import('@playwright/test').Page,
  sessionOverrides: Record<string, unknown> = {},
  outputItems: Record<string, unknown>[] = [],
  wsHandler?: (ws: import('@playwright/test').WebSocketRoute) => void,
) {
  await page.addInitScript(() => {
    localStorage.setItem('argus:onboarding', JSON.stringify({
      schemaVersion: 1, userId: null,
      dashboardTour: { status: 'completed', completedAt: '2024-01-01T00:00:00.000Z', skippedAt: null, seenRepoSteps: true },
      sessionHints: { dismissed: [] },
    }));
    // Explicitly show ended sessions so tests that stub ended sessions can find them
    localStorage.setItem('argus:settings', JSON.stringify({
      hideEndedSessions: false,
      hideReposWithNoActiveSessions: false,
      hideInactiveSessions: false,
      outputDisplayMode: 'focused',
      restingThresholdMinutes: 20,
    }));
  });
  await page.route('**/api/v1/repositories', route =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify([REPO]) })
  );
  await page.route('**/api/v1/sessions**', route =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify([makeSession(sessionOverrides)]) })
  );
  await page.route(`**/api/v1/sessions/${SESSION_ID}/output**`, route =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ items: outputItems, nextBefore: null, total: outputItems.length }),
    })
  );
  await page.route('**/api/v1/argus/settings', route =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ port: 7411, yoloMode: false }) })
  );
  // Use routeWebSocket to intercept the WS connection instead of aborting the HTTP upgrade.
  // Tests that need to deliver events pass a wsHandler; others get a silent mock connection.
  await page.routeWebSocket('**/ws', wsHandler ?? (() => {}));
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('SC-028: AI Choice Alert (mocked API)', () => {

  test('session card shows ATTENTION NEEDED when output has a pending ask_user tool_use', async ({ page }) => {
    let sendPendingChoice!: () => void;
    await stubDashboard(page, {}, [], ws => {
      sendPendingChoice = () => ws.send(makePendingChoiceMessage('Which option?', ['Alpha', 'Beta']));
    });
    await page.goto('/');
    // Wait for the session card to render before sending the WS event, ensuring
    // initSocketHandlers has been called and the session.pending_choice handler is registered.
    await expect(page.getByText('session summary')).toBeVisible({ timeout: 5000 });
    sendPendingChoice();
    await expect(page.getByText('ATTENTION NEEDED')).toBeVisible({ timeout: 5000 });
  });

  test('question text appears alongside ATTENTION NEEDED', async ({ page }) => {
    let sendPendingChoice!: () => void;
    await stubDashboard(page, {}, [], ws => {
      sendPendingChoice = () => ws.send(makePendingChoiceMessage('Which option?', ['Alpha', 'Beta']));
    });
    await page.goto('/');
    await expect(page.getByText('session summary')).toBeVisible({ timeout: 5000 });
    sendPendingChoice();
    const alert = page.getByRole('alert');
    await expect(alert).toBeVisible({ timeout: 5000 });
    await expect(alert).toContainText('Which option?');
  });

  test('labelled choices appear alongside ATTENTION NEEDED', async ({ page }) => {
    let sendPendingChoice!: () => void;
    await stubDashboard(page, {}, [], ws => {
      sendPendingChoice = () => ws.send(makePendingChoiceMessage('Pick one', ['Alpha', 'Beta']));
    });
    await page.goto('/');
    await expect(page.getByText('session summary')).toBeVisible({ timeout: 5000 });
    sendPendingChoice();
    const alert = page.getByRole('alert');
    await expect(alert).toBeVisible({ timeout: 5000 });
    await expect(alert).toContainText('1. Alpha');
    await expect(alert).toContainText('2. Beta');
  });

  test('session card shows normal summary when ask_user has been answered (tool_result present)', async ({ page }) => {
    const content = JSON.stringify({ question: 'Pick one', choices: ['Alpha', 'Beta'] });
    await stubDashboard(page, { summary: 'Normal session summary' }, [
      makeOutput({ type: 'tool_use', toolName: 'ask_user', toolCallId: 'tc-2', content, sequenceNumber: 3 }),
      makeOutput({ id: 'out-2', type: 'tool_result', toolCallId: 'tc-2', content: 'Alpha', sequenceNumber: 4 }),
    ]);
    await page.goto('/');
    await expect(page.getByText('Normal session summary')).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('alert')).not.toBeVisible();
  });

  test('ended session does not show ATTENTION NEEDED even with pending tool_use in output', async ({ page }) => {
    const content = JSON.stringify({ question: 'Pick?', choices: ['A'] });
    await stubDashboard(page, { status: 'ended', summary: 'Ended session' }, [
      makeOutput({ type: 'tool_use', toolName: 'ask_user', toolCallId: 'tc-3', content, sequenceNumber: 1 }),
    ]);
    await page.goto('/');
    await expect(page.getByText('Ended session')).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('alert')).not.toBeVisible();
  });

});

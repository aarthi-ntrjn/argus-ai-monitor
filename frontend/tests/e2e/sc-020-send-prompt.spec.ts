import { test, expect } from '@playwright/test';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const SESSION_ID = 'test-session-020-send';

const PTY_SESSION = {
  id: SESSION_ID,
  repositoryId: 'repo-1',
  type: 'claude-code',
  launchMode: 'pty',
  pid: 5678,
  status: 'active',
  startedAt: new Date().toISOString(),
  endedAt: null,
  lastActivityAt: new Date().toISOString(),
  summary: 'Helping with tests',
  expiresAt: null,
  model: 'claude-opus-4-6',
};

const DETECTED_SESSION = {
  ...PTY_SESSION,
  id: 'test-session-020-detected',
  launchMode: 'detected',
  pid: null,
  summary: null,
  model: null,
};

const REPO = {
  id: 'repo-1',
  name: 'my-project',
  path: 'C:\\projects\\my-project',
  source: 'ui',
  addedAt: new Date().toISOString(),
  lastScannedAt: null,
  branch: 'main',
};

const EMPTY_OUTPUT = { items: [], nextBefore: null, total: 0 };

function stubSession(page: import('@playwright/test').Page, session: typeof PTY_SESSION) {
  return page.route(`**/api/v1/sessions/${session.id}`, route =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(session) })
  );
}

function stubOutput(page: import('@playwright/test').Page, sessionId: string) {
  return page.route(`**/api/v1/sessions/${sessionId}/output**`, route =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(EMPTY_OUTPUT) })
  );
}

async function mockDashboard(page: import('@playwright/test').Page, session: typeof PTY_SESSION) {
  await Promise.all([
    page.route('**/api/v1/repositories', route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify([REPO]) })
    ),
    page.route('**/api/v1/sessions**', route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify([session]) })
    ),
    stubOutput(page, session.id),
    page.route('**/ws**', route => route.abort()),
  ]);
}

// ── Mocked e2e tests ──────────────────────────────────────────────────────────

test.describe('SC-020: Send Prompt — PTY session (mocked API)', () => {

  test.beforeEach(async ({ page }) => {
    await stubOutput(page, SESSION_ID);
    await stubSession(page, PTY_SESSION);
  });

  test('prompt bar input is enabled for a PTY session', async ({ page }) => {
    await page.goto(`/sessions/${SESSION_ID}`);
    const input = page.getByPlaceholder('Send a prompt…');
    await expect(input).toBeVisible({ timeout: 5000 });
    await expect(input).toBeEnabled();
  });

  test('enter button (↵) is enabled for a PTY session once text is typed', async ({ page }) => {
    await page.goto(`/sessions/${SESSION_ID}`);
    const input = page.getByPlaceholder('Send a prompt…');
    await input.fill('do something');
    await expect(page.getByRole('button', { name: '↵' })).toBeEnabled();
  });

  test('clicking ↵ calls POST /sessions/:id/send with the prompt', async ({ page }) => {
    let sentPayload: { prompt?: string } | null = null;
    await page.route(`**/api/v1/sessions/${SESSION_ID}/send`, route => {
      sentPayload = route.request().postDataJSON();
      route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({ actionId: 'action-001', status: 'pending' }),
      });
    });

    await page.goto(`/sessions/${SESSION_ID}`);
    const input = page.getByPlaceholder('Send a prompt…');
    await input.fill('run the tests');
    await page.getByRole('button', { name: '↵' }).click();

    await expect(input).toHaveValue('', { timeout: 3000 });
    expect(sentPayload?.prompt).toBe('run the tests');
  });

  test('pressing Enter in the input submits the prompt', async ({ page }) => {
    let called = false;
    await page.route(`**/api/v1/sessions/${SESSION_ID}/send`, route => {
      called = true;
      route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({ actionId: 'action-002', status: 'pending' }),
      });
    });

    await page.goto(`/sessions/${SESSION_ID}`);
    await page.getByPlaceholder('Send a prompt…').fill('hello');
    await page.keyboard.press('Enter');

    await expect(page.getByPlaceholder('Send a prompt…')).toHaveValue('', { timeout: 3000 });
    expect(called).toBe(true);
  });

  test('error message is shown when send API returns an error', async ({ page }) => {
    await page.route(`**/api/v1/sessions/${SESSION_ID}/send`, route =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'INTERNAL_ERROR', message: 'Server exploded', requestId: 'r1' }),
      })
    );

    await page.goto(`/sessions/${SESSION_ID}`);
    await page.getByPlaceholder('Send a prompt…').fill('hello');
    await page.getByRole('button', { name: '↵' }).click();

    await expect(page.getByText(/server exploded/i)).toBeVisible({ timeout: 3000 });
  });
});

test.describe('SC-020: Send Prompt — PTY session dashboard actions (mocked API)', () => {

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('argus:onboarding', JSON.stringify({
        schemaVersion: 1, userId: null,
        dashboardTour: { status: 'completed', completedAt: '2024-01-01T00:00:00.000Z', skippedAt: null, seenRepoSteps: true },
        sessionHints: { dismissed: [] },
      }));
    });
    await mockDashboard(page, PTY_SESSION);
  });

  test('"connected" badge is shown for PTY sessions', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('connected')).toBeVisible({ timeout: 5000 });
  });

  // Skipped: quick-action menu (Merge/Pull latest) is not yet implemented in the UI
  test.skip('Merge quick command calls send with the correct prompt text', async ({ page }) => {
    let sentPrompt = '';
    await page.route(`**/api/v1/sessions/${SESSION_ID}/send`, route => {
      sentPrompt = (route.request().postDataJSON() as { prompt: string }).prompt;
      route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ actionId: 'a3', status: 'pending' }) });
    });

    await page.goto('/');
    await expect(page.getByText('Helping with tests')).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: /session actions menu/i }).click();
    await page.getByRole('button', { name: 'Merge' }).click();
    await page.getByRole('button', { name: 'Confirm' }).click();

    await expect(page.getByRole('button', { name: 'Confirm' })).not.toBeVisible({ timeout: 3000 });
    expect(sentPrompt).toBe('merge current branch with main');
  });

  // Skipped: quick-action menu (Merge/Pull latest) is not yet implemented in the UI
  test.skip('Pull latest quick command calls send with the correct prompt text', async ({ page }) => {
    let sentPrompt = '';
    await page.route(`**/api/v1/sessions/${SESSION_ID}/send`, route => {
      sentPrompt = (route.request().postDataJSON() as { prompt: string }).prompt;
      route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ actionId: 'a4', status: 'pending' }) });
    });

    await page.goto('/');
    await expect(page.getByText('Helping with tests')).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: /session actions menu/i }).click();
    await page.getByRole('button', { name: 'Pull latest' }).click();
    await page.getByRole('button', { name: 'Confirm' }).click();

    await expect(page.getByRole('button', { name: 'Confirm' })).not.toBeVisible({ timeout: 3000 });
    expect(sentPrompt).toBe('pull latest changes from main branch');
  });
});

test.describe('SC-020: Send Prompt — detected (read-only) session (mocked API)', () => {

  test.beforeEach(async ({ page }) => {
    await stubOutput(page, DETECTED_SESSION.id);
    await stubSession(page, DETECTED_SESSION as typeof PTY_SESSION);
  });

  test('prompt bar input is not shown for a detected session', async ({ page }) => {
    await page.goto(`/sessions/${DETECTED_SESSION.id}`);
    await expect(page.getByPlaceholder('Send a prompt…')).not.toBeVisible({ timeout: 5000 });
  });

  test('enter button (↵) is not shown for a detected session', async ({ page }) => {
    await page.goto(`/sessions/${DETECTED_SESSION.id}`);
    await expect(page.getByRole('button', { name: '↵' })).not.toBeVisible({ timeout: 5000 });
  });

  test('"read-only" badge is shown for detected sessions', async ({ page }) => {
    await page.goto(`/sessions/${DETECTED_SESSION.id}`);
    await expect(page.getByText('read-only')).toBeVisible({ timeout: 5000 });
  });

  test('tooltip explains how to enable prompts', async ({ page }) => {
    await page.goto(`/sessions/${DETECTED_SESSION.id}`);
    const tooltip = page.locator('[title*="argus launch"]');
    await expect(tooltip).toBeVisible({ timeout: 5000 });
  });

  test('does not call send API even if Enter is pressed while disabled', async ({ page }) => {
    let called = false;
    await page.route(`**/api/v1/sessions/${DETECTED_SESSION.id}/send`, () => { called = true; });

    await page.goto(`/sessions/${DETECTED_SESSION.id}`);
    // Attempt to press Enter — no input is focused so nothing should fire
    await page.keyboard.press('Enter');
    expect(called).toBe(false);
  });
});

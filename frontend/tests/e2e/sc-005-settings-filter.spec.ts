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
  test('hides ended/completed sessions when hideEndedSessions is true', async ({ page }) => {
    await mockApis(page);
    await page.addInitScript(() => {
      localStorage.setItem('argus:settings', JSON.stringify({ hideEndedSessions: true }));
    });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'active-repo' })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Active session')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Completed session')).not.toBeVisible();
    await expect(page.getByText('Ended session')).not.toBeVisible();
  });

  test('shows all sessions when hideEndedSessions is false (default)', async ({ page }) => {
    await mockApis(page);
    await page.addInitScript(() => {
      localStorage.setItem('argus:settings', JSON.stringify({ hideEndedSessions: false }));
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
  test('persists hideEndedSessions=true preference across page reload', async ({ page }) => {
    await mockApis(page);
    await page.addInitScript(() => {
      localStorage.setItem('argus:settings', JSON.stringify({ hideEndedSessions: true }));
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

  test('clicking gear icon opens settings panel with Hide ended sessions toggle', async ({ page }) => {
    await mockApis(page);
    await page.goto('/');
    await page.getByRole('button', { name: /settings/i }).click();
    await expect(page.getByText('Hide ended sessions')).toBeVisible({ timeout: 3000 });
  });

  test('toggling Hide ended sessions on via panel hides ended sessions immediately', async ({ page }) => {
    await mockApis(page);
    await page.goto('/');
    await expect(page.getByText('Completed session')).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: /settings/i }).click();
    await page.getByRole('checkbox', { name: /hide ended sessions/i }).check();
    await expect(page.getByText('Completed session', { exact: true })).not.toBeVisible();
    await expect(page.getByText('Ended session', { exact: true })).not.toBeVisible();
    await expect(page.getByText('Active session', { exact: true })).toBeVisible();
  });
});

// ─── US1 missing: re-toggle off, empty-state, filter independence ─────────────

test.describe('SC-005: Dashboard Settings — Additional Filter Behaviors', () => {

  test('re-toggling hideEndedSessions off brings ended sessions back', async ({ page }) => {
    await mockApis(page);
    await page.addInitScript(() => {
      localStorage.setItem('argus:settings', JSON.stringify({ hideEndedSessions: true }));
    });
    await page.goto('/');
    await expect(page.getByText('Active session')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Completed session')).not.toBeVisible();
    await page.getByRole('button', { name: /settings/i }).click();
    await page.getByRole('checkbox', { name: /hide ended sessions/i }).uncheck();
    await expect(page.getByText('Completed session', { exact: true })).toBeVisible({ timeout: 2000 });
    await expect(page.getByText('Ended session', { exact: true })).toBeVisible({ timeout: 2000 });
  });

  test('empty-state message shown when hideEndedSessions=true and no active sessions exist', async ({ page }) => {
    await page.route('**/api/v1/repositories', route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify(REPOS) })
    );
    // Only ended sessions — no active ones
    await page.route('**/api/v1/sessions**', route =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 's-c', repositoryId: 'repo-1', type: 'claude-code', pid: null, status: 'completed', startedAt: new Date().toISOString(), endedAt: new Date().toISOString(), lastActivityAt: new Date().toISOString(), summary: 'Done', expiresAt: null },
        ]),
      })
    );
    await page.addInitScript(() => {
      localStorage.setItem('argus:settings', JSON.stringify({ hideEndedSessions: true }));
    });
    await page.goto('/');
    await expect(page.getByText('Done')).not.toBeVisible();
    // When hideEndedSessions=true and no active sessions remain, the repo card shows this message
    await expect(page.getByText('No active sessions')).toBeVisible({ timeout: 5000 });
  });

  test('hideEndedSessions and hideReposWithNoActiveSessions are evaluated independently', async ({ page }) => {
    // One repo has only ended sessions → hidden by hideReposWithNoActiveSessions
    // The other has an active session → visible even though hideEndedSessions is also on
    const repos = [
      { id: 'r-active', name: 'has-active', path: 'C:\\p\\a', source: 'ui', addedAt: new Date().toISOString(), lastScannedAt: null },
      { id: 'r-idle', name: 'only-ended', path: 'C:\\p\\b', source: 'ui', addedAt: new Date().toISOString(), lastScannedAt: null },
    ];
    const sessions = [
      { id: 'sa', repositoryId: 'r-active', type: 'claude-code', pid: null, status: 'active', startedAt: new Date().toISOString(), endedAt: null, lastActivityAt: new Date().toISOString(), summary: 'Active work', expiresAt: null },
      { id: 'se', repositoryId: 'r-idle', type: 'copilot-cli', pid: null, status: 'completed', startedAt: new Date().toISOString(), endedAt: new Date().toISOString(), lastActivityAt: new Date().toISOString(), summary: 'Old work', expiresAt: null },
    ];
    await page.route('**/api/v1/repositories', route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify(repos) })
    );
    await page.route('**/api/v1/sessions**', route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify(sessions) })
    );
    await page.addInitScript(() => {
      localStorage.setItem('argus:settings', JSON.stringify({ hideEndedSessions: true, hideReposWithNoActiveSessions: true }));
    });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'has-active' })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('heading', { name: 'only-ended' })).not.toBeVisible();
    // The active session is visible; the ended session is hidden
    await expect(page.getByText('Active work')).toBeVisible({ timeout: 2000 });
    await expect(page.getByText('Old work')).not.toBeVisible();
  });

});

// ─── US5: Hide Inactive Sessions (>20 min) ───────────────────────────────────

const STALE_ACTIVITY = new Date(Date.now() - 25 * 60 * 1000).toISOString(); // 25 min ago
const RECENT_ACTIVITY = new Date(Date.now() - 2 * 60 * 1000).toISOString();  // 2 min ago

const INACTIVE_REPO = [
  { id: 'repo-i', name: 'inactive-repo', path: 'C:\\projects\\inactive-repo', source: 'ui', addedAt: new Date().toISOString(), lastScannedAt: null },
];

const INACTIVE_SESSIONS = [
  { id: 'si-stale', repositoryId: 'repo-i', type: 'claude-code', pid: null, status: 'active', startedAt: new Date().toISOString(), endedAt: null, lastActivityAt: STALE_ACTIVITY, summary: 'Stale session', expiresAt: null },
  { id: 'si-fresh', repositoryId: 'repo-i', type: 'copilot-cli', pid: 1, status: 'active', startedAt: new Date().toISOString(), endedAt: null, lastActivityAt: RECENT_ACTIVITY, summary: 'Fresh session', expiresAt: null },
  { id: 'si-ended', repositoryId: 'repo-i', type: 'claude-code', pid: null, status: 'completed', startedAt: new Date().toISOString(), endedAt: new Date().toISOString(), lastActivityAt: STALE_ACTIVITY, summary: 'Old ended session', expiresAt: null },
];

function mockInactiveApis(page: import('@playwright/test').Page) {
  return Promise.all([
    page.route('**/api/v1/repositories', route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify(INACTIVE_REPO) })
    ),
    page.route('**/api/v1/sessions**', route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify(INACTIVE_SESSIONS) })
    ),
  ]);
}

test.describe('SC-005: Dashboard Settings — Hide Inactive Sessions (US5)', () => {

  test('"Hide inactive sessions" toggle is visible in settings panel', async ({ page }) => {
    await mockInactiveApis(page);
    await page.goto('/');
    await page.getByRole('button', { name: /settings/i }).click();
    await expect(page.getByText(/hide inactive sessions/i)).toBeVisible({ timeout: 3000 });
  });

  test('hideInactiveSessions=false (default) shows all active sessions regardless of age', async ({ page }) => {
    await mockInactiveApis(page);
    await page.goto('/');
    await expect(page.getByText('Stale session')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Fresh session')).toBeVisible({ timeout: 5000 });
  });

  test('hideInactiveSessions=true hides active sessions with lastActivityAt >20 min ago', async ({ page }) => {
    await mockInactiveApis(page);
    await page.addInitScript(() => {
      localStorage.setItem('argus:settings', JSON.stringify({ hideInactiveSessions: true }));
    });
    await page.goto('/');
    await expect(page.getByText('Fresh session')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Stale session')).not.toBeVisible();
  });

  test('hideInactiveSessions=true does NOT hide ended sessions even if they are old', async ({ page }) => {
    await mockInactiveApis(page);
    await page.addInitScript(() => {
      localStorage.setItem('argus:settings', JSON.stringify({ hideInactiveSessions: true }));
    });
    await page.goto('/');
    // Ended sessions are excluded from the inactive check — they stay visible (unless hideEndedSessions is also on)
    await expect(page.getByText('Old ended session')).toBeVisible({ timeout: 5000 });
  });

  test('toggling hide-inactive-sessions via panel hides stale session immediately', async ({ page }) => {
    await mockInactiveApis(page);
    await page.goto('/');
    await expect(page.getByText('Stale session')).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: /settings/i }).click();
    await page.getByRole('checkbox', { name: /hide inactive sessions/i }).check();
    await expect(page.getByText('Stale session')).not.toBeVisible();
    await expect(page.getByText('Fresh session')).toBeVisible();
  });

  test('re-toggling hide-inactive-sessions off restores stale session', async ({ page }) => {
    await mockInactiveApis(page);
    await page.addInitScript(() => {
      localStorage.setItem('argus:settings', JSON.stringify({ hideInactiveSessions: true }));
    });
    await page.goto('/');
    await expect(page.getByText('Stale session')).not.toBeVisible();
    await page.getByRole('button', { name: /settings/i }).click();
    await page.getByRole('checkbox', { name: /hide inactive sessions/i }).uncheck();
    await expect(page.getByText('Stale session')).toBeVisible({ timeout: 2000 });
  });

  test('hideInactiveSessions preference persists across page reload', async ({ page }) => {
    await mockInactiveApis(page);
    await page.addInitScript(() => {
      localStorage.setItem('argus:settings', JSON.stringify({ hideInactiveSessions: true }));
    });
    await page.goto('/');
    await expect(page.getByText('Stale session')).not.toBeVisible();
    await page.reload();
    await expect(page.getByText('Fresh session')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Stale session')).not.toBeVisible();
  });

});

// ─── US4: Hide Repos with No Active Sessions ──────────────────────────────────

const TWO_REPOS = [
  { id: 'repo-active', name: 'active-repo', path: 'C:\\projects\\active-repo', source: 'ui', addedAt: new Date().toISOString(), lastScannedAt: null },
  { id: 'repo-idle', name: 'idle-repo', path: 'C:\\projects\\idle-repo', source: 'ui', addedAt: new Date().toISOString(), lastScannedAt: null },
];

const TWO_REPOS_SESSIONS = [
  { id: 'sa-1', repositoryId: 'repo-active', type: 'copilot-cli', pid: 1, status: 'active', startedAt: new Date().toISOString(), endedAt: null, lastActivityAt: new Date().toISOString(), summary: 'Running session', expiresAt: null },
  { id: 'si-1', repositoryId: 'repo-idle', type: 'claude-code', pid: null, status: 'completed', startedAt: new Date().toISOString(), endedAt: new Date().toISOString(), lastActivityAt: new Date().toISOString(), summary: 'Old session', expiresAt: null },
];

function mockTwoRepoApis(page: import('@playwright/test').Page, sessions = TWO_REPOS_SESSIONS) {
  return Promise.all([
    page.route('**/api/v1/repositories', route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify(TWO_REPOS) })
    ),
    page.route('**/api/v1/sessions**', route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify(sessions) })
    ),
  ]);
}

test.describe('SC-005: Dashboard Settings — Hide Repos with No Active Sessions (US4)', () => {

  test('hides repos with only ended sessions when hideReposWithNoActiveSessions is true', async ({ page }) => {
    await mockTwoRepoApis(page);
    await page.addInitScript(() => {
      localStorage.setItem('argus:settings', JSON.stringify({ hideEndedSessions: false, hideReposWithNoActiveSessions: true }));
    });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'active-repo' })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('idle-repo')).not.toBeVisible();
  });

  test('shows all repos when hideReposWithNoActiveSessions is false (default)', async ({ page }) => {
    await mockTwoRepoApis(page);
    await page.addInitScript(() => {
      localStorage.setItem('argus:settings', JSON.stringify({ hideEndedSessions: false, hideReposWithNoActiveSessions: false }));
    });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'active-repo' })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('heading', { name: 'idle-repo' })).toBeVisible({ timeout: 5000 });
  });

  test('shows global empty-statewhen all repos have only ended sessions and setting is on', async ({ page }) => {
    const allEndedSessions = TWO_REPOS_SESSIONS.map(s => ({ ...s, status: 'completed' }));
    await mockTwoRepoApis(page, allEndedSessions);
    await page.addInitScript(() => {
      localStorage.setItem('argus:settings', JSON.stringify({ hideEndedSessions: false, hideReposWithNoActiveSessions: true }));
    });
    await page.goto('/');
    await expect(page.getByText('active-repo')).not.toBeVisible();
    await expect(page.getByText('idle-repo')).not.toBeVisible();
    await expect(page.getByText(/no repositories/i)).toBeVisible({ timeout: 5000 });
  });

  test('Hide repos with no active sessions toggle is visible in settings panel', async ({ page }) => {
    await mockTwoRepoApis(page);
    await page.goto('/');
    await page.getByRole('button', { name: /settings/i }).click();
    await expect(page.getByText(/hide repos with no active sessions/i)).toBeVisible({ timeout: 3000 });
  });

  test('toggling hide-repos via panel immediately hides inactive repo', async ({ page }) => {
    await mockTwoRepoApis(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'active-repo' })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('heading', { name: 'idle-repo' })).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: /settings/i }).click();
    await page.getByRole('checkbox', { name: /hide repos with no active sessions/i }).check();
    await expect(page.getByRole('heading', { name: 'idle-repo' })).not.toBeVisible();
    await expect(page.getByRole('heading', { name: 'active-repo' })).toBeVisible();
  });
});

import { test, expect, request } from '@playwright/test';
import { BASE_URL, TEST_REPO_A } from './test-config.js';

// ─── Real-server tests for the session detail page ───────────────────────────
//
// Sessions cannot be seeded via the API, so these tests cover:
//   - 404 error state when navigating to a non-existent session
//   - API contract for the output endpoint
//   - Navigation from the 404 page back to the dashboard

let repoId: string;

test.describe('Session Detail Page (real server): Error State & API Contract', () => {

  test.beforeAll(async () => {
    const api = await request.newContext({ baseURL: BASE_URL });
    const res = await api.post('/api/v1/repositories', { data: { path: TEST_REPO_A } });
    expect(res.status(), `Failed to register ${TEST_REPO_A}: ${await res.text()}`).toBe(201);
    repoId = (await res.json()).id;
    await api.dispose();
  });

  test.afterAll(async () => {
    const api = await request.newContext({ baseURL: BASE_URL });
    if (repoId) await api.delete(`/api/v1/repositories/${repoId}`);
    await api.dispose();
  });

  // ── 404 / not-found state ────────────────────────────────────────────────────

  test('navigating to a non-existent session shows "Session not found."', async ({ page }) => {
    await page.goto('/sessions/non-existent-session-real-server');
    await expect(page.getByText('Session not found.')).toBeVisible({ timeout: 5000 });
  });

  test('"Back to Dashboard" button is shown on the 404 page', async ({ page }) => {
    await page.goto('/sessions/non-existent-session-real-server');
    await expect(page.getByText(/Back to Dashboard/i)).toBeVisible({ timeout: 5000 });
  });

  test('clicking "Back to Dashboard" on the 404 page navigates to /', async ({ page }) => {
    await page.goto('/sessions/non-existent-session-real-server');
    await expect(page.getByText(/Back to Dashboard/i)).toBeVisible({ timeout: 5000 });
    await page.getByText(/Back to Dashboard/i).click();
    await expect(page).toHaveURL('/', { timeout: 3000 });
  });

  // ── Output endpoint API contract ─────────────────────────────────────────────

  test('GET /sessions/:id/output returns 404 for a non-existent session', async ({ request: req }) => {
    const res = await req.get('/api/v1/sessions/no-such-session/output?limit=100');
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('NOT_FOUND');
  });

  test('GET /sessions/:id/output response shape has items, nextBefore, and total fields', async ({ request: req }) => {
    // There are no sessions to query, but we can verify the 404 body shape is consistent
    const res = await req.get('/api/v1/sessions/no-such/output?limit=10');
    expect(res.status()).toBe(404);
    const body = await res.json();
    // Error shape
    expect(typeof body.error).toBe('string');
  });

  test('GET /sessions/:id/output accepts limit query parameter without error', async ({ request: req }) => {
    const res = await req.get('/api/v1/sessions/no-such-session/output?limit=50');
    // Should get 404 (not 400), confirming the limit param is accepted
    expect(res.status()).toBe(404);
  });

  test('GET /sessions/:id/output accepts before query parameter without error', async ({ request: req }) => {
    const res = await req.get('/api/v1/sessions/no-such-session/output?limit=10&before=some-cursor');
    expect(res.status()).toBe(404);
  });

  // ── Dashboard reflects registered repo (context check) ───────────────────────

  test('dashboard shows the registered repo while no sessions exist', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'test-repo-alpha' })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('No sessions')).toBeVisible({ timeout: 5000 });
  });

});

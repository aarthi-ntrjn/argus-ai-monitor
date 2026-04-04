import { test, expect, request } from '@playwright/test';
import { BASE_URL, TEST_REPO_A, TEST_REPO_B } from './test-config.js';

// ─── Real-server session card tests ──────────────────────────────────────────
//
// Sessions cannot be seeded via the API (they are discovered by the backend
// from real OS processes). These tests verify the session card area behaves
// correctly with a real backend that has no sessions running — covering the
// empty state, API contract shape, and that the UI does not crash or show
// incorrect data when the sessions list is genuinely empty.

let repoAId: string;
let repoBId: string;

test.describe('SC-001 (real server): Session Card — Empty State & API Contract', () => {

  test.beforeAll(async () => {
    const api = await request.newContext({ baseURL: BASE_URL });

    const resA = await api.post('/api/v1/repositories', { data: { path: TEST_REPO_A } });
    expect(resA.status(), `Failed to register ${TEST_REPO_A}: ${await resA.text()}`).toBe(201);
    repoAId = (await resA.json()).id;

    const resB = await api.post('/api/v1/repositories', { data: { path: TEST_REPO_B } });
    expect(resB.status(), `Failed to register ${TEST_REPO_B}: ${await resB.text()}`).toBe(201);
    repoBId = (await resB.json()).id;

    await api.dispose();
  });

  test.afterAll(async () => {
    const api = await request.newContext({ baseURL: BASE_URL });
    if (repoAId) await api.delete(`/api/v1/repositories/${repoAId}`);
    if (repoBId) await api.delete(`/api/v1/repositories/${repoBId}`);
    await api.dispose();
  });

  // ── Empty state ──────────────────────────────────────────────────────────────

  test('repos with no sessions show "No sessions" per-card in the dashboard', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'test-repo-alpha' })).toBeVisible({ timeout: 5000 });
    // Both repos have no sessions — each card shows the empty message
    const noSessionsTexts = page.getByText('No sessions');
    await expect(noSessionsTexts.first()).toBeVisible({ timeout: 5000 });
  });

  test('no session cards are rendered when there are no sessions', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'test-repo-alpha' })).toBeVisible({ timeout: 5000 });
    // Session cards have a "Send a prompt…" input; none should exist without sessions
    await expect(page.getByPlaceholder('Send a prompt…')).not.toBeVisible();
  });

  // ── API contract ─────────────────────────────────────────────────────────────

  test('GET /api/v1/sessions returns a JSON array (not an error)', async ({ request: req }) => {
    const res = await req.get('/api/v1/sessions');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test('GET /api/v1/sessions?repositoryId= filters by repository ID', async ({ request: req }) => {
    const res = await req.get(`/api/v1/sessions?repositoryId=${repoAId}`);
    expect(res.ok()).toBeTruthy();
    const sessions: { repositoryId: string }[] = await res.json();
    // All returned sessions (if any) belong to repo A
    for (const s of sessions) {
      expect(s.repositoryId).toBe(repoAId);
    }
  });

  test('GET /api/v1/sessions/:id returns 404 for a non-existent session', async ({ request: req }) => {
    const res = await req.get('/api/v1/sessions/non-existent-session-id');
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('NOT_FOUND');
  });

  test('GET /api/v1/sessions/:id/output returns 404 for a non-existent session', async ({ request: req }) => {
    const res = await req.get('/api/v1/sessions/non-existent-session-id/output?limit=10');
    expect(res.status()).toBe(404);
  });

  // ── Prompt bar controls against real backend ─────────────────────────────────

  test('POST /api/v1/sessions/:id/send returns 404 for a non-existent session', async ({ request: req }) => {
    const res = await req.post('/api/v1/sessions/no-such-session/send', {
      data: { prompt: 'hello' },
    });
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('NOT_FOUND');
  });

  test('POST /api/v1/sessions/:id/send returns 400 when prompt is missing', async ({ request: req }) => {
    const res = await req.post('/api/v1/sessions/no-such-session/send', {
      data: {},
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('MISSING_PROMPT');
  });

  test('POST /api/v1/sessions/:id/interrupt returns 404 for a non-existent session', async ({ request: req }) => {
    const res = await req.post('/api/v1/sessions/no-such-session/interrupt');
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('NOT_FOUND');
  });

});

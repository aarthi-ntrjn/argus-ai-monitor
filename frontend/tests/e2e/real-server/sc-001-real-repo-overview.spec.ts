import { test, expect, request } from '@playwright/test';
import { BASE_URL, TEST_REPO_A, TEST_REPO_B } from './test-config.js';

let repoAId: string;
let repoBId: string;

test.describe('SC-001 (real server): Repository Overview', () => {
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

  test('GET /api/v1/repositories returns exactly the two seeded repos', async ({ request: req }) => {
    const res = await req.get('/api/v1/repositories');
    expect(res.ok()).toBeTruthy();
    const repos: { id: string }[] = await res.json();
    const ids = repos.map((r) => r.id);
    expect(ids).toContain(repoAId);
    expect(ids).toContain(repoBId);
    expect(repos).toHaveLength(2);
  });

  test('dashboard shows both repo names within 5s', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'test-repo-alpha' })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('heading', { name: 'test-repo-beta' })).toBeVisible({ timeout: 5000 });
  });
});

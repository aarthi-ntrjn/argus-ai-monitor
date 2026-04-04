---
description: Write or extend Playwright e2e tests for a success criterion, following the conventions of this codebase.
---

## User Input

```text
$ARGUMENTS
```

If `$ARGUMENTS` is empty, ask the user: "Which success criterion (e.g. SC-007) or feature do you want e2e tests for?"

---

## Your Role

You are a senior QA engineer writing Playwright e2e tests for **Argus** — a frontend app at `http://localhost:7411` backed by a REST + WebSocket API. Your tests must be precise, maintainable, and grounded in what the UI actually renders.

---

## Step 1 — Understand What to Test

1. Read the relevant spec: `specs/*/spec.md`. Find the success criteria (SC-###) mentioned in `$ARGUMENTS`.
2. Read the relevant source components under `frontend/src/` to understand:
   - Which API endpoints the component calls (`/api/v1/...`)
   - What the component renders (role, label, text, placeholder attributes)
   - What user actions trigger what API calls
3. Read existing test files under `frontend/tests/e2e/` to understand conventions before writing anything new.

---

## Step 2 — Always Write Both Tiers

**Every feature must have tests in both tiers.** Do not write only one.

### Tier 1 — Mock-based
- File location: `frontend/tests/e2e/sc-###-<slug>.spec.ts`
- Covered by `playwright.config.ts` (run with `npm run test:e2e`)
- Use `page.route('**/api/v1/...')` to intercept HTTP calls
- Never start a real server; never call the real backend
- Fast, deterministic, run in CI
- **Covers**: happy path, all status/state variants, edge cases, interaction flows, error states

### Tier 2 — Real-server
- File location: `frontend/tests/e2e/real-server/sc-###-real-<slug>.spec.ts`
- Covered by `playwright.real.config.ts` (run with `npm run test:e2e:real`)
- Use `request.newContext()` in `beforeAll` to seed real data; clean up in `afterAll`
- Use `test-config.ts` constants (`BASE_URL`, `TEST_REPO_A`, `TEST_REPO_B`) — never hardcode paths
- **Covers**: API contract shape, persistence across real reload, empty-state against real backend, 404/error responses, anything requiring real process state (WebSocket, etc.)

**What to test in the real-server tier when sessions can't be seeded** (sessions are discovered from OS processes, not via API):
- Empty state UI (repos with no sessions → "No sessions" message)
- API contract: verify endpoints return correct shape and status codes (200/404/400/501)
- Settings persistence across real `page.reload()`
- Corruption/fallback behavior against real backend data

---

## Step 3 — Write the Tests

### File naming
```
sc-###-<kebab-case-description>.spec.ts
```

### Structure template (Tier 1)

```typescript
import { test, expect } from '@playwright/test';

// ── Fixtures ──────────────────────────────────────────────────────────────────
// Declare all mock data as top-level constants so tests are readable at a glance.

const REPOS = [ /* minimal shape */ ];
const SESSIONS = [ /* minimal shape */ ];

async function mockApis(page: import('@playwright/test').Page) {
  await Promise.all([
    page.route('**/api/v1/repositories', route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify(REPOS) })
    ),
    page.route('**/api/v1/sessions**', route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify(SESSIONS) })
    ),
    // add per-test routes inside the test itself when they vary
  ]);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('SC-###: <Success Criterion Title>', () => {

  test('US#: <user-visible behaviour being verified>', async ({ page }) => {
    await mockApis(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'my-project' })).toBeVisible({ timeout: 5000 });
    // ... assertions
  });

});
```

### Structure template (Tier 2)

```typescript
import { test, expect, request } from '@playwright/test';
import { BASE_URL, TEST_REPO_A } from './test-config.js';

let repoId: string;

test.describe('SC-### (real server): <Title>', () => {

  test.beforeAll(async () => {
    const api = await request.newContext({ baseURL: BASE_URL });
    const res = await api.post('/api/v1/repositories', { data: { path: TEST_REPO_A } });
    expect(res.status(), `Seed failed: ${await res.text()}`).toBe(201);
    repoId = (await res.json()).id;
    await api.dispose();
  });

  test.afterAll(async () => {
    const api = await request.newContext({ baseURL: BASE_URL });
    if (repoId) await api.delete(`/api/v1/repositories/${repoId}`);
    await api.dispose();
  });

  test('<what is verified>', async ({ page, request: req }) => {
    // ...
  });

});
```

---

## Rules — Non-Negotiable

**Selectors**
- Prefer role + accessible name: `getByRole('button', { name: /stop/i })`
- Use `getByText()` for user-visible content
- Use `getByPlaceholder()` for inputs
- Use `getByLabel()` for labelled regions
- Avoid `locator('.css-class')` or `locator('[data-testid=...]')` unless no semantic alternative exists

**Timing**
- First `toBeVisible()` after navigation: `{ timeout: 5000 }`
- Subsequent assertions within the same loaded page: `{ timeout: 2000 }` or `{ timeout: 3000 }`
- Never use `page.waitForTimeout()` — use `toBeVisible` / `toHaveText` / `toHaveURL` instead

**Mock shapes**
- Match the actual API contract. Read the backend route handler or existing mocks to get the exact shape.
- Use `new Date().toISOString()` for timestamps; never hardcode date strings.
- Include `null` for optional fields (e.g. `pid: null`, `endedAt: null`, `expiresAt: null`).

**Coverage**
- Write one test per user-visible behaviour, not one test per component.
- Cover: happy path, empty state, error / loading state (if the UI shows one), key user interaction (click, keyboard).
- For state mutation (stop, delete, send prompt): mock the mutation endpoint and assert the UI reflects the new state.
- Don't test implementation details (internal state, class names, React component names).

**Mutation routes**
When a test needs to verify that a POST/DELETE/PATCH has an effect, use a closure to track state:
```typescript
let status = 'active';
await page.route('**/api/v1/sessions/*/stop', route => {
  status = 'ended';
  route.fulfill({ status: 202, body: JSON.stringify({ actionId: 'a1', status: 'completed' }) });
});
await page.route('**/api/v1/sessions/*', route =>
  route.fulfill({ body: JSON.stringify({ ...SESSION, status }) })
);
```

**WebSocket**
Playwright cannot intercept native WebSocket frames. If the SC requires WS verification, use a real-server test (Tier 2). For mock tests, verify the initial UI state only and add a comment: `// WS push verified in real-server tier`.

---

## Step 4 — Verify

Run the tests before declaring done:

```bash
# Tier 1
npm run test:e2e -- --grep "SC-###"

# Tier 2
npm run test:e2e:real -- --grep "SC-###"
```

All tests must pass (exit 0). Fix failures before proceeding.

---

## Step 5 — Report

Summarise:
- **SC covered**: which success criteria
- **Tests added**: file path + test names
- **Tier**: mock or real-server, and why
- **Edge cases covered**: empty state, error state, keyboard, etc.
- **Anything not covered**: with the reason (e.g. WS push → real-server tier needed)

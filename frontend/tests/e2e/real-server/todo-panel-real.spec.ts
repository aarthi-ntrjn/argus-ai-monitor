import { test, expect, request, BrowserContext } from '@playwright/test';
import { BASE_URL } from './test-config.js';

/**
 * Real-server E2E tests for the "To Tackle" todo panel.
 * These tests run against the actual backend (started by playwright.real.config.ts).
 * Each test cleans up after itself to avoid state leakage.
 */

/** Seeds localStorage to mark the onboarding tour as completed, preventing the overlay from blocking clicks. */
async function skipOnboarding(context: BrowserContext) {
  await context.addInitScript(() => {
    window.localStorage.setItem('argus:onboarding', JSON.stringify({
      schemaVersion: 1, userId: null,
      dashboardTour: { status: 'completed', completedAt: new Date().toISOString(), skippedAt: null },
      sessionHints: { dismissed: [] },
    }));
  });
}

async function createTodo(apiContext: Awaited<ReturnType<typeof request.newContext>>, text: string) {
  const res = await apiContext.post('/api/v1/todos', { data: { text } });
  expect(res.status(), `Failed to create todo "${text}": ${await res.text()}`).toBe(201);
  return (await res.json()) as { id: string; text: string; done: boolean; createdAt: string };
}

async function deleteTodo(apiContext: Awaited<ReturnType<typeof request.newContext>>, id: string) {
  await apiContext.delete(`/api/v1/todos/${id}`);
}

test.describe('To Tackle panel (real server)', () => {
  test.beforeEach(async ({ context }) => {
    await skipOnboarding(context);
  });

  test('add-task row is always visible on the dashboard', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('textbox', { name: /new task/i })).toBeVisible();
  });

  test('created todo persists across page reload', async ({ page }) => {
    const api = await request.newContext({ baseURL: BASE_URL });
    const todo = await createTodo(api, 'Persisted task E2E');

    try {
      await page.goto('/');
      await expect(page.getByRole('textbox', { name: /edit task: Persisted task E2E/i })).toBeVisible();

      await page.reload();
      await expect(page.getByRole('textbox', { name: /edit task: Persisted task E2E/i })).toBeVisible();
    } finally {
      await deleteTodo(api, todo.id);
      await api.dispose();
    }
  });

  test('typing in the add row and pressing Enter creates a new todo', async ({ page }) => {
    const api = await request.newContext({ baseURL: BASE_URL });
    let createdId: string | undefined;

    try {
      await page.goto('/');
      const addRow = page.getByRole('textbox', { name: /new task/i });
      await addRow.fill('E2E created task');
      await addRow.press('Enter');

      const savedInput = page.getByRole('textbox', { name: /edit task: E2E created task/i });
      await expect(savedInput).toBeVisible();

      // Verify it's stored in the database
      const res = await api.get('/api/v1/todos');
      const todos = await res.json() as { id: string; text: string }[];
      const created = todos.find(t => t.text === 'E2E created task');
      expect(created).toBeDefined();
      createdId = created!.id;
    } finally {
      if (createdId) await deleteTodo(api, createdId);
      await api.dispose();
    }
  });

  test('typing in the add row and blurring creates a new todo', async ({ page }) => {
    const api = await request.newContext({ baseURL: BASE_URL });
    let createdId: string | undefined;

    try {
      await page.goto('/');
      const addRow = page.getByRole('textbox', { name: /new task/i });
      await addRow.fill('E2E blur task');
      await addRow.press('Tab');

      await expect(page.getByRole('textbox', { name: /edit task: E2E blur task/i })).toBeVisible();

      const res = await api.get('/api/v1/todos');
      const todos = await res.json() as { id: string; text: string }[];
      const created = todos.find(t => t.text === 'E2E blur task');
      expect(created).toBeDefined();
      createdId = created!.id;
    } finally {
      if (createdId) await deleteTodo(api, createdId);
      await api.dispose();
    }
  });

  test('editing a todo text and blurring persists the update', async ({ page }) => {
    const api = await request.newContext({ baseURL: BASE_URL });
    const todo = await createTodo(api, 'Original E2E text');

    try {
      await page.goto('/');
      const input = page.getByRole('textbox', { name: /edit task: Original E2E text/i });
      await expect(input).toBeVisible();
      await input.fill('Updated E2E text');
      await input.press('Tab');

      await expect(page.getByRole('textbox', { name: /edit task: Updated E2E text/i })).toBeVisible();

      // Verify persisted
      const res = await api.get(`/api/v1/todos`);
      const todos = await res.json() as { id: string; text: string }[];
      const updated = todos.find(t => t.id === todo.id);
      expect(updated?.text).toBe('Updated E2E text');
    } finally {
      await deleteTodo(api, todo.id);
      await api.dispose();
    }
  });

  test('toggling a checkbox persists the done state', async ({ page }) => {
    const api = await request.newContext({ baseURL: BASE_URL });
    const todo = await createTodo(api, 'Toggle E2E task');

    try {
      await page.goto('/');
      const checkbox = page.getByRole('checkbox', { name: /mark "Toggle E2E task"/i });
      await checkbox.click();

      const input = page.getByRole('textbox', { name: /edit task: Toggle E2E task/i });
      await expect(input).toHaveClass(/line-through/);

      // Verify backend state
      const res = await api.get('/api/v1/todos');
      const todos = await res.json() as { id: string; done: boolean }[];
      const updated = todos.find(t => t.id === todo.id);
      expect(updated?.done).toBe(true);
    } finally {
      await deleteTodo(api, todo.id);
      await api.dispose();
    }
  });

  test('deleting via trash button removes the item from the database', async ({ page }) => {
    const api = await request.newContext({ baseURL: BASE_URL });
    const uniqueText = `Trash me E2E ${Date.now()}`;
    const todo = await createTodo(api, uniqueText);

    try {
      await page.goto('/');

      const textarea = page.getByRole('textbox', { name: new RegExp(`edit task: ${uniqueText}`, 'i') });
      await expect(textarea).toBeVisible();
      await textarea.hover();

      const trashBtn = page.getByRole('button', { name: new RegExp(`delete "${uniqueText}"`, 'i') });
      await expect(trashBtn).toBeVisible();
      await trashBtn.click();

      await expect(textarea).not.toBeVisible();

      // Verify removed from DB
      const res = await api.get('/api/v1/todos');
      const todos = await res.json() as { id: string }[];
      expect(todos.find(t => t.id === todo.id)).toBeUndefined();
    } finally {
      await api.dispose();
    }
  });

  test('deleting via Backspace on empty input removes the item', async ({ page }) => {
    const api = await request.newContext({ baseURL: BASE_URL });
    const todo = await createTodo(api, 'Backspace delete E2E');

    try {
      await page.goto('/');
      const input = page.getByRole('textbox', { name: /edit task: Backspace delete E2E/i });
      await input.fill('');
      await input.press('Backspace');

      await expect(page.getByRole('textbox', { name: /edit task: Backspace delete E2E/i })).not.toBeVisible();

      const res = await api.get('/api/v1/todos');
      const todos = await res.json() as { id: string }[];
      expect(todos.find(t => t.id === todo.id)).toBeUndefined();
    } finally {
      await api.dispose();
    }
  });

  test('newest todo appears first in the list', async ({ page }) => {
    const api = await request.newContext({ baseURL: BASE_URL });
    const older = await createTodo(api, 'E2E Older task');
    // Small delay to ensure different createdAt
    await new Promise(r => setTimeout(r, 50));
    const newer = await createTodo(api, 'E2E Newer task');

    try {
      await page.goto('/');

      const inputs = page.getByRole('textbox');
      // inputs[0] = add row, inputs[1] = newest, inputs[2] = older
      await expect(inputs.nth(1)).toHaveAttribute('aria-label', /edit task: E2E Newer task/i);
      await expect(inputs.nth(2)).toHaveAttribute('aria-label', /edit task: E2E Older task/i);
    } finally {
      await deleteTodo(api, older.id);
      await deleteTodo(api, newer.id);
      await api.dispose();
    }
  });

  test('hide completed toggle hides done items in the UI', async ({ page }) => {
    const api = await request.newContext({ baseURL: BASE_URL });
    const active = await createTodo(api, 'E2E Active task');
    const done = await createTodo(api, 'E2E Done task');
    // Mark it done
    await api.patch(`/api/v1/todos/${done.id}`, { data: { done: true } });

    try {
      await page.goto('/');
      await expect(page.getByRole('textbox', { name: /edit task: E2E Done task/i })).toBeVisible();

      await page.getByTitle('Hide completed').click();
      await expect(page.getByRole('textbox', { name: /edit task: E2E Done task/i })).not.toBeVisible();
      await expect(page.getByRole('textbox', { name: /edit task: E2E Active task/i })).toBeVisible();
    } finally {
      await deleteTodo(api, active.id);
      await deleteTodo(api, done.id);
      await api.dispose();
    }
  });
});

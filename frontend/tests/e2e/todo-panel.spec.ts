import { test, expect, BrowserContext } from '@playwright/test';

type TodoItem = {
  id: string;
  userId: string;
  text: string;
  done: boolean;
  createdAt: string;
  updatedAt: string;
};

function makeTodo(overrides: Partial<TodoItem> = {}): TodoItem {
  return {
    id: crypto.randomUUID(),
    userId: 'default',
    text: 'Task',
    done: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

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

/**
 * Registers route mocks for all API endpoints used by the dashboard.
 * - GET  /api/v1/todos          returns current todoList
 * - POST /api/v1/todos          appends to todoList, returns created item
 * - PATCH /api/v1/todos/:id     updates item in todoList, returns updated item
 * - DELETE /api/v1/todos/:id    removes item from todoList
 */
async function mockApis(
  page: import('@playwright/test').Page,
  initialTodos: TodoItem[] = [],
) {
  const todoList: TodoItem[] = [...initialTodos];

  await Promise.all([
    page.route('**/api/v1/repositories', route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify([]) })
    ),
    page.route('**/api/v1/sessions**', route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify([]) })
    ),
    // Specific routes (with :id) must be registered before the base route
    page.route('**/api/v1/todos/**', async route => {
      const method = route.request().method();
      const url = route.request().url();
      const id = url.split('/').pop()!;

      if (method === 'PATCH') {
        const body = await route.request().postDataJSON();
        const idx = todoList.findIndex(t => t.id === id);
        if (idx === -1) {
          await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'NOT_FOUND', message: 'Not found', requestId: 'test' }) });
          return;
        }
        if ('text' in body && (body.text ?? '').trim() === '') {
          await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'VALIDATION_ERROR', message: 'text cannot be empty', requestId: 'test' }) });
          return;
        }
        todoList[idx] = { ...todoList[idx], ...body, updatedAt: new Date().toISOString() };
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify(todoList[idx]) });
      } else if (method === 'DELETE') {
        const idx = todoList.findIndex(t => t.id === id);
        if (idx !== -1) todoList.splice(idx, 1);
        await route.fulfill({ status: 204, body: '' });
      } else {
        await route.continue();
      }
    }),
    page.route('**/api/v1/todos', async route => {
      const method = route.request().method();
      if (method === 'GET') {
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify([...todoList]) });
      } else if (method === 'POST') {
        const body = await route.request().postDataJSON();
        const created = makeTodo({ id: crypto.randomUUID(), text: body.text });
        todoList.push(created);
        await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(created) });
      } else {
        await route.continue();
      }
    }),
    page.route('**/api/v1/integrations', route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify({ integrationsEnabled: false, slack: { connectionStatus: 'unconfigured', notifier: null, listener: null }, teams: { connectionStatus: 'unconfigured', notifier: null, listener: null } }) })
    ),
    page.route('**/api/v1/settings', route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify({ port: 7411, watchDirectories: [], sessionRetentionHours: 24, outputRetentionMbPerSession: 10, autoRegisterRepos: false, yoloMode: false, restingThresholdMinutes: 20, telemetryEnabled: false, telemetryPromptSeen: true }) })
    ),
    page.route('**/api/v1/tools**', route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify({ claude: true, copilot: false, claudeCmd: 'claude', copilotCmd: null }) })
    ),
    page.route('**/ws**', route => route.abort()),
  ]);

  return todoList;
}

test.describe('Todo Panel', () => {
  test.beforeEach(async ({ context }) => {
    await skipOnboarding(context);
  });

  test('shows add-task input always (even when todo list is empty)', async ({ page }) => {
    await mockApis(page, []);
    await page.goto('/');
    await expect(page.getByRole('textbox', { name: /new task/i })).toBeVisible();
  });

  test('shows todo items as editable inputs when they exist', async ({ page }) => {
    const todos = [
      makeTodo({ id: '1', text: 'Fix the bug' }),
      makeTodo({ id: '2', text: 'Write tests', done: true }),
    ];
    await mockApis(page, todos);
    await page.goto('/');
    await expect(page.getByRole('textbox', { name: /edit task: Fix the bug/i })).toBeVisible();
    await expect(page.getByRole('textbox', { name: /edit task: Write tests/i })).toBeVisible();
  });

  test('done item input has strikethrough styling', async ({ page }) => {
    const todos = [makeTodo({ id: '1', text: 'Done item', done: true })];
    await mockApis(page, todos);
    await page.goto('/');
    const input = page.getByRole('textbox', { name: /edit task: Done item/i });
    await expect(input).toBeVisible();
    await expect(input).toHaveClass(/line-through/);
  });

  test('newest task appears at the top of the list', async ({ page }) => {
    const todos = [
      makeTodo({ id: 'old', text: 'Older task', createdAt: new Date(Date.now() - 10000).toISOString() }),
      makeTodo({ id: 'new', text: 'Newer task', createdAt: new Date().toISOString() }),
    ];
    await mockApis(page, todos);
    await page.goto('/');

    const inputs = page.getByRole('textbox');
    // inputs[0] = add row, inputs[1] = Newer task (last in array = first shown), inputs[2] = Older task
    await expect(inputs.nth(1)).toHaveAttribute('aria-label', /edit task: Newer task/i);
    await expect(inputs.nth(2)).toHaveAttribute('aria-label', /edit task: Older task/i);
  });

  test('typing into add row and blurring saves the item', async ({ page }) => {
    await mockApis(page, []);
    await page.goto('/');

    const addRow = page.getByRole('textbox', { name: /new task/i });
    await addRow.fill('My new task');
    await addRow.press('Tab');

    await expect(page.getByRole('textbox', { name: /edit task: My new task/i })).toBeVisible();
  });

  test('pressing Enter on add row saves and refocuses add row', async ({ page }) => {
    await mockApis(page, []);
    await page.goto('/');

    const addRow = page.getByRole('textbox', { name: /new task/i });
    await addRow.fill('First task');
    await addRow.press('Enter');

    await expect(page.getByRole('textbox', { name: /edit task: First task/i })).toBeVisible();
    // Add row input should still be visible and focused after save
    await expect(page.getByRole('textbox', { name: /new task/i })).toBeVisible();
    // Total: add row + saved item = 2 textboxes
    await expect(page.getByRole('textbox')).toHaveCount(2);
  });

  test('editing an existing item and blurring updates its text', async ({ page }) => {
    const todos = [makeTodo({ id: 'edit-1', text: 'Original text' })];
    await mockApis(page, todos);
    await page.goto('/');

    const input = page.getByRole('textbox', { name: /edit task: Original text/i });
    await input.fill('Updated text');
    await input.press('Tab');

    await expect(page.getByRole('textbox', { name: /edit task: Updated text/i })).toBeVisible();
  });

  test('pressing Backspace on empty row deletes it and keeps other item', async ({ page }) => {
    const todos = [
      makeTodo({ id: 'a', text: 'Keep me' }),
      makeTodo({ id: 'b', text: 'Delete me' }),
    ];
    await mockApis(page, todos);
    await page.goto('/');

    const deleteTarget = page.getByRole('textbox', { name: /edit task: Delete me/i });
    await deleteTarget.fill('');
    await deleteTarget.press('Backspace');

    await expect(page.getByRole('textbox', { name: /edit task: Delete me/i })).not.toBeVisible();
    await expect(page.getByRole('textbox', { name: /edit task: Keep me/i })).toBeVisible();
  });

  test('toggling a checkbox marks the item done', async ({ page }) => {
    const todos = [makeTodo({ id: '1', text: 'Toggle me', done: false })];
    await mockApis(page, todos);
    await page.goto('/');

    const checkbox = page.getByRole('checkbox', { name: /mark "Toggle me"/i });
    await checkbox.click();

    const input = page.getByRole('textbox', { name: /edit task: Toggle me/i });
    await expect(input).toHaveClass(/line-through/);
  });

  test.describe('header toggles', () => {
    test('hide-completed toggle hides done items', async ({ page }) => {
      const todos = [
        makeTodo({ id: '1', text: 'Active task', done: false }),
        makeTodo({ id: '2', text: 'Done task', done: true }),
      ];
      await mockApis(page, todos);
      await page.goto('/');

      // Both visible initially
      await expect(page.getByRole('textbox', { name: /edit task: Active task/i })).toBeVisible();
      await expect(page.getByRole('textbox', { name: /edit task: Done task/i })).toBeVisible();

      // Click "Hide completed"
      await page.getByTitle('Hide completed').click();

      await expect(page.getByRole('textbox', { name: /edit task: Done task/i })).not.toBeVisible();
      await expect(page.getByRole('textbox', { name: /edit task: Active task/i })).toBeVisible();
    });

    test('hide-completed toggle shows done items again when re-clicked', async ({ page }) => {
      const todos = [makeTodo({ id: '1', text: 'Done task', done: true })];
      await mockApis(page, todos);
      await page.goto('/');

      await page.getByTitle('Hide completed').click();
      await expect(page.getByRole('textbox', { name: /edit task: Done task/i })).not.toBeVisible();

      await page.getByTitle('Show completed').click();
      await expect(page.getByRole('textbox', { name: /edit task: Done task/i })).toBeVisible();
    });

    test('timestamps toggle shows/hides relative timestamps', async ({ page }) => {
      const todos = [makeTodo({ id: '1', text: 'Task with timestamp' })];
      await mockApis(page, todos);
      await page.goto('/');

      // Timestamps shown by default (look for "now", "2m", "3h", "1d" etc.)
      await expect(page.locator('text=/\\bnow\\b|\\d+m\\b|\\d+h\\b|\\d+d\\b/')).toBeVisible();

      // Click "Hide timestamps"
      await page.getByTitle('Hide timestamps').click();

      await expect(page.locator('text=/\\bnow\\b|\\d+m\\b|\\d+h\\b|\\d+d\\b/')).not.toBeVisible();
    });

    test('wrap-text toggle changes textarea overflow style', async ({ page }) => {
      const todos = [makeTodo({ id: '1', text: 'Long task that might need wrapping' })];
      await mockApis(page, todos);
      await page.goto('/');

      const textarea = page.getByRole('textbox', { name: /edit task/i });
      await expect(textarea).toHaveCSS('white-space', 'nowrap');

      // Click "Wrap text"
      await page.getByTitle('Wrap text').click();

      await expect(textarea).not.toHaveCSS('white-space', 'nowrap');
    });
  });

  test.describe('trash icon delete', () => {
    test('hovering a todo row reveals the trash button and clicking it deletes the item', async ({ page }) => {
      const todos = [makeTodo({ id: 'del-1', text: 'Trash me' })];
      await mockApis(page, todos);
      await page.goto('/');

      // Hover the textarea to trigger the group-hover on the parent li
      const textarea = page.getByRole('textbox', { name: /edit task: Trash me/i });
      await textarea.hover();

      const trashBtn = page.getByRole('button', { name: /delete "Trash me"/i });
      await expect(trashBtn).toBeVisible();
      await trashBtn.click();

      await expect(page.getByRole('textbox', { name: /edit task: Trash me/i })).not.toBeVisible();
    });

    test('deleting an item leaves remaining items intact', async ({ page }) => {
      const todos = [
        makeTodo({ id: 'keep', text: 'Keep this' }),
        makeTodo({ id: 'del', text: 'Delete this' }),
      ];
      await mockApis(page, todos);
      await page.goto('/');

      const textarea = page.getByRole('textbox', { name: /edit task: Delete this/i });
      await textarea.hover();
      await page.getByRole('button', { name: /delete "Delete this"/i }).click();

      await expect(page.getByRole('textbox', { name: /edit task: Delete this/i })).not.toBeVisible();
      await expect(page.getByRole('textbox', { name: /edit task: Keep this/i })).toBeVisible();
    });
  });
});

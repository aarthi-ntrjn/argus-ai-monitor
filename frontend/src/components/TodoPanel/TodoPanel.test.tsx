import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import TodoPanel from './TodoPanel';

vi.mock('../../hooks/useTodos', () => ({
  useTodos: vi.fn(),
  useCreateTodo: vi.fn(),
  useUpdateTodoText: vi.fn(),
  useToggleTodo: vi.fn(),
  useDeleteTodo: vi.fn(),
}));

import { useTodos, useCreateTodo, useUpdateTodoText, useToggleTodo, useDeleteTodo } from '../../hooks/useTodos';

const mockUseTodos = vi.mocked(useTodos);
const mockUseCreateTodo = vi.mocked(useCreateTodo);
const mockUseUpdateTodoText = vi.mocked(useUpdateTodoText);
const mockUseToggleTodo = vi.mocked(useToggleTodo);
const mockUseDeleteTodo = vi.mocked(useDeleteTodo);

function makeMutation(overrides = {}) {
  return { mutate: vi.fn(), isPending: false, isError: false, error: null, ...overrides } as unknown as ReturnType<typeof useCreateTodo>;
}

function renderPanel() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <TodoPanel />
    </QueryClientProvider>
  );
}

const baseTodos = [
  { id: '1', userId: 'default', text: 'First task', done: false, createdAt: new Date().toISOString(), updatedAt: '' },
  { id: '2', userId: 'default', text: 'Done task', done: true, createdAt: new Date().toISOString(), updatedAt: '' },
];

beforeEach(() => {
  mockUseCreateTodo.mockReturnValue(makeMutation());
  mockUseUpdateTodoText.mockReturnValue(makeMutation() as unknown as ReturnType<typeof useUpdateTodoText>);
  mockUseToggleTodo.mockReturnValue(makeMutation() as unknown as ReturnType<typeof useToggleTodo>);
  mockUseDeleteTodo.mockReturnValue(makeMutation() as unknown as ReturnType<typeof useDeleteTodo>);
});

describe('TodoPanel', () => {
  describe('header', () => {
    it('shows "To Do or Not To Do" as the panel title', () => {
      mockUseTodos.mockReturnValue({ data: [], isLoading: false, isError: false } as unknown as ReturnType<typeof useTodos>);
      renderPanel();
      expect(screen.getByText(/to do or not to do/i)).toBeInTheDocument();
    });

    it('shows timestamps toggle button', () => {
      mockUseTodos.mockReturnValue({ data: [], isLoading: false, isError: false } as unknown as ReturnType<typeof useTodos>);
      renderPanel();
      expect(screen.getByTitle(/timestamps/i)).toBeInTheDocument();
    });

    it('shows completed items toggle button', () => {
      mockUseTodos.mockReturnValue({ data: [], isLoading: false, isError: false } as unknown as ReturnType<typeof useTodos>);
      renderPanel();
      expect(screen.getByTitle(/completed/i)).toBeInTheDocument();
    });

    it('shows wrap text toggle button', () => {
      mockUseTodos.mockReturnValue({ data: [], isLoading: false, isError: false } as unknown as ReturnType<typeof useTodos>);
      renderPanel();
      expect(screen.getByTitle(/wrap text|single line/i)).toBeInTheDocument();
    });
  });

  describe('add row', () => {
    it('always shows the add-task input regardless of loading state', () => {
      mockUseTodos.mockReturnValue({ data: undefined, isLoading: true, isError: false } as unknown as ReturnType<typeof useTodos>);
      renderPanel();
      expect(screen.getByRole('textbox', { name: /new task/i })).toBeInTheDocument();
    });

    it('always shows the add-task input when todos exist', () => {
      mockUseTodos.mockReturnValue({ data: baseTodos, isLoading: false, isError: false } as unknown as ReturnType<typeof useTodos>);
      renderPanel();
      expect(screen.getByRole('textbox', { name: /new task/i })).toBeInTheDocument();
    });

    it('shows loading indicator when loading', () => {
      mockUseTodos.mockReturnValue({ data: undefined, isLoading: true, isError: false } as unknown as ReturnType<typeof useTodos>);
      renderPanel();
      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it('shows error state when fetch fails', () => {
      mockUseTodos.mockReturnValue({ data: undefined, isLoading: false, isError: true } as unknown as ReturnType<typeof useTodos>);
      renderPanel();
      expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
    });
  });

  describe('todo list', () => {
    beforeEach(() => {
      mockUseTodos.mockReturnValue({ data: baseTodos, isLoading: false, isError: false } as unknown as ReturnType<typeof useTodos>);
    });

    it('renders all todo items as textareas', () => {
      renderPanel();
      expect(screen.getByRole('textbox', { name: /edit task: First task/i })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /edit task: Done task/i })).toBeInTheDocument();
    });

    it('applies strikethrough style to done item', () => {
      renderPanel();
      const doneInput = screen.getByRole('textbox', { name: /edit task: Done task/i });
      expect(doneInput.className).toContain('line-through');
    });

    it('renders newest todo first (reverse order)', () => {
      renderPanel();
      const inputs = screen.getAllByRole('textbox');
      // inputs[0] = add row, inputs[1] = Done task (id:2, added after id:1), inputs[2] = First task
      const textboxLabels = inputs.map(i => i.getAttribute('aria-label'));
      const doneIndex = textboxLabels.findIndex(l => l?.includes('Done task'));
      const firstIndex = textboxLabels.findIndex(l => l?.includes('First task'));
      expect(doneIndex).toBeLessThan(firstIndex);
    });
  });

  describe('hide completed toggle', () => {
    it('hides done items when toggle is clicked', async () => {
      mockUseTodos.mockReturnValue({ data: baseTodos, isLoading: false, isError: false } as unknown as ReturnType<typeof useTodos>);
      renderPanel();
      const toggle = screen.getByTitle(/hide completed|show completed/i);
      await userEvent.click(toggle);
      expect(screen.queryByRole('textbox', { name: /edit task: Done task/i })).not.toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /edit task: First task/i })).toBeInTheDocument();
    });

    it('shows done items again when toggle is clicked twice', async () => {
      mockUseTodos.mockReturnValue({ data: baseTodos, isLoading: false, isError: false } as unknown as ReturnType<typeof useTodos>);
      renderPanel();
      const toggle = screen.getByTitle(/hide completed|show completed/i);
      await userEvent.click(toggle);
      await userEvent.click(toggle);
      expect(screen.getByRole('textbox', { name: /edit task: Done task/i })).toBeInTheDocument();
    });
  });

  describe('wrap text toggle', () => {
    it('changes textarea style when wrap toggle is clicked', async () => {
      mockUseTodos.mockReturnValue({ data: [baseTodos[0]], isLoading: false, isError: false } as unknown as ReturnType<typeof useTodos>);
      renderPanel();
      const input = screen.getByRole('textbox', { name: /edit task: First task/i });
      expect(input).not.toHaveStyle({ whiteSpace: 'nowrap' });
      const toggle = screen.getByTitle(/wrap text|single line/i);
      await userEvent.click(toggle);
      expect(input).toHaveStyle({ whiteSpace: 'nowrap' });
    });
  });

  describe('checkbox toggle', () => {
    it('calls toggleTodo when checkbox is clicked', async () => {
      mockUseTodos.mockReturnValue({ data: baseTodos, isLoading: false, isError: false } as unknown as ReturnType<typeof useTodos>);
      const mutate = vi.fn();
      mockUseToggleTodo.mockReturnValue(makeMutation({ mutate }) as unknown as ReturnType<typeof useToggleTodo>);
      renderPanel();
      const checkbox = screen.getByRole('checkbox', { name: /mark "First task"/i });
      await userEvent.click(checkbox);
      expect(mutate).toHaveBeenCalledWith({ id: '1', done: true });
    });
  });

  describe('Enter key on add row', () => {
    it('calls createTodo when Enter is pressed on non-empty add row', async () => {
      mockUseTodos.mockReturnValue({ data: [], isLoading: false, isError: false } as unknown as ReturnType<typeof useTodos>);
      const mutate = vi.fn();
      mockUseCreateTodo.mockReturnValue(makeMutation({ mutate }));
      renderPanel();
      const addRow = screen.getByRole('textbox', { name: /new task/i });
      await userEvent.type(addRow, 'New item{Enter}');
      expect(mutate).toHaveBeenCalledWith('New item', expect.any(Object));
    });

    it('does not call createTodo when Enter is pressed on empty add row', async () => {
      mockUseTodos.mockReturnValue({ data: [], isLoading: false, isError: false } as unknown as ReturnType<typeof useTodos>);
      const mutate = vi.fn();
      mockUseCreateTodo.mockReturnValue(makeMutation({ mutate }));
      renderPanel();
      const addRow = screen.getByRole('textbox', { name: /new task/i });
      await userEvent.click(addRow);
      await userEvent.keyboard('{Enter}');
      expect(mutate).not.toHaveBeenCalled();
    });
  });

  describe('delete button', () => {
    it('calls deleteTodo when trash button is clicked', async () => {
      mockUseTodos.mockReturnValue({ data: [baseTodos[0]], isLoading: false, isError: false } as unknown as ReturnType<typeof useTodos>);
      const mutate = vi.fn();
      mockUseDeleteTodo.mockReturnValue(makeMutation({ mutate }) as unknown as ReturnType<typeof useDeleteTodo>);
      renderPanel();
      const deleteBtn = screen.getByRole('button', { name: /delete "First task"/i });
      await userEvent.click(deleteBtn);
      expect(mutate).toHaveBeenCalledWith('1');
    });
  });

  describe('Backspace on empty input', () => {
    it('calls deleteTodo when Backspace is pressed on empty real todo', async () => {
      mockUseTodos.mockReturnValue({ data: baseTodos, isLoading: false, isError: false } as unknown as ReturnType<typeof useTodos>);
      const mutate = vi.fn();
      mockUseDeleteTodo.mockReturnValue(makeMutation({ mutate }) as unknown as ReturnType<typeof useDeleteTodo>);
      renderPanel();
      const input = screen.getByRole('textbox', { name: /edit task: First task/i });
      await userEvent.clear(input);
      await userEvent.keyboard('{Backspace}');
      expect(mutate).toHaveBeenCalledWith('1');
    });
  });

  describe('blur saves text', () => {
    it('calls updateTodoText on blur when text has changed', async () => {
      mockUseTodos.mockReturnValue({ data: [baseTodos[0]], isLoading: false, isError: false } as unknown as ReturnType<typeof useTodos>);
      const mutate = vi.fn();
      mockUseUpdateTodoText.mockReturnValue(makeMutation({ mutate }) as unknown as ReturnType<typeof useUpdateTodoText>);
      renderPanel();
      const input = screen.getByRole('textbox', { name: /edit task: First task/i });
      await userEvent.clear(input);
      await userEvent.type(input, 'Updated text');
      act(() => { input.blur(); });
      expect(mutate).toHaveBeenCalledWith({ id: '1', text: 'Updated text' });
    });

    it('calls deleteTodo on blur when real todo text is emptied', async () => {
      mockUseTodos.mockReturnValue({ data: [baseTodos[0]], isLoading: false, isError: false } as unknown as ReturnType<typeof useTodos>);
      const mutate = vi.fn();
      mockUseDeleteTodo.mockReturnValue(makeMutation({ mutate }) as unknown as ReturnType<typeof useDeleteTodo>);
      renderPanel();
      const input = screen.getByRole('textbox', { name: /edit task: First task/i });
      await userEvent.clear(input);
      act(() => { input.blur(); });
      expect(mutate).toHaveBeenCalledWith('1');
    });

    it('does not call updateTodoText on blur when text is unchanged', async () => {
      mockUseTodos.mockReturnValue({ data: [baseTodos[0]], isLoading: false, isError: false } as unknown as ReturnType<typeof useTodos>);
      const mutate = vi.fn();
      mockUseUpdateTodoText.mockReturnValue(makeMutation({ mutate }) as unknown as ReturnType<typeof useUpdateTodoText>);
      renderPanel();
      const input = screen.getByRole('textbox', { name: /edit task: First task/i });
      act(() => { input.blur(); });
      expect(mutate).not.toHaveBeenCalled();
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import TodoPanel from './TodoPanel';

// Mock the hooks
vi.mock('../../hooks/useTodos', () => ({
  useTodos: vi.fn(),
  useCreateTodo: vi.fn(),
  useToggleTodo: vi.fn(),
  useDeleteTodo: vi.fn(),
}));

import { useTodos, useCreateTodo, useToggleTodo, useDeleteTodo } from '../../hooks/useTodos';

const mockUseTodos = vi.mocked(useTodos);
const mockUseCreateTodo = vi.mocked(useCreateTodo);
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

beforeEach(() => {
  mockUseCreateTodo.mockReturnValue(makeMutation());
  mockUseToggleTodo.mockReturnValue(makeMutation() as unknown as ReturnType<typeof useToggleTodo>);
  mockUseDeleteTodo.mockReturnValue(makeMutation() as unknown as ReturnType<typeof useDeleteTodo>);
});

describe('TodoPanel', () => {
  describe('empty state', () => {
    it('shows empty state message when no todos', () => {
      mockUseTodos.mockReturnValue({ data: [], isLoading: false, isError: false } as unknown as ReturnType<typeof useTodos>);
      renderPanel();
      expect(screen.getByText(/no reminders yet/i)).toBeInTheDocument();
    });

    it('shows loading state', () => {
      mockUseTodos.mockReturnValue({ data: undefined, isLoading: true, isError: false } as unknown as ReturnType<typeof useTodos>);
      renderPanel();
      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it('shows error state', () => {
      mockUseTodos.mockReturnValue({ data: undefined, isLoading: false, isError: true } as unknown as ReturnType<typeof useTodos>);
      renderPanel();
      expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
    });
  });

  describe('add form', () => {
    beforeEach(() => {
      mockUseTodos.mockReturnValue({ data: [], isLoading: false, isError: false } as unknown as ReturnType<typeof useTodos>);
    });

    it('renders the add input and button', () => {
      renderPanel();
      expect(screen.getByRole('textbox', { name: /new reminder/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /add/i })).toBeInTheDocument();
    });

    it('shows validation error for empty submission', async () => {
      renderPanel();
      await userEvent.click(screen.getByRole('button', { name: /add/i }));
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('calls createTodo mutate with trimmed text on submit', async () => {
      const mutate = vi.fn();
      mockUseCreateTodo.mockReturnValue(makeMutation({ mutate }));
      renderPanel();
      await userEvent.type(screen.getByRole('textbox', { name: /new reminder/i }), 'Fix the bug');
      await userEvent.click(screen.getByRole('button', { name: /add/i }));
      expect(mutate).toHaveBeenCalledWith('Fix the bug', expect.any(Object));
    });
  });

  describe('todo list', () => {
    const todos = [
      { id: '1', userId: 'default', text: 'First task', done: false, createdAt: '', updatedAt: '' },
      { id: '2', userId: 'default', text: 'Done task', done: true, createdAt: '', updatedAt: '' },
    ];

    beforeEach(() => {
      mockUseTodos.mockReturnValue({ data: todos, isLoading: false, isError: false } as unknown as ReturnType<typeof useTodos>);
    });

    it('renders all todo items', () => {
      renderPanel();
      expect(screen.getByText('First task')).toBeInTheDocument();
      expect(screen.getByText('Done task')).toBeInTheDocument();
    });

    it('applies strikethrough style to done items', () => {
      renderPanel();
      const doneText = screen.getByText('Done task');
      expect(doneText.className).toContain('line-through');
    });

    it('calls toggleTodo when checkbox clicked', async () => {
      const mutate = vi.fn();
      mockUseToggleTodo.mockReturnValue(makeMutation({ mutate }) as unknown as ReturnType<typeof useToggleTodo>);
      renderPanel();
      const checkbox = screen.getByRole('checkbox', { name: /mark "First task"/i });
      await userEvent.click(checkbox);
      expect(mutate).toHaveBeenCalledWith({ id: '1', done: true });
    });

    it('calls deleteTodo when delete button clicked', async () => {
      const mutate = vi.fn();
      mockUseDeleteTodo.mockReturnValue(makeMutation({ mutate }) as unknown as ReturnType<typeof useDeleteTodo>);
      renderPanel();
      const deleteBtn = screen.getByRole('button', { name: /delete "First task"/i });
      await userEvent.click(deleteBtn);
      expect(mutate).toHaveBeenCalledWith('1');
    });
  });
});

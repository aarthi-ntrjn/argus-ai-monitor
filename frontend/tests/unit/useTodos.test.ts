import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useCreateTodo, useUpdateTodoText, useToggleTodo, useDeleteTodo } from '../../src/hooks/useTodos';

vi.mock('../../src/services/api', () => ({
  getTodos: vi.fn().mockResolvedValue([]),
  createTodo: vi.fn().mockResolvedValue({ id: '1', userId: 'default', text: 'Test', done: false, createdAt: '', updatedAt: '' }),
  updateTodoText: vi.fn().mockResolvedValue({ id: '1', userId: 'default', text: 'Updated', done: false, createdAt: '', updatedAt: '' }),
  toggleTodo: vi.fn().mockResolvedValue({ id: '1', userId: 'default', text: 'Test', done: true, createdAt: '', updatedAt: '' }),
  deleteTodo: vi.fn().mockResolvedValue(undefined),
  // Separate queryClient from api.ts — the bug was that mutations invalidated this instead of the provider's client
  queryClient: new QueryClient(),
}));

function makeWrapper(qc: QueryClient) {
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

describe('useTodos mutation hooks — invalidate correct QueryClient', () => {
  let providerQc: QueryClient;

  beforeEach(() => {
    providerQc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  it('useCreateTodo invalidates todos query on the provider QueryClient, not a stale imported instance', async () => {
    const spy = vi.spyOn(providerQc, 'invalidateQueries');
    const { result } = renderHook(() => useCreateTodo(), { wrapper: makeWrapper(providerQc) });

    await act(async () => {
      result.current.mutate('Buy milk');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['todos'] }));
  });

  it('useUpdateTodoText invalidates todos query on the provider QueryClient', async () => {
    const spy = vi.spyOn(providerQc, 'invalidateQueries');
    const { result } = renderHook(() => useUpdateTodoText(), { wrapper: makeWrapper(providerQc) });

    await act(async () => {
      result.current.mutate({ id: '1', text: 'Updated text' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['todos'] }));
  });

  it('useToggleTodo invalidates todos query on the provider QueryClient', async () => {
    const spy = vi.spyOn(providerQc, 'invalidateQueries');
    const { result } = renderHook(() => useToggleTodo(), { wrapper: makeWrapper(providerQc) });

    await act(async () => {
      result.current.mutate({ id: '1', done: true });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['todos'] }));
  });

  it('useDeleteTodo invalidates todos query on the provider QueryClient', async () => {
    const spy = vi.spyOn(providerQc, 'invalidateQueries');
    const { result } = renderHook(() => useDeleteTodo(), { wrapper: makeWrapper(providerQc) });

    await act(async () => {
      result.current.mutate('1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['todos'] }));
  });
});

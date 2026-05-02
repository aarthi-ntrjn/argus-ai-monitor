import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { UseQueryResult, UseMutationResult } from '@tanstack/react-query';
import { getTodos, createTodo, toggleTodo, updateTodoText, deleteTodo } from '../services/api';
import type { TodoItem } from '../types';

const QUERY_KEY = ['todos'];

export function useTodos(): UseQueryResult<TodoItem[], Error> {
  return useQuery({ queryKey: QUERY_KEY, queryFn: getTodos });
}

export function useCreateTodo(): UseMutationResult<TodoItem, Error, string> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (text: string) => createTodo(text),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useUpdateTodoText(): UseMutationResult<TodoItem, Error, { id: string; text: string }> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) => updateTodoText(id, text),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useToggleTodo(): UseMutationResult<TodoItem, Error, { id: string; done: boolean }> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) => toggleTodo(id, done),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useDeleteTodo(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTodo(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

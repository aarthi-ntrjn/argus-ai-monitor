import { QueryClient } from '@tanstack/react-query';
import type { Repository, Session, SessionOutput, ControlAction } from '../types';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5000,
      retry: 2,
    },
  },
});

const BASE = '/api/v1';

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function getRepositories(): Promise<Repository[]> {
  return apiFetch<Repository[]>('/repositories');
}

export async function addRepository(path: string): Promise<Repository> {
  return apiFetch<Repository>('/repositories', { method: 'POST', body: JSON.stringify({ path }) });
}

export async function removeRepository(id: string): Promise<void> {
  await apiFetch<void>(`/repositories/${id}`, { method: 'DELETE' });
}

export interface SessionFilters { repositoryId?: string; status?: string; type?: string; }

export async function getSessions(filters?: SessionFilters): Promise<Session[]> {
  const qs = filters ? '?' + new URLSearchParams(filters as Record<string, string>).toString() : '';
  return apiFetch<Session[]>(`/sessions${qs}`);
}

export async function getSession(id: string): Promise<Session> {
  return apiFetch<Session>(`/sessions/${id}`);
}

export interface OutputParams { limit?: number; before?: string; }
export interface OutputPage { items: SessionOutput[]; nextBefore: string | null; total: number; }

export async function getSessionOutput(id: string, params?: OutputParams): Promise<OutputPage> {
  const qs = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
  return apiFetch<OutputPage>(`/sessions/${id}/output${qs}`);
}

export async function stopSession(id: string): Promise<{ actionId: string; status: string }> {
  return apiFetch<{ actionId: string; status: string }>(`/sessions/${id}/stop`, { method: 'POST' });
}

export async function sendPrompt(id: string, prompt: string): Promise<ControlAction> {
  return apiFetch<ControlAction>(`/sessions/${id}/send`, { method: 'POST', body: JSON.stringify({ prompt }) });
}

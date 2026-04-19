import { QueryClient } from '@tanstack/react-query';
import type { Repository, Session, SessionOutput, ControlAction, TodoItem, ArgusConfig, ToolCommand } from '../types';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5000,
      retry: 2,
    },
  },
});

const BASE = '/api/v1';

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = init?.body ? { 'Content-Type': 'application/json' } : {};
  const res = await fetch(`${BASE}${path}`, {
    headers,
    ...init,
  });
  if (!res.ok) {
    const text = await res.text();
    let message = text;
    try {
      const json = JSON.parse(text);
      message = json.message ?? text;
    } catch { /* not JSON, use raw text */ }
    throw new Error(message);
  }
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

export async function rescanRemoteUrls(): Promise<{ updated: number; total: number }> {
  return apiFetch<{ updated: number; total: number }>('/repositories/rescan-remotes', { method: 'POST' });
}

export async function scanFolder(path: string): Promise<Array<{ path: string; name: string }>> {
  const result = await apiFetch<{ repos: Array<{ path: string; name: string }>; error?: string }>(
    '/fs/scan-folder',
    { method: 'POST', body: JSON.stringify({ path }) }
  );
  return result.repos ?? [];
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

export async function interruptSession(id: string): Promise<{ actionId: string; status: string }> {
  return apiFetch<{ actionId: string; status: string }>(`/sessions/${id}/interrupt`, { method: 'POST' });
}

export async function dismissSession(id: string): Promise<{ status: string }> {
  return apiFetch<{ status: string }>(`/sessions/${id}/dismiss`, { method: 'POST' });
}

export async function sendPrompt(id: string, prompt: string): Promise<ControlAction> {
  return apiFetch<ControlAction>(`/sessions/${id}/send`, { method: 'POST', body: JSON.stringify({ prompt }) });
}

export async function getTodos(): Promise<TodoItem[]> {
  return apiFetch<TodoItem[]>('/todos');
}

export async function createTodo(text: string): Promise<TodoItem> {
  return apiFetch<TodoItem>('/todos', { method: 'POST', body: JSON.stringify({ text }) });
}

export async function toggleTodo(id: string, done: boolean): Promise<TodoItem> {
  return apiFetch<TodoItem>(`/todos/${id}`, { method: 'PATCH', body: JSON.stringify({ done }) });
}

export async function updateTodoText(id: string, text: string): Promise<TodoItem> {
  return apiFetch<TodoItem>(`/todos/${id}`, { method: 'PATCH', body: JSON.stringify({ text }) });
}

export async function deleteTodo(id: string): Promise<void> {
  await apiFetch<void>(`/todos/${id}`, { method: 'DELETE' });
}

export interface AvailableTools {
  claude: boolean;
  copilot: boolean;
  claudeCmd?: string;
  copilotCmd?: string;
}

export async function getAvailableTools(): Promise<AvailableTools> {
  return apiFetch<AvailableTools>('/tools');
}

// Returns { cmd } when the server cannot open a terminal (headless/Codespaces),
// so the caller can show the command for manual execution. Throws on other errors.
export async function launchInTerminal(tool: ToolCommand, repoPath?: string): Promise<{ cmd?: string }> {
  const res = await fetch(`${BASE}/sessions/launch-terminal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tool, repoPath }),
  });
  if (res.status === 202) return {};
  if (res.status === 422) {
    const body = await res.json() as { cmd?: string };
    return { cmd: body.cmd };
  }
  const text = await res.text();
  let message = text;
  try { message = (JSON.parse(text) as { message?: string }).message ?? text; } catch { /* use raw text */ }
  throw new Error(message);
}

export async function getArgusSettings(): Promise<ArgusConfig> {
  return apiFetch<ArgusConfig>('/settings');
}

export async function patchArgusSettings(patch: Partial<ArgusConfig>): Promise<ArgusConfig> {
  return apiFetch<ArgusConfig>('/settings', { method: 'PATCH', body: JSON.stringify(patch) });
}

export function postTelemetryEvent(type: string): void {
  void fetch(`${BASE}/telemetry/event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type }),
  }).catch(() => { /* fire-and-forget */ });
}

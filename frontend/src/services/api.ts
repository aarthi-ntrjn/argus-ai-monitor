import axios from 'axios';
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

export const apiClient = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

export async function getRepositories(): Promise<Repository[]> {
  const { data } = await apiClient.get<Repository[]>('/repositories');
  return data;
}

export async function addRepository(path: string): Promise<Repository> {
  const { data } = await apiClient.post<Repository>('/repositories', { path });
  return data;
}

export async function removeRepository(id: string): Promise<void> {
  await apiClient.delete(`/repositories/${id}`);
}

export interface SessionFilters { repositoryId?: string; status?: string; type?: string; }

export async function getSessions(filters?: SessionFilters): Promise<Session[]> {
  const { data } = await apiClient.get<Session[]>('/sessions', { params: filters });
  return data;
}

export async function getSession(id: string): Promise<Session> {
  const { data } = await apiClient.get<Session>(`/sessions/${id}`);
  return data;
}

export interface OutputParams { limit?: number; before?: string; }
export interface OutputPage { items: SessionOutput[]; nextBefore: string | null; total: number; }

export async function getSessionOutput(id: string, params?: OutputParams): Promise<OutputPage> {
  const { data } = await apiClient.get<OutputPage>(`/sessions/${id}/output`, { params });
  return data;
}

export async function stopSession(id: string): Promise<{ actionId: string; status: string }> {
  const { data } = await apiClient.post<{ actionId: string; status: string }>(`/sessions/${id}/stop`);
  return data;
}

export async function sendPrompt(id: string, prompt: string): Promise<ControlAction> {
  const { data } = await apiClient.post<ControlAction>(`/sessions/${id}/send`, { prompt });
  return data;
}

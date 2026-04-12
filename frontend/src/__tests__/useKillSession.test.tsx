import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

vi.mock('../services/api', () => ({
  stopSession: vi.fn(),
}));

import { useKillSession } from '../hooks/useKillSession';
import { stopSession } from '../services/api';

const mockedStop = vi.mocked(stopSession);

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

describe('useKillSession', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('starts with dialog closed and no target', () => {
    const { result } = renderHook(() => useKillSession(), { wrapper: createWrapper() });
    expect(result.current.dialogOpen).toBe(false);
    expect(result.current.targetSessionId).toBeNull();
    expect(result.current.isPending).toBe(false);
    expect(result.current.isError).toBe(false);
  });

  it('requestKill opens dialog with the target session id', () => {
    const { result } = renderHook(() => useKillSession(), { wrapper: createWrapper() });
    act(() => result.current.requestKill('sess-123'));
    expect(result.current.dialogOpen).toBe(true);
    expect(result.current.targetSessionId).toBe('sess-123');
  });

  it('cancelKill closes dialog and clears target', () => {
    const { result } = renderHook(() => useKillSession(), { wrapper: createWrapper() });
    act(() => result.current.requestKill('sess-123'));
    act(() => result.current.cancelKill());
    expect(result.current.dialogOpen).toBe(false);
    expect(result.current.targetSessionId).toBeNull();
  });

  it('confirmKill calls stopSession with the target id', async () => {
    mockedStop.mockResolvedValueOnce({ actionId: 'a1', status: 'completed' });
    const { result } = renderHook(() => useKillSession(), { wrapper: createWrapper() });
    act(() => result.current.requestKill('sess-456'));
    act(() => result.current.confirmKill());
    await waitFor(() => expect(mockedStop).toHaveBeenCalledWith('sess-456'));
  });

  it('sets isPending while mutation is in flight', async () => {
    let resolve!: (v: { actionId: string; status: string }) => void;
    mockedStop.mockReturnValueOnce(new Promise(r => { resolve = r; }));
    const { result } = renderHook(() => useKillSession(), { wrapper: createWrapper() });
    act(() => result.current.requestKill('sess-789'));
    act(() => result.current.confirmKill());
    await waitFor(() => expect(result.current.isPending).toBe(true));
    await act(async () => resolve({ actionId: 'a1', status: 'completed' }));
    await waitFor(() => expect(result.current.isPending).toBe(false));
  });

  it('sets isError and error on failure', async () => {
    mockedStop.mockRejectedValueOnce(new Error('Process not found'));
    const { result } = renderHook(() => useKillSession(), { wrapper: createWrapper() });
    act(() => result.current.requestKill('sess-fail'));
    act(() => result.current.confirmKill());
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Process not found');
  });

  it('closes dialog on successful kill', async () => {
    mockedStop.mockResolvedValueOnce({ actionId: 'a1', status: 'completed' });
    const { result } = renderHook(() => useKillSession(), { wrapper: createWrapper() });
    act(() => result.current.requestKill('sess-ok'));
    act(() => result.current.confirmKill());
    await waitFor(() => expect(result.current.dialogOpen).toBe(false));
    expect(result.current.targetSessionId).toBeNull();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useRepositoryManagement } from '../../src/hooks/useRepositoryManagement';

const mockScanFolder = vi.fn();
const mockAddRepository = vi.fn();

vi.mock('../../src/services/api', () => ({
  scanFolder: (...args: unknown[]) => mockScanFolder(...args),
  addRepository: (...args: unknown[]) => mockAddRepository(...args),
  removeRepository: vi.fn().mockResolvedValue(undefined),
}));

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

const REPOS = [{ id: 'r1', path: 'C:\source\existing', name: 'existing', source: 'ui' as const, addedAt: '', lastScannedAt: null, branch: null }];

describe('useRepositoryManagement — folder input flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('handleAddRepo shows the folder input (showFolderInput becomes true)', () => {
    const { result } = renderHook(() => useRepositoryManagement(), { wrapper: createWrapper() });
    expect(result.current.showFolderInput).toBe(false);
    act(() => { result.current.handleAddRepo(); });
    expect(result.current.showFolderInput).toBe(true);
  });

  it('handleAddRepo resets folderInputPath to empty string', () => {
    const { result } = renderHook(() => useRepositoryManagement(), { wrapper: createWrapper() });
    act(() => { result.current.setFolderInputPath('old-value'); });
    act(() => { result.current.handleAddRepo(); });
    expect(result.current.folderInputPath).toBe('');
  });

  it('cancelFolderInput hides the dialog', () => {
    const { result } = renderHook(() => useRepositoryManagement(), { wrapper: createWrapper() });
    act(() => { result.current.handleAddRepo(); });
    expect(result.current.showFolderInput).toBe(true);
    act(() => { result.current.cancelFolderInput(); });
    expect(result.current.showFolderInput).toBe(false);
  });

  it('handleFolderSubmit does nothing when folderInputPath is blank', async () => {
    const { result } = renderHook(() => useRepositoryManagement(), { wrapper: createWrapper() });
    await act(async () => { await result.current.handleFolderSubmit(REPOS); });
    expect(mockScanFolder).not.toHaveBeenCalled();
  });

  it('handleFolderSubmit calls scanFolder with trimmed path', async () => {
    mockScanFolder.mockResolvedValue([]);
    const { result } = renderHook(() => useRepositoryManagement(), { wrapper: createWrapper() });
    act(() => { result.current.setFolderInputPath('  C:\source  '); });
    await act(async () => { await result.current.handleFolderSubmit(REPOS); });
    expect(mockScanFolder).toHaveBeenCalledWith('C:\source');
  });

  it('handleFolderSubmit closes dialog immediately on submit', async () => {
    mockScanFolder.mockResolvedValue([]);
    const { result } = renderHook(() => useRepositoryManagement(), { wrapper: createWrapper() });
    act(() => {
      result.current.handleAddRepo();
      result.current.setFolderInputPath('C:\source');
    });
    expect(result.current.showFolderInput).toBe(true);
    await act(async () => { await result.current.handleFolderSubmit(REPOS); });
    expect(result.current.showFolderInput).toBe(false);
  });

  it('sets addInfo when no new repos are found', async () => {
    mockScanFolder.mockResolvedValue([{ path: 'C:\source\existing', name: 'existing' }]);
    const { result } = renderHook(() => useRepositoryManagement(), { wrapper: createWrapper() });
    act(() => { result.current.setFolderInputPath('C:\source'); });
    await act(async () => { await result.current.handleFolderSubmit(REPOS); });
    expect(result.current.addInfo).toBe('No new git repositories found in the specified folder.');
    expect(mockAddRepository).not.toHaveBeenCalled();
  });

  it('calls addRepository for each new repo and shows success info', async () => {
    mockScanFolder.mockResolvedValue([
      { path: 'C:\source\new-a', name: 'new-a' },
      { path: 'C:\source\new-b', name: 'new-b' },
    ]);
    mockAddRepository.mockResolvedValue({});
    const { result } = renderHook(() => useRepositoryManagement(), { wrapper: createWrapper() });
    act(() => { result.current.setFolderInputPath('C:\source'); });
    await act(async () => { await result.current.handleFolderSubmit(REPOS); });
    expect(mockAddRepository).toHaveBeenCalledTimes(2);
    expect(result.current.addInfo).toBe('Added 2 repositories.');
    expect(result.current.addError).toBeNull();
  });

  it('skips already-registered repos and only adds new ones', async () => {
    mockScanFolder.mockResolvedValue([
      { path: 'C:\source\existing', name: 'existing' },
      { path: 'C:\source\new-one', name: 'new-one' },
    ]);
    mockAddRepository.mockResolvedValue({});
    const { result } = renderHook(() => useRepositoryManagement(), { wrapper: createWrapper() });
    act(() => { result.current.setFolderInputPath('C:\source'); });
    await act(async () => { await result.current.handleFolderSubmit(REPOS); });
    expect(mockAddRepository).toHaveBeenCalledTimes(1);
    expect(mockAddRepository).toHaveBeenCalledWith('C:\source\new-one');
  });

  it('sets addError when scanFolder throws', async () => {
    mockScanFolder.mockRejectedValue(new Error('Path not found'));
    const { result } = renderHook(() => useRepositoryManagement(), { wrapper: createWrapper() });
    act(() => { result.current.setFolderInputPath('C:\bad\path'); });
    await act(async () => { await result.current.handleFolderSubmit(REPOS); });
    expect(result.current.addError).toBe('Path not found');
    expect(result.current.adding).toBe(false);
  });

  it('sets addError with partial failure message when some addRepository calls fail', async () => {
    mockScanFolder.mockResolvedValue([
      { path: 'C:\source\ok', name: 'ok' },
      { path: 'C:\source\bad', name: 'bad' },
    ]);
    mockAddRepository
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error('duplicate'));
    const { result } = renderHook(() => useRepositoryManagement(), { wrapper: createWrapper() });
    act(() => { result.current.setFolderInputPath('C:\source'); });
    await act(async () => { await result.current.handleFolderSubmit(REPOS); });
    expect(result.current.addError).toBe('Added 1 of 2 repositories (1 failed).');
  });

  it('adds new repo to query cache after successful add', async () => {
    const newRepo = { id: 'r2', path: 'C:\source\new-repo', name: 'new-repo', source: 'ui' as const, addedAt: '', lastScannedAt: null, branch: null };
    mockScanFolder.mockResolvedValue([{ path: 'C:\source\new-repo', name: 'new-repo' }]);
    mockAddRepository.mockResolvedValue(newRepo);
    const { result } = renderHook(() => useRepositoryManagement(), { wrapper: createWrapper() });
    act(() => { result.current.setFolderInputPath('C:\source'); });
    await act(async () => { await result.current.handleFolderSubmit(REPOS); });
    expect(mockAddRepository).toHaveBeenCalledWith('C:\source\new-repo');
  });

  it('clearAddInfo clears addInfo', async () => {
    mockScanFolder.mockResolvedValue([]);
    const { result } = renderHook(() => useRepositoryManagement(), { wrapper: createWrapper() });
    act(() => { result.current.setFolderInputPath('C:\source'); });
    await act(async () => { await result.current.handleFolderSubmit(REPOS); });
    expect(result.current.addInfo).not.toBeNull();
    act(() => { result.current.clearAddInfo(); });
    expect(result.current.addInfo).toBeNull();
  });
});

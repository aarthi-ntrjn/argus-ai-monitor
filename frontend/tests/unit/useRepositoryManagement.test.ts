import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRepositoryManagement } from '../../src/hooks/useRepositoryManagement';

const mockScanFolder = vi.fn();
const mockAddRepository = vi.fn();
const mockInvalidateQueries = vi.fn();

vi.mock('../../src/services/api', () => ({
  scanFolder: (...args: unknown[]) => mockScanFolder(...args),
  addRepository: (...args: unknown[]) => mockAddRepository(...args),
  removeRepository: vi.fn().mockResolvedValue(undefined),
  queryClient: { invalidateQueries: (...args: unknown[]) => mockInvalidateQueries(...args) },
}));

const REPOS = [{ id: 'r1', path: 'C:\source\existing', name: 'existing', source: 'ui' as const, addedAt: '', lastScannedAt: null, branch: null }];

describe('useRepositoryManagement — folder input flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvalidateQueries.mockResolvedValue(undefined);
    localStorage.clear();
  });

  it('handleAddRepo shows the folder input (showFolderInput becomes true)', () => {
    const { result } = renderHook(() => useRepositoryManagement());
    expect(result.current.showFolderInput).toBe(false);
    act(() => { result.current.handleAddRepo(); });
    expect(result.current.showFolderInput).toBe(true);
  });

  it('handleAddRepo resets folderInputPath to empty string', () => {
    const { result } = renderHook(() => useRepositoryManagement());
    act(() => { result.current.setFolderInputPath('old-value'); });
    act(() => { result.current.handleAddRepo(); });
    expect(result.current.folderInputPath).toBe('');
  });

  it('handleFolderSubmit does nothing when folderInputPath is blank', async () => {
    const { result } = renderHook(() => useRepositoryManagement());
    await act(async () => { await result.current.handleFolderSubmit(REPOS); });
    expect(mockScanFolder).not.toHaveBeenCalled();
  });

  it('handleFolderSubmit calls scanFolder with trimmed path', async () => {
    mockScanFolder.mockResolvedValue([]);
    const { result } = renderHook(() => useRepositoryManagement());
    act(() => { result.current.setFolderInputPath('  C:\source  '); });
    await act(async () => { await result.current.handleFolderSubmit(REPOS); });
    expect(mockScanFolder).toHaveBeenCalledWith('C:\source');
  });

  it('handleFolderSubmit keeps the dialog open after scanning', async () => {
    mockScanFolder.mockResolvedValue([]);
    const { result } = renderHook(() => useRepositoryManagement());
    act(() => {
      result.current.handleAddRepo();
      result.current.setFolderInputPath('C:\source');
    });
    expect(result.current.showFolderInput).toBe(true);
    await act(async () => { await result.current.handleFolderSubmit(REPOS); });
    expect(result.current.showFolderInput).toBe(true);
    expect(result.current.scanResult).toEqual({ added: 0, failed: 0, total: 0 });
  });

  it('sets scanResult when no new repos are found', async () => {
    mockScanFolder.mockResolvedValue([{ path: 'C:\source\existing', name: 'existing' }]);
    const { result } = renderHook(() => useRepositoryManagement());
    act(() => { result.current.setFolderInputPath('C:\source'); });
    await act(async () => { await result.current.handleFolderSubmit(REPOS); });
    expect(result.current.scanResult).toEqual({ added: 0, failed: 0, total: 0 });
    expect(mockAddRepository).not.toHaveBeenCalled();
  });

  it('calls addRepository for each new repo and populates scanResult', async () => {
    mockScanFolder.mockResolvedValue([
      { path: 'C:\source\new-a', name: 'new-a' },
      { path: 'C:\source\new-b', name: 'new-b' },
    ]);
    mockAddRepository.mockResolvedValue({});
    const { result } = renderHook(() => useRepositoryManagement());
    act(() => { result.current.setFolderInputPath('C:\source'); });
    await act(async () => { await result.current.handleFolderSubmit(REPOS); });
    expect(mockAddRepository).toHaveBeenCalledTimes(2);
    expect(result.current.scanResult).toEqual({ added: 2, failed: 0, total: 2 });
    expect(result.current.addError).toBeNull();
  });

  it('skips already-registered repos and only adds new ones', async () => {
    mockScanFolder.mockResolvedValue([
      { path: 'C:\source\existing', name: 'existing' },
      { path: 'C:\source\new-one', name: 'new-one' },
    ]);
    mockAddRepository.mockResolvedValue({});
    const { result } = renderHook(() => useRepositoryManagement());
    act(() => { result.current.setFolderInputPath('C:\source'); });
    await act(async () => { await result.current.handleFolderSubmit(REPOS); });
    expect(mockAddRepository).toHaveBeenCalledTimes(1);
    expect(mockAddRepository).toHaveBeenCalledWith('C:\source\new-one');
  });

  it('sets addError when scanFolder throws', async () => {
    mockScanFolder.mockRejectedValue(new Error('Path not found'));
    const { result } = renderHook(() => useRepositoryManagement());
    act(() => { result.current.setFolderInputPath('C:\bad\path'); });
    await act(async () => { await result.current.handleFolderSubmit(REPOS); });
    expect(result.current.addError).toBe('Path not found');
    expect(result.current.adding).toBe(false);
  });

  it('reports partial failure in scanResult when some addRepository calls fail', async () => {
    mockScanFolder.mockResolvedValue([
      { path: 'C:\source\ok', name: 'ok' },
      { path: 'C:\source\bad', name: 'bad' },
    ]);
    mockAddRepository
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error('duplicate'));
    const { result } = renderHook(() => useRepositoryManagement());
    act(() => { result.current.setFolderInputPath('C:\source'); });
    await act(async () => { await result.current.handleFolderSubmit(REPOS); });
    expect(result.current.scanResult).toEqual({ added: 1, failed: 1, total: 2 });
    expect(result.current.addError).toBeNull();
  });
});

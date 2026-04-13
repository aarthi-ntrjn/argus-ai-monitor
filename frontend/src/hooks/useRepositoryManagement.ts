import { useState } from 'react';
import { addRepository, removeRepository, scanFolder, queryClient } from '../services/api';
import type { Repository } from '../types';

const SKIP_REMOVE_CONFIRM_KEY = 'argus:skipRemoveConfirm';

export interface ScanResult {
  added: number;
  failed: number;
  total: number;
}

export interface RepositoryManagement {
  addError: string | null;
  adding: boolean;
  scanning: boolean;
  scanResult: ScanResult | null;
  showFolderInput: boolean;
  folderInputPath: string;
  removeConfirmId: string | null;
  removing: boolean;
  skipConfirm: boolean;
  setFolderInputPath: (path: string) => void;
  setRemoveConfirmId: (id: string | null) => void;
  setSkipConfirm: (val: boolean) => void;
  handleAddRepo: () => void;
  handleFolderSubmit: (repos: Repository[]) => Promise<void>;
  handleRemoveRepoById: (id: string) => Promise<void>;
  handleRemoveRepo: () => Promise<void>;
  dismissDialog: () => void;
  resetScanState: () => void;
  clearAddError: () => void;
}

export function useRepositoryManagement(): RepositoryManagement {
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [showFolderInput, setShowFolderInput] = useState(false);
  const [folderInputPath, setFolderInputPath] = useState('');
  const [removeConfirmId, setRemoveConfirmId] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [skipConfirm, setSkipConfirmRaw] = useState(() => localStorage.getItem(SKIP_REMOVE_CONFIRM_KEY) === 'true');

  const dismissDialog = () => {
    setShowFolderInput(false);
    setFolderInputPath('');
    setScanResult(null);
    setAddError(null);
  };

  const resetScanState = () => {
    setAddError(null);
    setScanResult(null);
  };

  const handleAddRepo = () => {
    setAddError(null);
    setScanResult(null);
    setFolderInputPath('');
    setShowFolderInput(true);
  };

  const handleFolderSubmit = async (repos: Repository[]) => {
    const folderPath = folderInputPath.trim();
    if (!folderPath) return;
    setAddError(null);
    setScanResult(null);
    setScanning(true);
    setAdding(true);
    try {
      const found = await scanFolder(folderPath);
      const registeredPaths = new Set(repos.map(r => r.path));
      const newRepos = found.filter(r => !registeredPaths.has(r.path));
      if (newRepos.length === 0) {
        setScanResult({ added: 0, failed: 0, total: 0 });
        return;
      }
      let added = 0;
      let failed = 0;
      for (const repo of newRepos) {
        try {
          await addRepository(repo.path);
          added++;
        } catch {
          failed++;
        }
      }
      await queryClient.invalidateQueries({ queryKey: ['repositories'] });
      setScanResult({ added, failed, total: newRepos.length });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to scan folder';
      setAddError(msg);
    } finally {
      setScanning(false);
      setAdding(false);
    }
  };

  const handleRemoveRepoById = async (id: string) => {
    setRemoving(true);
    try {
      await removeRepository(id);
      await queryClient.invalidateQueries({ queryKey: ['repositories'] });
      await queryClient.invalidateQueries({ queryKey: ['sessions'] });
    } finally {
      setRemoving(false);
      setRemoveConfirmId(null);
    }
  };

  const setSkipConfirm = (val: boolean) => {
    setSkipConfirmRaw(val);
    localStorage.setItem(SKIP_REMOVE_CONFIRM_KEY, String(val));
  };

  return {
    addError,
    adding,
    scanning,
    scanResult,
    showFolderInput,
    folderInputPath,
    removeConfirmId,
    removing,
    skipConfirm,
    setFolderInputPath,
    setRemoveConfirmId,
    setSkipConfirm,
    handleAddRepo,
    handleFolderSubmit,
    handleRemoveRepoById,
    handleRemoveRepo: () => handleRemoveRepoById(removeConfirmId!),
    dismissDialog,
    resetScanState,
    clearAddError: () => setAddError(null),
  };
}

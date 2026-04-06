import { useState } from 'react';
import { addRepository, removeRepository, pickFolder, scanFolder, queryClient } from '../services/api';
import type { Repository } from '../types';

const SKIP_REMOVE_CONFIRM_KEY = 'argus:skipRemoveConfirm';

export interface RepositoryManagement {
  addError: string | null;
  addInfo: string | null;
  adding: boolean;
  removeConfirmId: string | null;
  removing: boolean;
  skipConfirm: boolean;
  setRemoveConfirmId: (id: string | null) => void;
  setSkipConfirm: (val: boolean) => void;
  handleAddRepo: (repos: Repository[]) => Promise<void>;
  handleRemoveRepoById: (id: string) => Promise<void>;
  handleRemoveRepo: () => Promise<void>;
  clearAddError: () => void;
  clearAddInfo: () => void;
}

export function useRepositoryManagement(): RepositoryManagement {
  const [addError, setAddError] = useState<string | null>(null);
  const [addInfo, setAddInfo] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [removeConfirmId, setRemoveConfirmId] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [skipConfirm, setSkipConfirmRaw] = useState(() => localStorage.getItem(SKIP_REMOVE_CONFIRM_KEY) === 'true');

  const showInfo = (msg: string) => {
    setAddInfo(msg);
    setTimeout(() => setAddInfo(null), 5000);
  };

  const handleAddRepo = async (repos: Repository[]) => {
    setAddError(null);
    setAddInfo(null);
    setAdding(true);
    try {
      const folderPath = await pickFolder();
      if (!folderPath) return;
      const found = await scanFolder(folderPath);
      const registeredPaths = new Set(repos.map(r => r.path));
      const newRepos = found.filter(r => !registeredPaths.has(r.path));
      if (newRepos.length === 0) {
        showInfo('No new git repositories found in the selected folder.');
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
      if (failed === 0) {
        showInfo(`Added ${added} repositor${added === 1 ? 'y' : 'ies'}.`);
      } else {
        setAddError(`Added ${added} of ${newRepos.length} repositories (${failed} failed).`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add repository';
      setAddError(msg);
    } finally {
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
    addInfo,
    adding,
    removeConfirmId,
    removing,
    skipConfirm,
    setRemoveConfirmId,
    setSkipConfirm,
    handleAddRepo,
    handleRemoveRepoById,
    handleRemoveRepo: () => handleRemoveRepoById(removeConfirmId!),
    clearAddError: () => setAddError(null),
    clearAddInfo: () => setAddInfo(null),
  };
}

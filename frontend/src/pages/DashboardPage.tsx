import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { getRepositories, getSessions, addRepository, removeRepository, apiFetch, queryClient } from '../services/api';
import type { Repository, Session } from '../types';
import SessionCard from '../components/SessionCard/SessionCard';
import { FolderBrowser } from '../components/FolderBrowser';

interface RepoWithSessions extends Repository {
  sessions: Session[];
}

interface ScannedRepo {
  name: string;
  path: string;
  selected: boolean;
}

export default function DashboardPage() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [addTab, setAddTab] = useState<'single' | 'scan'>('single');
  const [newRepoPath, setNewRepoPath] = useState('');
  const [showBrowser, setShowBrowser] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [removeConfirmId, setRemoveConfirmId] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);

  // Scan tab state
  const [scanPath, setScanPath] = useState('');
  const [showScanBrowser, setShowScanBrowser] = useState(false);
  const [scannedRepos, setScannedRepos] = useState<ScannedRepo[]>([]);
  const [scanning, setScanning] = useState(false);

  const { data: repos = [], isLoading: reposLoading } = useQuery({
    queryKey: ['repositories'],
    queryFn: getRepositories,
  });

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery({
    queryKey: ['sessions'],
    queryFn: () => getSessions(),
  });

  const reposWithSessions: RepoWithSessions[] = repos.map((repo) => ({
    ...repo,
    sessions: sessions.filter((s) => s.repositoryId === repo.id),
  }));

  const handleAddRepo = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    setAddError(null);
    try {
      await addRepository(newRepoPath);
      await queryClient.invalidateQueries({ queryKey: ['repositories'] });
      setShowAddModal(false);
      setNewRepoPath('');
      setShowBrowser(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add repository';
      setAddError(msg);
    } finally {
      setAdding(false);
    }
  };

  const handleScan = async () => {
    if (!scanPath) return;
    setScanning(true);
    try {
      const result = await apiFetch<{ scannedPath: string; repos: { name: string; path: string }[] }>(
        `/fs/scan?path=${encodeURIComponent(scanPath)}`
      );
      setScannedRepos(result.repos.map(r => ({ ...r, selected: true })));
    } catch {
      setAddError('Failed to scan directory');
    } finally {
      setScanning(false);
    }
  };

  const handleAddSelected = async () => {
    setAdding(true);
    setAddError(null);
    const selected = scannedRepos.filter(r => r.selected);
    try {
      for (const repo of selected) {
        await addRepository(repo.path);
      }
      await queryClient.invalidateQueries({ queryKey: ['repositories'] });
      setShowAddModal(false);
      setScannedRepos([]);
      setScanPath('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add repositories';
      setAddError(msg);
    } finally {
      setAdding(false);
    }
  };

  const closeModal = () => {
    setShowAddModal(false);
    setNewRepoPath('');
    setShowBrowser(false);
    setAddError(null);
    setAddTab('single');
    setScanPath('');
    setScannedRepos([]);
    setShowScanBrowser(false);
  };

  const handleRemoveRepo = async () => {
    if (!removeConfirmId) return;
    setRemoving(true);
    try {
      await removeRepository(removeConfirmId);
      await queryClient.invalidateQueries({ queryKey: ['repositories'] });
      await queryClient.invalidateQueries({ queryKey: ['sessions'] });
    } finally {
      setRemoving(false);
      setRemoveConfirmId(null);
    }
  };

  if (reposLoading || sessionsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-gray-200 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Argus Dashboard</h1>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Add Repository
          </button>
        </div>

        {reposWithSessions.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <p className="text-xl">No repositories registered.</p>
            <p className="mt-2">Click "Add Repository" to get started.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {reposWithSessions.map((repo) => (
              <div key={repo.id} className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">{repo.name}</h2>
                    <p className="text-sm text-gray-500 mt-1">{repo.path}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="bg-blue-100 text-blue-800 text-sm px-2 py-1 rounded">
                      {repo.sessions.length} session{repo.sessions.length !== 1 ? 's' : ''}
                    </span>
                    <button
                      onClick={() => setRemoveConfirmId(repo.id)}
                      title="Remove repository"
                      className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
                {repo.sessions.length === 0 ? (
                  <p className="text-gray-400 text-sm">No active sessions</p>
                ) : (
                  <div className="space-y-2">
                    {repo.sessions.map((session) => (
                      <SessionCard key={session.id} session={session} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-semibold mb-4">Add Repository</h2>

            {/* Tabs */}
            <div className="flex border-b mb-4">
              <button
                className={`px-4 py-2 text-sm font-medium ${addTab === 'single' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                onClick={() => setAddTab('single')}
              >
                Single
              </button>
              <button
                className={`px-4 py-2 text-sm font-medium ${addTab === 'scan' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                onClick={() => setAddTab('scan')}
              >
                Scan Folder
              </button>
            </div>

            {addTab === 'single' && (
              <form onSubmit={handleAddRepo}>
                <div className="mb-3">
                  <button
                    type="button"
                    onClick={() => setShowBrowser(!showBrowser)}
                    className="text-sm text-blue-600 hover:underline mb-2"
                  >
                    {showBrowser ? 'Hide browser' : 'Browse…'}
                  </button>
                  {showBrowser && (
                    <div className="border rounded mb-3 max-h-64 overflow-y-auto">
                      <FolderBrowser onSelect={(p) => { setNewRepoPath(p); setShowBrowser(false); }} />
                    </div>
                  )}
                  <input
                    type="text"
                    value={newRepoPath}
                    onChange={(e) => setNewRepoPath(e.target.value)}
                    placeholder="Enter repository path..."
                    className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                {addError && <p className="text-red-500 text-sm mb-3">{addError}</p>}
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={closeModal} className="px-4 py-2 text-gray-600 hover:text-gray-800">Cancel</button>
                  <button type="submit" disabled={adding || !newRepoPath} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50">
                    {adding ? 'Adding...' : 'Add'}
                  </button>
                </div>
              </form>
            )}

            {addTab === 'scan' && (
              <div>
                <div className="mb-3">
                  <button
                    type="button"
                    onClick={() => setShowScanBrowser(!showScanBrowser)}
                    className="text-sm text-blue-600 hover:underline mb-2"
                  >
                    {showScanBrowser ? 'Hide browser' : 'Browse for folder…'}
                  </button>
                  {showScanBrowser && (
                    <div className="border rounded mb-3 max-h-64 overflow-y-auto">
                      <FolderBrowser onSelect={(p) => { setScanPath(p); setShowScanBrowser(false); }} />
                    </div>
                  )}
                  {scanPath && <p className="text-sm text-gray-600 mb-2">Selected: <span className="font-mono">{scanPath}</span></p>}
                  <button
                    type="button"
                    onClick={handleScan}
                    disabled={!scanPath || scanning}
                    className="bg-gray-100 text-gray-800 px-4 py-2 rounded hover:bg-gray-200 disabled:opacity-50"
                  >
                    {scanning ? 'Scanning...' : 'Scan'}
                  </button>
                </div>

                {scannedRepos.length > 0 && (
                  <div className="mb-3">
                    <p className="text-sm text-gray-600 mb-2">Found {scannedRepos.length} git repositories:</p>
                    <ul className="border rounded divide-y max-h-48 overflow-y-auto">
                      {scannedRepos.map((repo, i) => (
                        <li key={repo.path} className="flex items-center gap-2 px-3 py-2">
                          <input
                            type="checkbox"
                            checked={repo.selected}
                            onChange={(e) => {
                              const updated = [...scannedRepos];
                              updated[i] = { ...repo, selected: e.target.checked };
                              setScannedRepos(updated);
                            }}
                          />
                          <span className="text-sm font-mono truncate" title={repo.path}>{repo.name}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {addError && <p className="text-red-500 text-sm mb-3">{addError}</p>}
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={closeModal} className="px-4 py-2 text-gray-600 hover:text-gray-800">Cancel</button>
                  {scannedRepos.length > 0 && (
                    <button
                      type="button"
                      onClick={handleAddSelected}
                      disabled={adding || scannedRepos.filter(r => r.selected).length === 0}
                      className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                      {adding ? 'Adding...' : `Add Selected (${scannedRepos.filter(r => r.selected).length})`}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {removeConfirmId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm">
            <h2 className="text-lg font-semibold mb-2">Remove Repository</h2>
            <p className="text-gray-600 text-sm mb-4">
              Remove <span className="font-semibold">{reposWithSessions.find(r => r.id === removeConfirmId)?.name}</span>?
              This will also delete all associated sessions and output history.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setRemoveConfirmId(null)}
                disabled={removing}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRemoveRepo}
                disabled={removing}
                className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:opacity-50"
              >
                {removing ? 'Removing...' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
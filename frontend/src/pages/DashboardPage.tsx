import { useQuery } from '@tanstack/react-query';
import { useRef, useState, useEffect } from 'react';
import { getRepositories, getSessions, addRepository, removeRepository, pickFolder, scanFolder, queryClient } from '../services/api';
import type { Repository, Session } from '../types';
import { useSettings } from '../hooks/useSettings';
import { SettingsPanel } from '../components/SettingsPanel';
import SessionCard from '../components/SessionCard/SessionCard';
import OutputPane from '../components/OutputPane/OutputPane';
import { isInactive } from '../utils/sessionUtils';

interface RepoWithSessions extends Repository {
  sessions: Session[];
}

const SKIP_REMOVE_CONFIRM_KEY = 'argus:skipRemoveConfirm';
const ENDED_STATUSES = new Set(['completed', 'ended']);
const ACTIVE_STATUSES = new Set(['active', 'idle', 'waiting', 'error']);

export default function DashboardPage() {
  const [addError, setAddError] = useState<string | null>(null);
  const [addInfo, setAddInfo] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [removeConfirmId, setRemoveConfirmId] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [skipConfirm, setSkipConfirm] = useState(() => localStorage.getItem(SKIP_REMOVE_CONFIRM_KEY) === 'true');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  const [settings, updateSetting] = useSettings();

  const showInfo = (msg: string) => {
    setAddInfo(msg);
    setTimeout(() => setAddInfo(null), 5000);
  };

  // Close settings panel on outside click or Escape
  useEffect(() => {
    if (!settingsOpen) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSettingsOpen(false); };
    const handleClick = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) setSettingsOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    document.addEventListener('mousedown', handleClick);
    return () => { document.removeEventListener('keydown', handleKey); document.removeEventListener('mousedown', handleClick); };
  }, [settingsOpen]);

  const { data: repos = [], isLoading: reposLoading } = useQuery({
    queryKey: ['repositories'],
    queryFn: getRepositories,
    refetchInterval: 5000,
  });

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery({
    queryKey: ['sessions'],
    queryFn: () => getSessions(),
    refetchInterval: 5000,
  });

  const reposWithSessions: RepoWithSessions[] = repos.map((repo) => {
    const repoSessions = sessions.filter((s) => s.repositoryId === repo.id);
    const visibleSessions = repoSessions.filter(s => {
      if (settings.hideEndedSessions && ENDED_STATUSES.has(s.status)) return false;
      if (settings.hideInactiveSessions && isInactive(s)) return false;
      return true;
    });
    return { ...repo, sessions: visibleSessions };
  }).filter((repo) => {
    if (!settings.hideReposWithNoActiveSessions) return true;
    // Use raw sessions (independent of hideEndedSessions filter)
    const repoSessions = sessions.filter(s => s.repositoryId === repo.id);
    return repoSessions.some(s => ACTIVE_STATUSES.has(s.status));
  });

  const handleAddRepo = async () => {
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
        setAddError(`Added ${added} of ${newRepos.length} repositories — ${failed} failed.`);
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

  const handleRemoveRepo = () => handleRemoveRepoById(removeConfirmId!);

  if (reposLoading || sessionsLoading) {
    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-gray-200 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className={`mx-auto ${selectedSessionId ? 'max-w-7xl' : 'max-w-4xl'}`}>
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-semibold text-gray-900">Argus Dashboard</h1>
          <div className="flex items-center gap-2">
            <div className="relative" ref={settingsRef}>
              <button
                onClick={() => setSettingsOpen(o => !o)}
                aria-label="Settings"
                title="Settings"
                className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
              {settingsOpen && (
                <SettingsPanel
                  settings={settings}
                  onToggle={(key, value) => updateSetting(key, value)}
                  onClose={() => setSettingsOpen(false)}
                />
              )}
            </div>
            <button
              onClick={handleAddRepo}
              disabled={adding}
              className="bg-blue-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors"
            >
              {adding ? 'Adding...' : 'Add Repository'}
            </button>
          </div>
        </div>

        {addInfo && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded text-green-700 text-sm flex justify-between">
            <span>{addInfo}</span>
            <button onClick={() => setAddInfo(null)} className="ml-4 font-bold">x</button>
          </div>
        )}

        {addError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm flex justify-between">
            <span>{addError}</span>
            <button onClick={() => setAddError(null)} className="ml-4 font-bold">x</button>
          </div>
        )}

        {reposWithSessions.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            {repos.length === 0 ? (
              <>
                <p className="text-xl">No repositories registered.</p>
                <p className="mt-2">Click "Add Repository" to get started.</p>
              </>
            ) : (
              <>
                <p className="text-xl">No repositories to show.</p>
                <p className="mt-2">All repositories are hidden by your current settings.</p>
              </>
            )}
          </div>
        ) : (
          <div className={`flex gap-6 ${selectedSessionId ? 'items-start' : ''}`}>
            {/* Repo/session list */}
            <div className={`space-y-6 ${selectedSessionId ? 'flex-1 min-w-0' : 'w-full'}`}>
              {reposWithSessions.map((repo) => (
                <div key={repo.id} className="bg-white rounded-lg shadow p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900">{repo.name}</h2>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <p className="text-xs text-gray-500 font-mono">{repo.path}</p>
                        {repo.branch && (
                          <span className="inline-flex items-center gap-1 text-xs font-mono text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">⎇ {repo.branch}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded">
                        {repo.sessions.length} session{repo.sessions.length !== 1 ? 's' : ''}
                      </span>
          <button
                        onClick={() => {
                          if (skipConfirm) {
                            setRemoveConfirmId(repo.id);
                            handleRemoveRepoById(repo.id);
                          } else {
                            setRemoveConfirmId(repo.id);
                          }
                        }}
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
                    <p className="text-gray-400 text-sm">
                      {settings.hideEndedSessions ? 'No active sessions' : 'No sessions'}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {repo.sessions.map((session) => (
                        <SessionCard
                          key={session.id}
                          session={session}
                          selected={selectedSessionId === session.id}
                          onSelect={id => setSelectedSessionId(prev => prev === id ? null : id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Output pane */}
            {selectedSessionId && (() => {
              const selectedSession = sessions.find(s => s.id === selectedSessionId);
              return selectedSession ? (
                <div className="w-[640px] shrink-0 sticky top-8 h-[calc(100vh-8rem)]">
                  <OutputPane
                    session={selectedSession}
                    onClose={() => setSelectedSessionId(null)}
                  />
                </div>
              ) : null;
            })()}
          </div>
        )}
      </div>

      {removeConfirmId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm">
            <h2 className="text-lg font-semibold mb-2">Remove Repository</h2>
            <p className="text-gray-600 text-sm mb-4">
              Remove <span className="font-semibold">{reposWithSessions.find(r => r.id === removeConfirmId)?.name}</span>?
              This will also delete all associated sessions and output history.
            </p>
            <div className="flex items-center justify-between mt-4">
              <label className="flex items-center gap-2 text-sm text-gray-500 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={skipConfirm}
                  onChange={e => {
                    setSkipConfirm(e.target.checked);
                    localStorage.setItem(SKIP_REMOVE_CONFIRM_KEY, String(e.target.checked));
                  }}
                  className="rounded"
                />
                Don't ask again
              </label>
              <div className="flex gap-2">
                <button onClick={() => setRemoveConfirmId(null)} disabled={removing} className="px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50">Cancel</button>
                <button onClick={handleRemoveRepo} disabled={removing} className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:opacity-50">
                  {removing ? 'Removing...' : 'Remove'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}






import { useQuery } from '@tanstack/react-query';
import { useRef, useState, useEffect } from 'react';
import { getSessions, getRepositories } from '../services/api';
import type { Session } from '../types';
import { useSettings } from '../hooks/useSettings';
import { useOnboarding } from '../hooks/useOnboarding';
import { useRepositoryManagement } from '../hooks/useRepositoryManagement';
import { SettingsPanel } from '../components/SettingsPanel';
import { RemoveConfirmDialog } from '../components/RemoveConfirmDialog';
import SessionCard from '../components/SessionCard/SessionCard';
import OutputPane from '../components/OutputPane/OutputPane';
import TodoPanel from '../components/TodoPanel/TodoPanel';
import { isInactive } from '../utils/sessionUtils';
import { OnboardingTour } from '../components/Onboarding';
import { DASHBOARD_TOUR_STEPS } from '../config/dashboardTourSteps';
import type { Repository } from '../types';

interface RepoWithSessions extends Repository {
  sessions: Session[];
}

const ENDED_STATUSES = new Set(['completed', 'ended']);
const ACTIVE_STATUSES = new Set(['active', 'idle', 'waiting', 'error']);

export default function DashboardPage() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  const [settings, updateSetting] = useSettings();
  const { tourStatus, startTour, skipTour, completeTour, resetOnboarding } = useOnboarding();
  const [tourRun, setTourRun] = useState(false);

  const {
    addError, addInfo, adding, removeConfirmId, removing, skipConfirm,
    setRemoveConfirmId, setSkipConfirm,
    handleAddRepo, handleRemoveRepoById, handleRemoveRepo,
    clearAddError, clearAddInfo,
  } = useRepositoryManagement();

  // Auto-launch for first-time users
  useEffect(() => {
    if (tourStatus === 'not_started') {
      startTour('auto');
      setTourRun(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    const repoSessions = sessions.filter(s => s.repositoryId === repo.id);
    return repoSessions.some(s => ACTIVE_STATUSES.has(s.status));
  });

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
      <div className="mx-auto max-w-screen-xl">
        <div className="flex justify-between items-center mb-8">
          <h1 data-tour-id="dashboard-header" className="text-3xl font-semibold text-gray-900">Argus Dashboard</h1>
          <div className="flex items-center gap-2">
            <div className="relative" ref={settingsRef}>
              <button
                data-tour-id="dashboard-settings"
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
                  onRestartTour={() => {
                    setSettingsOpen(false);
                    startTour('manual');
                    setTourRun(true);
                  }}
                  onResetOnboarding={() => {
                    setSettingsOpen(false);
                    resetOnboarding();
                    setTourRun(true);
                  }}
                />
              )}
            </div>
            <button
              data-tour-id="dashboard-add-repo"
              onClick={() => handleAddRepo(repos)}
              disabled={adding}
              className="bg-blue-600 text-white text-xs px-3 py-1.5 rounded hover:bg-blue-700 disabled:opacity-40 transition-colors"
            >
              {adding ? 'Adding...' : 'Add Repository'}
            </button>
          </div>
        </div>

        {addInfo && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded text-green-700 text-sm flex justify-between">
            <span>{addInfo}</span>
            <button onClick={clearAddInfo} className="ml-4 font-bold">x</button>
          </div>
        )}

        {addError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm flex justify-between">
            <span>{addError}</span>
            <button onClick={clearAddError} className="ml-4 font-bold">x</button>
          </div>
        )}

        {reposWithSessions.length === 0 ? (
          <div className="flex gap-6 items-start">
            <div className="flex-1">
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
            </div>
            <div className="w-[400px] shrink-0 sticky top-8">
              <TodoPanel />
            </div>
          </div>
        ) : (
          <div className="flex gap-6 items-start">
            <div className="flex-1 min-w-0 space-y-6">
              {reposWithSessions.map((repo) => (
                <div key={repo.id} data-tour-id="dashboard-repo-card" className="bg-white rounded-lg shadow p-6">
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
                    <div data-tour-id="dashboard-session-card" className="space-y-2">
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

            <div className={`${selectedSessionId ? 'w-[640px]' : 'w-[400px]'} shrink-0 sticky top-8 flex flex-col gap-4${selectedSessionId ? '' : ' h-auto'}`} style={selectedSessionId ? { height: 'calc(100vh - 8rem)' } : undefined}>
              {selectedSessionId && (() => {
                const selectedSession = sessions.find(s => s.id === selectedSessionId);
                return selectedSession ? (
                  <div className="flex-[3] min-h-0">
                    <OutputPane
                      session={selectedSession}
                      onClose={() => setSelectedSessionId(null)}
                    />
                  </div>
                ) : null;
              })()}
              <div className={selectedSessionId ? 'flex-[2] min-h-0 overflow-y-auto' : 'flex-1'}>
                <TodoPanel />
              </div>
            </div>
          </div>
        )}
      </div>

      {removeConfirmId && (
        <RemoveConfirmDialog
          repoName={reposWithSessions.find(r => r.id === removeConfirmId)?.name}
          removing={removing}
          skipConfirm={skipConfirm}
          onSkipConfirmChange={setSkipConfirm}
          onCancel={() => setRemoveConfirmId(null)}
          onConfirm={handleRemoveRepo}
        />
      )}

      <OnboardingTour
        run={tourRun}
        steps={DASHBOARD_TOUR_STEPS}
        onComplete={() => { completeTour(); setTourRun(false); }}
        onSkip={(reason) => { skipTour(reason); setTourRun(false); }}
      />
    </div>
  );
}

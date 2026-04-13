import { useQuery } from '@tanstack/react-query';
import { useRef, useState, useEffect, useMemo } from 'react';
import LaunchDropdown from '../components/LaunchDropdown/LaunchDropdown';
import { useNavigate } from 'react-router-dom';
import { getSessions, getRepositories } from '../services/api';
import type { Repository, Session } from '../types';
import { useSettings } from '../hooks/useSettings';
import { useOnboarding } from '../hooks/useOnboarding';
import { useRepositoryManagement } from '../hooks/useRepositoryManagement';
import { useIsMobile } from '../hooks/useIsMobile';
import { SettingsPanel } from '../components/SettingsPanel';
import { RemoveConfirmDialog } from '../components/RemoveConfirmDialog';
import SessionCard from '../components/SessionCard/SessionCard';
import OutputPane from '../components/OutputPane/OutputPane';
import ArgusLogo from '../components/ArgusLogo';
import TodoPanel from '../components/TodoPanel/TodoPanel';
import MobileNav from '../components/MobileNav/MobileNav';
import { isInactive } from '../utils/sessionUtils';
import { OnboardingTour } from '../components/Onboarding';
import { buildDashboardTourSteps, REPO_CATCH_UP_STEPS } from '../config/dashboardTourSteps';

interface RepoWithSessions extends Repository {
  sessions: Session[];
}

const ENDED_STATUSES = new Set(['completed', 'ended']);
const ACTIVE_STATUSES = new Set(['active', 'waiting', 'error']);

type MobileTab = 'sessions' | 'tasks';

export default function DashboardPage() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [activeMobileTab, setActiveMobileTab] = useState<MobileTab>('sessions');
  const settingsRef = useRef<HTMLDivElement>(null);

  const [settings, updateSetting] = useSettings();
  const { tourStatus, seenRepoSteps, startTour, skipTour, completeTour, markRepoStepsSeen, resetOnboarding } = useOnboarding();
  const [tourRun, setTourRun] = useState(false);
  const [catchUpRun, setCatchUpRun] = useState(false);

  const {
    addError, addInfo, adding, showFolderInput, folderInputPath,
    removeConfirmId, removing, skipConfirm,
    setFolderInputPath, setRemoveConfirmId, setSkipConfirm,
    handleAddRepo, handleFolderSubmit, handleRemoveRepoById, handleRemoveRepo,
    cancelFolderInput, clearAddError, clearAddInfo,
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

  const { data: repos = [], isLoading: reposLoading, isError: reposError } = useQuery({
    queryKey: ['repositories'],
    queryFn: getRepositories,
  });

  const { data: sessions = [], isLoading: sessionsLoading, isError: sessionsError } = useQuery({
    queryKey: ['sessions'],
    queryFn: () => getSessions(),
  });

  const sessionsByRepo = useMemo(() => {
    const map = new Map<string, Session[]>();
    for (const s of sessions) {
      const list = map.get(s.repositoryId) ?? [];
      list.push(s);
      map.set(s.repositoryId, list);
    }
    return map;
  }, [sessions]);

  const tourSteps = useMemo(() => buildDashboardTourSteps(repos.length > 0), [repos.length > 0]);

  // Auto-trigger catch-up mini-tour when repos appear and user hasn't seen repo steps
  useEffect(() => {
    if (repos.length > 0 && !seenRepoSteps && tourStatus !== 'not_started' && !tourRun) {
      setCatchUpRun(true);
    }
  }, [repos.length, seenRepoSteps, tourStatus, tourRun]);

  const reposWithSessions = useMemo<RepoWithSessions[]>(() => repos.map((repo) => {
    const repoSessions = sessionsByRepo.get(repo.id) ?? [];
    const visibleSessions = repoSessions.filter(s => {
      if (settings.hideEndedSessions && ENDED_STATUSES.has(s.status)) return false;
      if (settings.hideInactiveSessions && isInactive(s, settings.restingThresholdMinutes * 60_000)) return false;
      return true;
    });
    return { ...repo, sessions: visibleSessions };
  }).filter((repo) => {
    if (!settings.hideReposWithNoActiveSessions) return true;
    return (sessionsByRepo.get(repo.id) ?? []).some(s => ACTIVE_STATUSES.has(s.status));
  }), [repos, sessionsByRepo, settings]);

  // On mobile tapping a session card navigates to the detail page.
  // On desktop it toggles the inline OutputPane.
  const handleSessionSelect = (id: string) => {
    if (isMobile) {
      navigate(`/sessions/${id}`);
    } else {
      setSelectedSessionId(prev => prev === id ? null : id);
    }
  };

  if (reposLoading || sessionsLoading) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 md:p-8">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-gray-200 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (reposError || sessionsError) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 md:p-8 flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-lg font-medium text-gray-800">Cannot connect to Argus server</p>
          <p className="text-sm text-gray-500">Make sure the backend is running, then refresh the page.</p>
        </div>
      </div>
    );
  }

  // Repo cards list — shared between mobile sessions tab and desktop layout
  const repoList = (
    <div className="space-y-6">
      {reposWithSessions.map((repo) => (
        <div key={repo.id} data-tour-id="dashboard-repo-card" className="bg-white rounded-lg shadow p-4 md:p-6">
          <div className="mb-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg md:text-xl font-semibold text-gray-900">{repo.name}</h2>
              <div className="flex items-center gap-2">
                <span className="bg-gray-100 text-gray-500 text-xs px-2 py-0.5 rounded font-medium">
                  {repo.sessions.length} session{repo.sessions.length !== 1 ? 's' : ''}
                </span>
                <LaunchDropdown repoPath={repo.path} />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    if (skipConfirm) {
                      handleRemoveRepoById(repo.id);
                    } else {
                      setRemoveConfirmId(repo.id);
                    }
                  }}
                  aria-label={`Remove repository ${repo.name}`}
                  title="Remove repository"
                  className="text-gray-500 hover:text-red-500 transition-colors p-2 rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-400"
                >
                  <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <p className="text-xs text-gray-500 font-mono truncate max-w-full">{repo.path}</p>
              {repo.branch && (
                <span className="inline-flex items-center gap-1 text-xs font-mono text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">⎇ {repo.branch}</span>
              )}
            </div>
          </div>
          {repo.sessions.length === 0 ? (
            <p className="text-gray-500 text-sm">
              {settings.hideEndedSessions ? 'No active sessions' : 'No sessions'}
            </p>
          ) : (
            <div data-tour-id="dashboard-session-card" className="space-y-2">
              {repo.sessions.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  selected={!isMobile && selectedSessionId === session.id}
                  onSelect={handleSessionSelect}
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );

  const emptyState = (
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
  );

  return (
    <div className="min-h-screen bg-slate-50 p-4 pb-20 md:p-8 md:pb-8">
      <div className="mx-auto max-w-screen-xl">
        {/* Header */}
        <div className="flex justify-between items-center mb-6 md:mb-8">
          <h1 data-tour-id="dashboard-header" className="flex items-center gap-2 text-2xl md:text-3xl font-semibold text-gray-900">
            <ArgusLogo size={36} />
            Argus
          </h1>
          <div className="flex items-center gap-2">
            <div className="relative" ref={settingsRef}>
              <button
                data-tour-id="dashboard-settings"
                onClick={() => setSettingsOpen(o => !o)}
                aria-label="Settings"
                aria-expanded={settingsOpen}
                aria-haspopup="true"
                title="Settings"
                className="p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400"
              >
                <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
              {settingsOpen && (
                <SettingsPanel
                  settings={settings}
                  onToggle={(key, value) => updateSetting(key, value)}
                  onUpdateThreshold={(m) => updateSetting('restingThresholdMinutes', m)}
                  onRestartTour={() => {
                    setSettingsOpen(false);
                    resetOnboarding();
                    startTour('manual');
                    setTourRun(true);
                  }}
                />
              )}
            </div>
            <button
              data-tour-id="dashboard-add-repo"
              onClick={handleAddRepo}
              disabled={adding}
              className="bg-blue-600 text-white text-xs px-3 py-1.5 rounded hover:bg-blue-700 disabled:opacity-40 transition-colors"
            >
              {adding ? 'Adding...' : 'Add Repository'}
            </button>
          </div>
        </div>

        {addInfo && (
          <div role="status" aria-live="polite" className="mb-4 p-3 bg-green-50 border border-green-200 rounded text-green-700 text-sm flex justify-between">
            <span>{addInfo}</span>
            <button onClick={clearAddInfo} aria-label="Dismiss notification" className="ml-4 font-bold">×</button>
          </div>
        )}

        {addError && (
          <div role="alert" className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm flex justify-between">
            <span>{addError}</span>
            <button onClick={clearAddError} aria-label="Dismiss error" className="ml-4 font-bold">×</button>
          </div>
        )}

        {/* Mobile layout: single column with bottom tab navigation */}
        {isMobile ? (
          <div>
            {activeMobileTab === 'sessions' ? (
              reposWithSessions.length === 0 ? emptyState : repoList
            ) : (
              <TodoPanel />
            )}
          </div>
        ) : (
          /* Desktop layout: two-column */
          reposWithSessions.length === 0 ? (
            <div className="flex gap-6 items-start">
              <div className="flex-1">{emptyState}</div>
              <div className="w-[400px] shrink-0 sticky top-8">
                <TodoPanel />
              </div>
            </div>
          ) : (
            <div className="flex gap-6 items-start">
              <div className="flex-1 min-w-0">
                {repoList}
              </div>
              <div className={`${selectedSessionId ? 'w-[640px]' : 'w-[400px]'} shrink-0 sticky top-8 flex flex-col gap-4${selectedSessionId ? '' : ' h-auto'}`} style={selectedSessionId ? { height: 'calc(100vh - 9rem)' } : undefined}>
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
                <div className={selectedSessionId ? 'flex-[2] min-h-0 overflow-hidden' : 'flex-1'}>
                  <TodoPanel />
                </div>
              </div>
            </div>
          )
        )}
      </div>

      {/* Mobile bottom tab bar */}
      {isMobile && (
        <MobileNav activeTab={activeMobileTab} onTabChange={setActiveMobileTab} />
      )}

      {showFolderInput && (
        <div role="dialog" aria-modal="true" aria-labelledby="folder-dialog-title" className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h2 id="folder-dialog-title" className="text-lg font-semibold mb-1">Add Repositories</h2>
            <p className="text-gray-500 text-sm mb-4">Enter a root folder path to scan for git repositories.</p>
            <input
              autoFocus
              type="text"
              value={folderInputPath}
              onChange={e => setFolderInputPath(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleFolderSubmit(repos); if (e.key === 'Escape') cancelFolderInput(); }}
              placeholder="e.g. C:\source or /home/user/projects"
              aria-label="Repository folder path"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={cancelFolderInput} className="px-4 py-2 text-gray-600 hover:text-gray-800">Cancel</button>
              <button
                onClick={() => handleFolderSubmit(repos)}
                disabled={!folderInputPath.trim()}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-40"
              >
                Scan &amp; Add
              </button>
            </div>
          </div>
        </div>
      )}

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
        steps={tourSteps}
        onComplete={() => { completeTour(); if (repos.length > 0) markRepoStepsSeen(); setTourRun(false); }}
        onSkip={(reason) => { skipTour(reason); if (repos.length > 0) markRepoStepsSeen(); setTourRun(false); }}
      />

      {catchUpRun && (
        <OnboardingTour
          run={catchUpRun}
          steps={REPO_CATCH_UP_STEPS}
          onComplete={() => { markRepoStepsSeen(); setCatchUpRun(false); }}
          onSkip={() => { markRepoStepsSeen(); setCatchUpRun(false); }}
        />
      )}
    </div>
  );
}

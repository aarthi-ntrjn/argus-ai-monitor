import { useQuery } from '@tanstack/react-query';
import { useRef, useState, useEffect, useMemo } from 'react';
import { Plus, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getSessions, getRepositories } from '../services/api';
import { useSettings } from '../hooks/useSettings';
import { useArgusSettings } from '../hooks/useArgusSettings';
import { useIntegrationControl } from '../hooks/useIntegrationControl';
import { useOnboarding } from '../hooks/useOnboarding';
import { useRepositoryManagement } from '../hooks/useRepositoryManagement';
import { useIsMobile } from '../hooks/useIsMobile';
import { Button } from '../components/Button';
import { SettingsPanel } from '../components/SettingsPanel';
import { IntegrationStatusIcon } from '../components/IntegrationStatusIcon';
import { TelemetryBanner } from '../components/TelemetryBanner';
import { RemoveConfirmDialog } from '../components/RemoveConfirmDialog';
import OutputPane from '../components/OutputPane/OutputPane';
import ArgusLogo from '../components/ArgusLogo';
import TodoPanel from '../components/TodoPanel/TodoPanel';
import MobileNav from '../components/MobileNav/MobileNav';
import { isInactive } from '../utils/sessionUtils';
import { OnboardingTour } from '../components/Onboarding';
import { buildDashboardTourSteps, REPO_CATCH_UP_STEPS } from '../config/dashboardTourSteps';
import RepoCard from '../components/RepoCard/RepoCard';
import type { RepoWithSessions } from '../components/RepoCard/RepoCard';
import FolderInputDialog from '../components/FolderInputDialog/FolderInputDialog';
import type { Session } from '../types';

const ENDED_STATUSES = new Set(['completed', 'ended']);
const ACTIVE_STATUSES = new Set(['active', 'waiting', 'error']);

type MobileTab = 'sessions' | 'tasks';

export default function DashboardPage() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    () => localStorage.getItem('selectedSessionId')
  );

  const selectSession = (id: string | null) => {
    setSelectedSessionId(id);
    if (id) localStorage.setItem('selectedSessionId', id);
    else localStorage.removeItem('selectedSessionId');
  };
  const [activeMobileTab, setActiveMobileTab] = useState<MobileTab>('sessions');
  const settingsRef = useRef<HTMLDivElement>(null);

  const [settings, updateSetting] = useSettings();
  const { settings: argusSettings, patchSetting } = useArgusSettings();
  const { teamsRunning, slackRunning, teamsConfigured, slackConfigured, toggle, isPending } = useIntegrationControl();
  const { tourStatus, seenRepoSteps, startTour, skipTour, completeTour, markRepoStepsSeen, resetOnboarding } = useOnboarding();
  const [tourRun, setTourRun] = useState(false);
  const [catchUpRun, setCatchUpRun] = useState(false);

  const handleTelemetryDismiss = (enabled: boolean) => {
    patchSetting({ telemetryEnabled: enabled, telemetryPromptSeen: true });
  };

  const {
    addError, addInfo, adding, showFolderInput, folderInputPath,
    removeConfirmId, removing, skipConfirm,
    setFolderInputPath, setRemoveConfirmId, setSkipConfirm,
    handleAddRepo, handleFolderSubmit, handleRemoveRepoById, handleRemoveRepo,
    cancelFolderInput, clearAddError,
  } = useRepositoryManagement();

  const [infoSnapshot, setInfoSnapshot] = useState<string | null>(null);
  useEffect(() => { if (addInfo) setInfoSnapshot(addInfo); }, [addInfo]);

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
      if (settings.hideInactiveSessions && isInactive(s, (argusSettings?.restingThresholdMinutes ?? 20) * 60_000)) return false;
      return true;
    });
    return { ...repo, sessions: visibleSessions, hasHiddenSessions: visibleSessions.length < repoSessions.length };
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
      selectSession(id);
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
        <RepoCard
          key={repo.id}
          repo={repo}
          skipConfirm={skipConfirm}
          selectedSessionId={selectedSessionId}
          isMobile={isMobile}
          onRemoveById={handleRemoveRepoById}
          onSetRemoveConfirm={setRemoveConfirmId}
          onSelectSession={handleSessionSelect}
        />
      ))}
    </div>
  );

  const emptyState = (
    <div className="text-center py-16">
      {repos.length === 0 ? (
        <div className="space-y-1">
          <p className="text-base text-gray-400">No repositories added yet.</p>
          <p className="text-sm text-gray-400">Click "Add Repository" to start monitoring sessions.</p>
          {argusSettings?.telemetryPromptSeen === false && (
            <div className="mt-6 max-w-lg mx-auto text-left">
              <TelemetryBanner onDismiss={handleTelemetryDismiss} subtle />
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-1">
          <p className="text-base text-gray-400">No repositories to show.</p>
          <p className="text-sm text-gray-400">All repositories are hidden by your current settings.</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Sticky header */}
      <header className="bg-slate-50 border-b border-gray-200">
        <div className="mx-auto max-w-screen-xl px-4 md:px-8 py-3 flex justify-between items-center">
          <h1 data-tour-id="dashboard-header" className="flex items-center gap-2 text-xl font-semibold text-gray-900">
            <ArgusLogo size={28} />
            Argus
          </h1>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-3">
              <IntegrationStatusIcon
                type="teams"
                connected={teamsRunning}
                title={
                  !teamsConfigured
                    ? 'Microsoft Teams: not configured'
                    : teamsRunning
                      ? 'Microsoft Teams: running — click to stop'
                      : 'Microsoft Teams: stopped — click to start'
                }
                onClick={teamsConfigured ? () => toggle('teams') : undefined}
                disabled={isPending}
              />
              <IntegrationStatusIcon
                type="slack"
                connected={slackRunning}
                title={
                  !slackConfigured
                    ? 'Slack: not configured'
                    : slackRunning
                      ? 'Slack: running — click to stop'
                      : 'Slack: stopped — click to start'
                }
                onClick={slackConfigured ? () => toggle('slack') : undefined}
                disabled={isPending}
              />
            </div>
            <div className="relative" ref={settingsRef}>
              <button
                data-tour-id="dashboard-settings"
                onClick={() => setSettingsOpen(o => !o)}
                aria-label="Settings"
                aria-expanded={settingsOpen}
                aria-haspopup="true"
                title="Settings"
                className="icon-btn rounded-md text-gray-500 hover:text-blue-600"
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
                  onRestartTour={() => {
                    setSettingsOpen(false);
                    resetOnboarding();
                    startTour('manual');
                    setTourRun(true);
                  }}
                />
              )}
            </div>
            <div className="relative">
              <Button
                variant="outline"
                data-tour-id="dashboard-add-repo"
                onClick={handleAddRepo}
                disabled={adding}
                className="inline-flex items-center gap-1"
              >
                <Plus size={11} aria-hidden="true" />
                {adding ? 'Adding...' : 'Add Repository'}
              </Button>
              <span
                role="status"
                aria-live="polite"
                className={`absolute right-0 top-full mt-1 inline-flex items-center gap-1 text-xs text-green-600 whitespace-nowrap transition-opacity duration-500 ${addInfo ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
              >
                <Check size={11} aria-hidden="true" />
                {infoSnapshot}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Page content */}
      <div className="mx-auto max-w-screen-xl px-4 py-4 pb-20 md:px-8 md:py-6 md:pb-8">

        {addError && (
          <div role="alert" className="mb-4 px-3 py-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm flex items-center justify-between gap-3">
            <span className="leading-snug">{addError}</span>
            <button onClick={clearAddError} aria-label="Dismiss error" className="icon-btn shrink-0 p-0 leading-none">&times;</button>
          </div>
        )}

        {/* Mobile layout: single column with bottom tab navigation */}
        {isMobile ? (
          <div>
            {activeMobileTab === 'sessions' ? (
              reposWithSessions.length === 0 ? emptyState : repoList
            ) : (
              !settings.hideTodoPanel && <TodoPanel />
            )}
          </div>
        ) : (
          /* Desktop layout: two-column */
          reposWithSessions.length === 0 ? (
            <div className="flex gap-6 items-start">
              <div className="flex-1">{emptyState}</div>
              {!settings.hideTodoPanel && (
                <div className="w-[400px] shrink-0 sticky top-8 flex flex-col" style={{ height: 'calc(100vh - 6rem)' }}>
                  <TodoPanel />
                </div>
              )}
            </div>
          ) : (
            <div className="flex gap-6 items-start">
              <div className="flex-1 min-w-0">
                {repoList}
              </div>
              {(!settings.hideTodoPanel || selectedSessionId) && (
                <div className={`${selectedSessionId ? 'w-[640px]' : 'w-[400px]'} shrink-0 sticky top-8 flex flex-col gap-4`} style={{ height: 'calc(100vh - 6rem)' }}>
                  {selectedSessionId && (() => {
                    const selectedSession = sessions.find(s => s.id === selectedSessionId);
                    return selectedSession ? (
                      <div className={settings.hideTodoPanel ? 'flex-1 min-h-0' : 'flex-[4] min-h-0'}>
                        <OutputPane
                          session={selectedSession}
                          onClose={() => selectSession(null)}
                        />
                      </div>
                    ) : null;
                  })()}
                  {!settings.hideTodoPanel && (
                    <div className={`${selectedSessionId ? 'flex-[1]' : 'flex-1'} min-h-0 overflow-hidden`}>
                      <TodoPanel />
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        )}
      </div>

      {/* Mobile bottom tab bar */}
      {isMobile && (
        <MobileNav activeTab={activeMobileTab} onTabChange={setActiveMobileTab} />
      )}

      {showFolderInput && (
        <FolderInputDialog
          folderInputPath={folderInputPath}
          onPathChange={setFolderInputPath}
          onSubmit={() => handleFolderSubmit(repos)}
          onCancel={cancelFolderInput}
        />
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

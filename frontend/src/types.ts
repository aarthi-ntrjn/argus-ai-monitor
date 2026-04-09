export type SessionType = 'copilot-cli' | 'claude-code';
export type SessionLaunchMode = 'pty' | 'detected';
export type SessionStatus = 'active' | 'idle' | 'waiting' | 'error' | 'completed' | 'ended';
export type PidSource = 'session_registry' | 'pty_registry' | 'lockfile';
export type ControlActionType = 'stop' | 'send_prompt' | 'interrupt';
export type ControlActionStatus = 'pending' | 'sent' | 'completed' | 'failed' | 'not_supported';
export type RepositorySource = 'config' | 'ui';
export type OutputType = 'message' | 'tool_use' | 'tool_result' | 'error' | 'status_change';
export type OutputRole = 'user' | 'assistant';

export interface Repository {
  id: string;
  path: string;
  name: string;
  source: RepositorySource;
  addedAt: string;
  lastScannedAt: string | null;
  branch: string | null;
}

export interface Session {
  id: string;
  repositoryId: string;
  type: SessionType;
  launchMode: SessionLaunchMode | null;
  pid: number | null;
  pidSource: PidSource | null;
  status: SessionStatus;
  startedAt: string;
  endedAt: string | null;
  lastActivityAt: string;
  summary: string | null;
  expiresAt: string | null;
  model: string | null;
}

export interface SessionOutput {
  id: string;
  sessionId: string;
  timestamp: string;
  type: OutputType;
  content: string;
  toolName: string | null;
  role: OutputRole | null;
  sequenceNumber: number;
}

export interface ArgusConfig {
  port: number;
  watchDirectories: string[];
  sessionRetentionHours: number;
  outputRetentionMbPerSession: number;
  autoRegisterRepos: boolean;
}

export interface DashboardSettings {
  hideEndedSessions: boolean;
  hideReposWithNoActiveSessions: boolean;
  hideInactiveSessions: boolean;
}

export const DEFAULT_SETTINGS: DashboardSettings = {
  hideEndedSessions: false,
  hideReposWithNoActiveSessions: false,
  hideInactiveSessions: false,
};

export interface ControlAction {
  id: string;
  sessionId: string;
  type: ControlActionType;
  payload: Record<string, unknown> | null;
  status: ControlActionStatus;
  createdAt: string;
  completedAt: string | null;
  result: string | null;
}

export interface TodoItem {
  id: string;
  userId: string;
  text: string;
  done: boolean;
  createdAt: string;
  updatedAt: string;
}

// Onboarding types

export type DashboardTourStatus = 'not_started' | 'completed' | 'skipped';

export interface DashboardTourState {
  status: DashboardTourStatus;
  completedAt: string | null;
  skippedAt: string | null;
  seenRepoSteps: boolean;
}

export interface SessionHintsState {
  dismissed: string[];
}

export interface OnboardingState {
  schemaVersion: 1;
  userId: string | null;
  dashboardTour: DashboardTourState;
  sessionHints: SessionHintsState;
}

export interface TourStep {
  target: string;
  title: string;
  content: string;
  placement: 'top' | 'bottom' | 'left' | 'right' | 'auto' | 'center';
  disableBeacon?: boolean;
  targetWaitTimeout?: number;
}

export interface ContextualHint {
  id: string;
  label: string;
  ariaLabel: string;
  placement: 'top' | 'bottom' | 'left' | 'right';
}

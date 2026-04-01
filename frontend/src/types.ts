export type SessionType = 'copilot-cli' | 'claude-code';
export type SessionStatus = 'active' | 'idle' | 'waiting' | 'error' | 'completed' | 'ended';
export type ControlActionType = 'stop' | 'send_prompt';
export type ControlActionStatus = 'pending' | 'sent' | 'completed' | 'failed' | 'not_supported';
export type RepositorySource = 'config' | 'ui';
export type OutputType = 'message' | 'tool_use' | 'tool_result' | 'error' | 'status_change';

export interface Repository {
  id: string;
  path: string;
  name: string;
  source: RepositorySource;
  addedAt: string;
  lastScannedAt: string | null;
}

export interface Session {
  id: string;
  repositoryId: string;
  repositoryName?: string;
  repositoryPath?: string;
  type: SessionType;
  pid: number | null;
  status: SessionStatus;
  startedAt: string;
  endedAt: string | null;
  lastActivityAt: string;
  summary: string | null;
  expiresAt: string | null;
}

export interface SessionOutput {
  id: string;
  sessionId: string;
  timestamp: string;
  type: OutputType;
  content: string;
  toolName: string | null;
  sequenceNumber: number;
}

export interface DashboardSettings {
  showEndedSessions: boolean;
}

export const DEFAULT_SETTINGS: DashboardSettings = {
  showEndedSessions: true,
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

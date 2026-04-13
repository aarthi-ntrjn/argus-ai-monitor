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

export interface ClaudeSessionRegistryEntry {
  pid: number;
  sessionId: string;
  cwd: string;
  startedAt: number;
  kind: string;
  entrypoint: string;
}

export interface Session {
  id: string;
  repositoryId: string;
  type: SessionType;
  launchMode: SessionLaunchMode | null;
  pid: number | null;
  hostPid: number | null;
  pidSource: PidSource | null;
  status: SessionStatus;
  startedAt: string;
  endedAt: string | null;
  lastActivityAt: string;
  summary: string | null;
  expiresAt: string | null;
  model: string | null;
  reconciled: boolean;
  yoloMode: boolean | null;
}

export interface SessionOutput {
  id: string;
  sessionId: string;
  timestamp: string;
  type: OutputType;
  content: string;
  toolName: string | null;
  toolCallId: string | null;
  role: OutputRole | null;
  sequenceNumber: number;
}

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

export interface ArgusConfig {
  port: number;
  watchDirectories: string[];
  sessionRetentionHours: number;
  outputRetentionMbPerSession: number;
  autoRegisterRepos: boolean;
  yoloMode: boolean;
}

export interface PendingChoice {
  question: string;
  choices: string[];
}

export interface TeamsConfig {
  enabled: boolean;
  botAppId: string;
  botAppPassword: string;
  channelId: string;
  serviceUrl: string;
  tenantId?: string;
  ownerTeamsUserId: string;
}

export interface TeamsThread {
  id: string;
  sessionId: string;
  teamsThreadId: string;
  teamsChannelId: string;
  currentOutputMessageId: string | null;
  createdAt: string;
}

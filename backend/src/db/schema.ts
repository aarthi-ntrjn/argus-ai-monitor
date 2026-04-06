export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS repositories (
  id TEXT PRIMARY KEY, path TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
  source TEXT NOT NULL CHECK(source IN ('config','ui')),
  added_at TEXT NOT NULL, last_scanned_at TEXT, branch TEXT
);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY, repository_id TEXT NOT NULL REFERENCES repositories(id),
  type TEXT NOT NULL CHECK(type IN ('copilot-cli','claude-code')),
  pid INTEGER, status TEXT NOT NULL, started_at TEXT NOT NULL,
  ended_at TEXT, last_activity_at TEXT NOT NULL, summary TEXT, expires_at TEXT,
  model TEXT
);
CREATE TABLE IF NOT EXISTS session_output (
  id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id),
  timestamp TEXT NOT NULL, type TEXT NOT NULL, content TEXT NOT NULL,
  tool_name TEXT, sequence_number INTEGER NOT NULL, role TEXT
);
CREATE TABLE IF NOT EXISTS control_actions (
  id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id),
  type TEXT NOT NULL, payload TEXT, status TEXT NOT NULL,
  created_at TEXT NOT NULL, completed_at TEXT, result TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_repo ON sessions(repository_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_output_session ON session_output(session_id);
CREATE INDEX IF NOT EXISTS idx_output_seq ON session_output(session_id, sequence_number);
CREATE INDEX IF NOT EXISTS idx_output_type ON session_output(type);
CREATE TABLE IF NOT EXISTS todos (
  id         TEXT    PRIMARY KEY,
  user_id    TEXT    NOT NULL DEFAULT 'default',
  text       TEXT    NOT NULL,
  done       INTEGER NOT NULL DEFAULT 0,
  created_at TEXT    NOT NULL,
  updated_at TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_todos_user ON todos(user_id);
`;

-- Migration 002: Add todos table
-- Applied via runtime schema (schema.ts SCHEMA_SQL) on first getDb() call.
-- This file is a reference record only.

CREATE TABLE IF NOT EXISTS todos (
  id         TEXT    PRIMARY KEY,
  user_id    TEXT    NOT NULL DEFAULT 'default',
  text       TEXT    NOT NULL,
  done       INTEGER NOT NULL DEFAULT 0,
  created_at TEXT    NOT NULL,
  updated_at TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_todos_user ON todos(user_id);

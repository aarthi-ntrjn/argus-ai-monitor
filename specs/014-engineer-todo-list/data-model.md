# Data Model: Engineer Todo List

**Branch**: `014-engineer-todo-list` | **Date**: 2026-04-04

## Entities

### TodoItem

A single reminder entry belonging to an engineer. Stored in the `todos` table in SQLite.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | `TEXT` | PRIMARY KEY | UUID v4, generated on creation |
| `user_id` | `TEXT` | NOT NULL, DEFAULT `'default'` | Owner identifier; `'default'` for single-user v1. Enables future multi-user support without migration. |
| `text` | `TEXT` | NOT NULL, non-empty | The reminder description (1–500 characters) |
| `done` | `INTEGER` | NOT NULL, DEFAULT `0` | Completion flag: `0` = incomplete, `1` = complete |
| `created_at` | `TEXT` | NOT NULL | ISO 8601 UTC timestamp of creation |
| `updated_at` | `TEXT` | NOT NULL | ISO 8601 UTC timestamp of last modification (toggle or text update) |

### SQL Schema

```sql
CREATE TABLE IF NOT EXISTS todos (
  id         TEXT    PRIMARY KEY,
  user_id    TEXT    NOT NULL DEFAULT 'default',
  text       TEXT    NOT NULL,
  done       INTEGER NOT NULL DEFAULT 0,
  created_at TEXT    NOT NULL,
  updated_at TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_todos_user ON todos(user_id);
```

## TypeScript Model

```typescript
export interface TodoItem {
  id: string;
  userId: string;
  text: string;
  done: boolean;
  createdAt: string;
  updatedAt: string;
}
```

## Validation Rules

| Rule | Constraint |
|------|-----------|
| `text` must not be empty | Enforced at API level (400 Bad Request) |
| `text` max length | 500 characters (enforced at API level) |
| `done` is boolean | Mapped `0/1 ↔ false/true` in the DB layer |
| `id` is UUID v4 | Generated server-side using `uuid` package |
| `user_id` | Defaults to `'default'` in v1; passed explicitly in future multi-user |

## State Transitions

```
[created: done=false]
        │
        ▼
  toggle done=true  ──────►  [completed: done=true]
        │                           │
        ◄───────── toggle done=false ┘
        │
        ▼
   [deleted]
```

## Relationships

The `todos` table has **no foreign key relationships** to other tables. Todo items are standalone. This keeps the feature independently deployable and testable.

## Indexing

- `idx_todos_user`: Index on `user_id` for fast per-user listing. Low-cardinality for v1 (all rows share `'default'`), but essential for future multi-user scale.

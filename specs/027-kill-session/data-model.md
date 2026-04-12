# Data Model: Kill Session Button

**Feature**: 027-kill-session
**Date**: 2026-04-12

## Existing Entities (No Changes)

This feature introduces no new data entities. It uses the existing `Session` and `ControlAction` models without modification.

### Session (existing)

| Field | Type | Notes |
|-------|------|-------|
| id | string | Primary key |
| status | SessionStatus | `active`, `idle`, `waiting`, `error`, `completed`, `ended` |
| pid | number or null | Process ID; null for sessions without detected process |
| launchMode | SessionLaunchMode or null | `pty` or `detected` |
| type | SessionType | `copilot-cli` or `claude-code` |

**Kill button visibility rule**: `pid !== null && status !== 'ended' && status !== 'completed'`

**State transition on kill**: `status` changes from any active state to `ended`, `endedAt` is set.

### ControlAction (existing)

| Field | Type | Notes |
|-------|------|-------|
| id | string | Primary key |
| sessionId | string | References Session |
| type | ControlActionType | `stop` for kill operations |
| status | ControlActionStatus | `pending` -> `completed` or `failed` |
| result | string or null | Error message if failed |

**Created by**: `POST /api/v1/sessions/:id/stop` (existing endpoint)

## New Frontend State (Component-Level)

### useKillSession Hook State

| State | Type | Source |
|-------|------|--------|
| isPending | boolean | React Query `useMutation` |
| isError | boolean | React Query `useMutation` |
| error | Error or null | React Query `useMutation` |
| dialogOpen | boolean | Local `useState` |
| targetSessionId | string or null | Local `useState` |

No persistent storage changes. All new state is transient UI state.

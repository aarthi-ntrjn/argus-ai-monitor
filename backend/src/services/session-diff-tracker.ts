import type { Session } from '../models/index.js';

// Exported so notifiers can type their format callbacks.
export interface SessionChange {
  field: string;
  label: string;
  from: string;
  to: string;
}

type TrackedState = {
  status: string;
  model: string | null;
  yoloMode: boolean | null;
  pid: number | null;
  launchMode: string | null;
};

const TRACKED_FIELDS: { key: keyof TrackedState; label: string }[] = [
  { key: 'status',     label: 'Status' },
  { key: 'model',      label: 'Model'  },
  { key: 'yoloMode',   label: 'Yolo'   },
  { key: 'pid',        label: 'PID'    },
  { key: 'launchMode', label: 'Mode'   },
  // summary is intentionally excluded: it surfaces through the output stream instead
];

function extract(session: Session): TrackedState {
  return {
    status:     session.status,
    model:      session.model,
    yoloMode:   session.yoloMode,
    pid:        session.pid,
    launchMode: session.launchMode,
  };
}

function format(key: keyof TrackedState, value: unknown): string {
  if (value == null) return 'none';
  switch (key) {
    case 'yoloMode':   return value ? 'yes' : 'no';
    case 'launchMode': return value === 'pty' ? 'connected' : 'readonly';
    default: return String(value);
  }
}

/**
 * Tracks the last-posted state for each session and computes diffs.
 * Each notifier owns one instance. This class contains all session diff logic
 * so notifiers are limited to formatting and sending.
 */
export class SessionDiffTracker {
  private readonly baseline = new Map<string, TrackedState>();

  /** Record current session state as the baseline (call after creating a thread). */
  seed(session: Session): void {
    this.baseline.set(session.id, extract(session));
  }

  /** Remove the baseline for a session (call after the session ends). */
  clear(sessionId: string): void {
    this.baseline.delete(sessionId);
  }

  /** Returns true if a baseline has been recorded for this session. */
  hasBaseline(sessionId: string): boolean {
    return this.baseline.has(sessionId);
  }

  /**
   * Computes what changed since the last posted state.
   *
   * Returns null when no baseline exists (e.g. server restart while a session
   * was running). The current state is recorded automatically so the next call
   * will produce a real diff.
   *
   * Returns an empty array when a baseline exists but no tracked field changed.
   *
   * Returns a non-empty array of changes to format and post.
   */
  update(session: Session): SessionChange[] | null {
    const prev = this.baseline.get(session.id);
    const curr = extract(session);

    if (!prev) {
      this.baseline.set(session.id, curr);
      return null;
    }

    const changes: SessionChange[] = [];
    for (const { key, label } of TRACKED_FIELDS) {
      if (prev[key] !== curr[key]) {
        changes.push({ field: key, label, from: format(key, prev[key]), to: format(key, curr[key]) });
      }
    }

    if (changes.length > 0) {
      this.baseline.set(session.id, curr);
    }

    return changes;
  }
}

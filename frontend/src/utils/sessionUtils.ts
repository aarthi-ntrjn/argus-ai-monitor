import type { Session } from '../types';

export const INACTIVE_THRESHOLD_MS = 20 * 60 * 1000;

export function isInactive(session: Session, thresholdMs = INACTIVE_THRESHOLD_MS): boolean {
  if (session.status === 'completed' || session.status === 'ended') return false;
  return Date.now() - new Date(session.lastActivityAt).getTime() > thresholdMs;
}

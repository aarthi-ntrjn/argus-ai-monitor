import type { Session } from '../types';

export const INACTIVE_THRESHOLD_MS = 20 * 60 * 1000;

export function isInactive(session: Session, thresholdMs = INACTIVE_THRESHOLD_MS): boolean {
  if (session.status === 'completed' || session.status === 'ended') return false;
  return Date.now() - new Date(session.lastActivityAt).getTime() > thresholdMs;
}

export interface PendingChoiceItem {
  question: string;
  choices: string[];
  descriptions?: string[];
  header?: string;
}

export interface PendingChoice {
  question: string;
  choices: string[];
  allQuestions?: PendingChoiceItem[];
}


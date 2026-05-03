import { EventEmitter } from 'events';

export interface PendingChoice {
  sessionId: string;
  question: string;
  choices: string[];
}

/**
 * Shared event bus for pending choice (AskUserQuestion) events.
 * Mirrors the outputEvents pattern in output-store.ts.
 *
 * Events:
 *   'session.pending_choice'          (choice: PendingChoice)
 *   'session.pending_choice.resolved' (sessionId: string)
 */
export const pendingChoiceEvents = new EventEmitter();

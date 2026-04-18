import type { SessionOutput } from '../models/index.js';

export interface PendingQuestion {
  question: string;
  choices: string[];
}

export const QUESTION_TOOL_NAMES: readonly string[] = ['AskUserQuestion', 'ask_user'];

/**
 * Finds the most recent unanswered question tool call in an output batch.
 *
 * Returns null if no pending question is found, or if every question tool_use
 * in the batch already has a matching tool_result (i.e. the user already answered).
 *
 * Handles both AskUserQuestion (Claude Code) and ask_user (Copilot) input shapes:
 *   - Flat:   { question: string, choices?: string[] }
 *   - Nested: { questions: [{ question: string, options: [{label, description}][] }] }
 */
export function findPendingQuestion(outputs: SessionOutput[]): PendingQuestion | null {
  const answeredIds = new Set<string>();
  for (const o of outputs) {
    if (o.type === 'tool_result' && o.toolCallId) {
      answeredIds.add(o.toolCallId);
    }
  }

  for (let i = outputs.length - 1; i >= 0; i--) {
    const o = outputs[i];
    if (o.type !== 'tool_use' || !o.toolName || !(QUESTION_TOOL_NAMES as string[]).includes(o.toolName)) continue;
    if (o.toolCallId && answeredIds.has(o.toolCallId)) continue;

    try {
      return parseQuestionInput(JSON.parse(o.content) as Record<string, unknown>);
    } catch {
      return { question: '', choices: [] };
    }
  }
  return null;
}

function parseQuestionInput(parsed: Record<string, unknown>): PendingQuestion {
  const firstQ = Array.isArray(parsed.questions) && parsed.questions.length > 0
    ? parsed.questions[0] as Record<string, unknown>
    : null;

  const question = typeof parsed.question === 'string'
    ? parsed.question
    : typeof firstQ?.question === 'string' ? firstQ.question : '';

  const rawChoices: unknown[] = Array.isArray(parsed.choices)
    ? parsed.choices
    : Array.isArray(parsed.options)
      ? parsed.options
      : Array.isArray(firstQ?.options)
        ? firstQ.options as unknown[]
        : [];

  const choices = rawChoices.map((c) => {
    if (typeof c === 'string') return c;
    if (c && typeof c === 'object' && typeof (c as Record<string, unknown>).label === 'string') {
      return (c as Record<string, unknown>).label as string;
    }
    return null;
  }).filter((c): c is string => c !== null);

  return { question, choices };
}

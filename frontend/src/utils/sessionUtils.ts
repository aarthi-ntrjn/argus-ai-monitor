import type { Session, SessionOutput } from '../types';

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

const CHOICE_TOOL_NAMES = ['ask_user', 'AskUserQuestion'] as const;

export function detectPendingChoice(items: SessionOutput[]): PendingChoice | null {
  let lastResultSeq = -1;
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    if (item.type === 'tool_result' && item.sequenceNumber > lastResultSeq) {
      lastResultSeq = item.sequenceNumber;
    }
    if (item.type === 'tool_use' && item.toolName !== null && (CHOICE_TOOL_NAMES as readonly string[]).includes(item.toolName)) {
      if (lastResultSeq > item.sequenceNumber) return null;
      try {
        const parsed = JSON.parse(item.content) as Record<string, unknown>;

        // AskUserQuestion format: { questions: [{ question, header, options: [{label, description}] }] }
        // ask_user (Copilot) format: { question: string, choices: string[] }
        const rawQs = Array.isArray(parsed.questions) ? parsed.questions as Record<string, unknown>[] : [];
        const allQuestions: PendingChoiceItem[] = rawQs.map((q) => {
          const qText = typeof q.question === 'string' ? q.question : '';
          const rawOpts: unknown[] = Array.isArray(q.options) ? q.options : [];
          const qChoices: string[] = [];
          const qDescriptions: string[] = [];
          for (const c of rawOpts) {
            if (typeof c === 'string') {
              qChoices.push(c);
              qDescriptions.push('');
            } else if (c && typeof c === 'object') {
              const obj = c as Record<string, unknown>;
              if (typeof obj.label === 'string') {
                qChoices.push(obj.label);
                qDescriptions.push(typeof obj.description === 'string' ? obj.description : '');
              }
            }
          }
          const hasDescriptions = qDescriptions.some(d => d !== '');
          return {
            question: qText,
            choices: qChoices,
            ...(hasDescriptions ? { descriptions: qDescriptions } : {}),
            ...(typeof q.header === 'string' ? { header: q.header } : {}),
          };
        });

        let question: string;
        let choices: string[];

        if (allQuestions.length > 0) {
          question = allQuestions[0].question;
          choices = allQuestions[0].choices;
        } else {
          // Flat format fallback
          question = typeof parsed.question === 'string' ? parsed.question : '';
          const rawChoices: unknown[] = Array.isArray(parsed.choices)
            ? parsed.choices
            : Array.isArray(parsed.options) ? parsed.options : [];
          choices = rawChoices.map((c) => {
            if (typeof c === 'string') return c;
            if (c && typeof c === 'object' && typeof (c as Record<string, unknown>).label === 'string') {
              return (c as Record<string, unknown>).label as string;
            }
            return null;
          }).filter((c): c is string => c !== null);
          allQuestions.push({ question, choices });
        }

        return { question, choices, allQuestions };
      } catch {
        return { question: '', choices: [], allQuestions: [] };
      }
    }
  }
  return null;
}

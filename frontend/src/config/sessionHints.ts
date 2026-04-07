import type { ContextualHint } from '../types';

export const SESSION_HINTS: ContextualHint[] = [
  {
    id: 'session-status',
    label: 'This badge shows the current session status — running, resting, waiting, or ended. Status updates automatically in real time.',
    ariaLabel: 'Help: session status indicator',
    placement: 'bottom',
  },
  {
    id: 'session-prompt-bar',
    label: 'Use this bar to send a prompt or control command directly to the AI session — stop it, interrupt it, or send a message.',
    ariaLabel: 'Help: session control and prompt bar',
    placement: 'top',
  },
  {
    id: 'session-output-stream',
    label: 'This panel streams the live output from the AI session as it runs — messages, tool calls, and results appear here.',
    ariaLabel: 'Help: session output stream',
    placement: 'top',
  },
];

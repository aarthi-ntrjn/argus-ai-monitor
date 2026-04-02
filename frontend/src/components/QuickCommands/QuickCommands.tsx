import { useState } from 'react';
import { interruptSession, sendPrompt } from '../../services/api';
import type { Session } from '../../types';

interface Props {
  session: Session;
}

type CommandKey = 'interrupt' | 'exit' | 'merge' | 'pull';

interface QuickCommand {
  key: CommandKey;
  label: string;
  title: string;
  confirmMessage?: string;
}

const BASE_COMMANDS: QuickCommand[] = [
  { key: 'interrupt', label: 'Esc', title: 'Send interrupt (cancel current operation)' },
  { key: 'exit', label: 'Exit', title: 'Exit session (/exit)', confirmMessage: 'Send /exit to close the session?' },
];

const CLAUDE_COMMANDS: QuickCommand[] = [
  { key: 'merge', label: 'Merge', title: 'Merge current branch with main', confirmMessage: 'Merge current branch with main?' },
  { key: 'pull', label: 'Pull latest', title: 'Pull latest changes from main', confirmMessage: 'Pull latest changes from main?' },
];

export default function QuickCommands({ session }: Props) {
  const [pending, setPending] = useState<CommandKey | null>(null);
  const [confirmKey, setConfirmKey] = useState<CommandKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  const commands = session.type === 'claude-code'
    ? [...BASE_COMMANDS, ...CLAUDE_COMMANDS]
    : BASE_COMMANDS;

  const runCommand = async (key: CommandKey) => {
    setError(null);
    setPending(key);
    try {
      if (key === 'interrupt') {
        await interruptSession(session.id);
      } else if (key === 'exit') {
        await sendPrompt(session.id, '/exit');
      } else if (key === 'merge') {
        await sendPrompt(session.id, 'merge current branch with main');
      } else if (key === 'pull') {
        await sendPrompt(session.id, 'pull latest changes from main branch');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Command failed');
    } finally {
      setPending(null);
      setConfirmKey(null);
    }
  };

  const handleClick = (cmd: QuickCommand) => {
    if (cmd.confirmMessage) {
      setConfirmKey(cmd.key);
    } else {
      runCommand(cmd.key);
    }
  };

  return (
    <div className="flex flex-wrap gap-1 items-center">
      {commands.map(cmd => (
        <button
          key={cmd.key}
          onClick={() => handleClick(cmd)}
          disabled={pending !== null}
          title={cmd.title}
          aria-label={cmd.label}
          className="text-xs px-2 py-0.5 rounded border border-gray-300 text-gray-600 hover:border-gray-500 hover:text-gray-800 disabled:opacity-40 transition-colors"
        >
          {pending === cmd.key ? '…' : cmd.label}
        </button>
      ))}

      {confirmKey && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-5 w-full max-w-xs shadow-lg">
            <p className="text-sm text-gray-700 mb-4">
              {commands.find(c => c.key === confirmKey)?.confirmMessage}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmKey(null)}
                className="text-sm px-3 py-1.5 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={() => runCommand(confirmKey)}
                className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <span className="text-xs text-red-500 ml-1">{error}</span>
      )}
    </div>
  );
}

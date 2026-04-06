import { useState, useRef, useEffect, useCallback } from 'react';
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

const ALL_COMMANDS: QuickCommand[] = [
  { key: 'interrupt', label: 'Esc', title: 'Send interrupt (cancel current operation)' },
  { key: 'exit', label: 'Exit', title: 'Exit session (/exit)', confirmMessage: 'Send /exit to close the session?' },
  { key: 'merge', label: 'Merge', title: 'Merge current branch with main', confirmMessage: 'Merge current branch with main?' },
  { key: 'pull', label: 'Pull latest', title: 'Pull latest changes from main', confirmMessage: 'Pull latest changes from main?' },
];

function ConfirmModal({ message, onCancel, onConfirm }: { message: string; onCancel: () => void; onConfirm: () => void }) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { cancelRef.current?.focus(); }, []);
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onCancel();
  }, [onCancel]);
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-message"
      className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50"
      onKeyDown={handleKeyDown}
    >
      <div className="bg-white rounded-lg p-5 w-full max-w-xs shadow-lg">
        <p id="confirm-modal-message" className="text-sm text-gray-700 mb-4">{message}</p>
        <div className="flex justify-end gap-2">
          <button
            ref={cancelRef}
            onClick={onCancel}
            className="text-sm px-3 py-1.5 text-gray-600 hover:text-gray-800 focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SessionPromptBar({ session }: Props) {
  const [prompt, setPrompt] = useState('');
  const [sending, setSending] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmCmd, setConfirmCmd] = useState<QuickCommand | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  // Close dropdown on Escape
  useEffect(() => {
    if (!menuOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [menuOpen]);

  const handleSend = async () => {
    const text = prompt.trim();
    if (!text) return;
    setError(null);
    setSending(true);
    try {
      await sendPrompt(session.id, text);
      setPrompt('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send');
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const runCommand = async (cmd: QuickCommand) => {
    setError(null);
    setMenuOpen(false);
    setConfirmCmd(null);
    setSending(true);
    try {
      if (cmd.key === 'interrupt') {
        await interruptSession(session.id);
      } else if (cmd.key === 'exit') {
        await sendPrompt(session.id, '/exit');
      } else if (cmd.key === 'merge') {
        await sendPrompt(session.id, 'merge current branch with main');
      } else if (cmd.key === 'pull') {
        await sendPrompt(session.id, 'pull latest changes from main branch');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Command failed');
    } finally {
      setSending(false);
    }
  };

  const handleCommandClick = (cmd: QuickCommand) => {
    if (cmd.confirmMessage) {
      setConfirmCmd(cmd);
      setMenuOpen(false);
    } else {
      runCommand(cmd);
    }
  };

  return (
    <div className="mt-2">
      <div className="flex gap-1 items-center">
        {/* Prompt input */}
        <input
          ref={inputRef}
          type="text"
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          aria-label="Send a prompt to this session"
          placeholder="Send a prompt…"
          disabled={sending}
          className="flex-1 text-xs px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-50"
        />

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={sending || !prompt.trim()}
          className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-40 transition-colors"
        >
          {sending ? '…' : 'Send'}
        </button>

        {/* ⋮ Actions dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(o => !o)}
            disabled={sending}
            title="Session actions"
            aria-label="Session actions menu"
            aria-expanded={menuOpen}
            className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-600 hover:border-gray-500 hover:text-gray-800 disabled:opacity-40 transition-colors"
          >
            ⋮
          </button>

          {menuOpen && (
            <div className="absolute right-0 bottom-full mb-1 bg-white border border-gray-200 rounded shadow-lg z-30 min-w-[140px]">
              {ALL_COMMANDS.map(cmd => (
                <button
                  key={cmd.key}
                  onClick={() => handleCommandClick(cmd)}
                  title={cmd.title}
                  className="w-full text-left text-xs px-3 py-2 text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  {cmd.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Inline error */}
      {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}

      {/* Confirm modal */}
      {confirmCmd && (
        <ConfirmModal
          message={confirmCmd.confirmMessage ?? ''}
          onCancel={() => setConfirmCmd(null)}
          onConfirm={() => runCommand(confirmCmd)}
        />
      )}
    </div>
  );
}

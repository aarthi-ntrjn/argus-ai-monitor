import { useState } from 'react';
import type { Session } from '../../types';

interface Props {
  session: Session;
  onStop: () => Promise<void>;
  onSendPrompt: (prompt: string) => Promise<void>;
}

export default function ControlPanel({ session, onStop, onSendPrompt }: Props) {
  const [stopping, setStopping] = useState(false);
  const [sending, setSending] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [error, setError] = useState<string | null>(null);

  const isEnded = session.status === 'ended' || session.status === 'completed';

  const handleStop = async () => {
    if (!window.confirm('Are you sure you want to stop this session?')) return;
    setStopping(true);
    setError(null);
    try {
      await onStop();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop session');
    } finally {
      setStopping(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    setSending(true);
    setError(null);
    try {
      await onSendPrompt(prompt);
      setPrompt('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send prompt');
    } finally {
      setSending(false);
    }
  };

  if (isEnded) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg text-center text-gray-500 text-sm">
        Session has ended — no controls available.
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {error && <p className="text-red-500 text-sm">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          onClick={handleStop}
          disabled={stopping}
          className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:opacity-50 text-sm"
        >
          {stopping ? 'Stopping...' : 'Stop Session'}
        </button>
        <span className="text-sm text-gray-400">Sends SIGTERM to the process</span>
      </div>

      {session.type === 'copilot-cli' ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm text-yellow-700">
          ⚠️ Send prompt is not supported for Copilot CLI sessions in v1.
        </div>
      ) : (
        <form onSubmit={handleSend} className="space-y-2">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Enter prompt to send..."
            rows={3}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={sending || !prompt.trim()}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 text-sm"
          >
            {sending ? 'Sending...' : 'Send Prompt'}
          </button>
        </form>
      )}
    </div>
  );
}

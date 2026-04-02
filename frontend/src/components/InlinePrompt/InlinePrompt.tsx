import { useState, useRef } from 'react';
import { sendPrompt } from '../../services/api';
import type { Session } from '../../types';

interface Props {
  session: Session;
}

export default function InlinePrompt({ session }: Props) {
  const [prompt, setPrompt] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  return (
    <div className="mt-2">
      <div className="flex gap-1">
        <input
          ref={inputRef}
          type="text"
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Send a prompt…"
          disabled={sending}
          className="flex-1 text-xs px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={sending || !prompt.trim()}
          className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-40 transition-colors"
        >
          {sending ? '…' : 'Send'}
        </button>
      </div>
      {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
    </div>
  );
}

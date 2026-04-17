import { useState, useRef } from 'react';
import { sendPrompt, interruptSession } from '../../services/api';
import type { Session } from '../../types';
import { Button } from '../Button';

interface Props {
  session: Session;
}

export default function SessionPromptBar({ session }: Props) {
  const isReadOnly = session.launchMode !== 'pty';
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
      const msg = err instanceof Error ? err.message : '';
      setError(msg === 'Failed to fetch' ? 'Failed to send — server not reachable' : (msg || 'Failed to send'));
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  const handleInterrupt = async () => {
    setError(null);
    try {
      await interruptSession(session.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to interrupt');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      handleInterrupt();
    }
  };

  if (isReadOnly) {
    return (
      <p className="text-xs text-gray-600 italic" title="Start this session with argus launch to enable prompt injection">
        read-only - start with argus launch to send prompts
      </p>
    );
  }

  return (
    <div className="mt-2">
      <div className="flex gap-1 items-center">
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
        <Button
          size="sm"
          onClick={handleSend}
          disabled={sending || !prompt.trim()}
        >
          {sending ? '…' : '↵'}
        </Button>
      </div>
      {error && <p role="alert" className="text-xs text-red-600 mt-0.5">{error}</p>}
    </div>
  );
}

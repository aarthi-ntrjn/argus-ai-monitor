import { useState, useRef } from 'react';
import { CornerDownLeft } from 'lucide-react';
import { sendPrompt, interruptSession } from '../../services/api';
import type { Session } from '../../types';
import { Button } from '../Button';

interface Props {
  session: Session;
}

type ConnectionState = 'readonly' | 'connecting' | 'connected';

export default function SessionPromptBar({ session }: Props) {
  const connectionState: ConnectionState =
    session.launchMode !== 'pty' ? 'readonly' :
    session.ptyConnected === false ? 'connecting' : 'connected';
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

  if (connectionState === 'readonly') {
    return (
      <p className="text-xs text-gray-600 italic" title="Start this session with argus launch to enable prompt injection">
        read-only - start with argus launch to send prompts
      </p>
    );
  }

  const isConnecting = connectionState === 'connecting';

  return (
    <div className="mt-2">
      {isConnecting && (
        <p className="text-xs text-amber-600 italic mb-1">Connecting to session…</p>
      )}
      <div className="flex gap-1 items-center">
        <input
          ref={inputRef}
          type="text"
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          aria-label="Send a prompt to this session"
          placeholder={isConnecting ? 'Connecting…' : 'Send a prompt…'}
          disabled={sending || isConnecting}
          className="flex-1 text-xs px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-50"
        />
        <Button
          size="sm"
          aria-label={sending ? 'Sending…' : 'Send'}
          onClick={handleSend}
          disabled={sending || isConnecting || !prompt.trim()}
          className="inline-flex items-center justify-center"
        >
          <CornerDownLeft size={13} aria-hidden="true" />
        </Button>
      </div>
      {error && <p role="alert" className="text-xs text-red-600 mt-0.5">{error}</p>}
    </div>
  );
}

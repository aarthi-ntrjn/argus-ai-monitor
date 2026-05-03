import { useState, useRef, useImperativeHandle, forwardRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CornerDownLeft } from 'lucide-react';
import { sendPrompt, sendPromptWithChoice, getSessionOutput } from '../../services/api';
import type { Session } from '../../types';
import { Button } from '../Button';
import { usePromptHistory } from '../../hooks/usePromptHistory';

interface Props {
  session: Session;
  customChoiceNumber?: string | null;
  implicitChoiceNumber?: string | null;
  onCustomAnswerSent?: () => void;
  onPromptSent?: () => void;
}

export interface SessionPromptBarHandle {
  focusInput(): void;
}

type ConnectionState = 'readonly' | 'connecting' | 'connected';

const SessionPromptBar = forwardRef<SessionPromptBarHandle, Props>(function SessionPromptBar({ session, customChoiceNumber, implicitChoiceNumber, onCustomAnswerSent, onPromptSent }, ref) {
  const connectionState: ConnectionState =
    session.launchMode !== 'pty' ? 'readonly' :
    session.ptyConnected === false ? 'connecting' : 'connected';
  const [prompt, setPrompt] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    focusInput() { inputRef.current?.focus(); },
  }));

  const { data: outputData } = useQuery({
    queryKey: ['session-output', session.id],
    queryFn: () => getSessionOutput(session.id, { limit: 100 }),
    enabled: connectionState !== 'readonly',
  });

  const history = usePromptHistory(session.id, outputData?.items ?? []);

  const handleSend = async () => {
    const text = prompt.trim();
    if (!text) return;
    setError(null);
    setSending(true);
    try {
      const effectiveChoiceNumber = customChoiceNumber ?? implicitChoiceNumber;
      if (effectiveChoiceNumber) {
        await sendPromptWithChoice(session.id, effectiveChoiceNumber, text);
        onCustomAnswerSent?.();
      } else {
        await sendPrompt(session.id, text);
      }
      history.addEntry(text);
      setPrompt('');
      onPromptSent?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      setError(msg === 'Failed to fetch' ? 'Failed to send — server not reachable' : (msg || 'Failed to send'));
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 0);
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
      void sendPrompt(session.id, '\x1b', { raw: true });
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const next = history.navigateUp(prompt);
      setPrompt(next);
    }
    if (e.key === 'ArrowDown') {
      if (history.isNavigating) {
        e.preventDefault();
        const next = history.navigateDown();
        setPrompt(next);
      }
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
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            aria-label="Send a prompt to this session"
            placeholder={isConnecting ? 'Connecting…' : 'Send a prompt…'}
            disabled={sending || isConnecting}
            className="w-full text-xs px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-50"
            style={history.indicator ? { paddingRight: '3rem' } : undefined}
          />
          {history.indicator && (
            <span
              aria-live="polite"
              className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 tabular-nums"
            >
              {history.indicator}
            </span>
          )}
        </div>
        <Button
          size="sm"
          aria-label={sending ? 'Sending…' : 'Send'}
          onClick={handleSend}
          disabled={sending || isConnecting || !prompt.trim()}
          className="inline-flex items-center justify-center self-stretch"
        >
          <CornerDownLeft size={13} aria-hidden="true" />
        </Button>
      </div>
      {error && <p role="alert" className="text-xs text-red-600 mt-0.5">{error}</p>}
    </div>
  );
});

export default SessionPromptBar;

import { useState, useEffect } from 'react';
import { sendPrompt, rejectTool } from '../../services/api';
import type { Session } from '../../types';
import type { PendingChoice, PendingChoiceItem } from '../../utils/sessionUtils';
import { Button } from '../Button';

interface Props {
  pendingChoice: PendingChoice;
  session: Session;
  idx: number;
  onAdvance: () => void;
}

export default function PendingChoicePanel({ pendingChoice, session, idx, onAdvance }: Props) {
  const questions: PendingChoiceItem[] = pendingChoice.allQuestions ?? [
    { question: pendingChoice.question, choices: pendingChoice.choices },
  ];

  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customAnswer, setCustomAnswer] = useState('');

  useEffect(() => {
    setError(null);
    setSubmitted(false);
    setShowCustomInput(false);
    setCustomAnswer('');
  }, [pendingChoice]);

  const canSend = session.launchMode === 'pty' && session.ptyConnected !== false;
  const showSubmitPanel = questions.length > 1;
  const allSelected = idx >= questions.length;
  const current = questions[Math.min(idx, questions.length - 1)];
  const handleChoice = async (choice: string) => {
    if (!canSend) return;
    setSending(true);
    setError(null);
    try {
      await sendPrompt(session.id, choice);
      onAdvance();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = async () => {
    setSending(true);
    setError(null);
    try {
      await sendPrompt(session.id, '1');
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  const handleCancel = async () => {
    setSending(true);
    setError(null);
    try {
      await sendPrompt(session.id, '2');
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  const handleReject = async () => {
    setSending(true);
    setError(null);
    try {
      await rejectTool(session.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject tool');
    } finally {
      setSending(false);
    }
  };

  const handleCustomSubmit = async () => {
    const text = customAnswer.trim();
    if (!text) return;
    setShowCustomInput(false);
    setCustomAnswer('');
    await handleChoice(text);
  };

  return (
    <div role="alert" className="text-sm mt-2">
      <div className="flex items-center gap-2">
        <span className="font-bold text-red-600">ATTENTION NEEDED</span>
        {questions.length > 1 && (
          <span className="text-xs text-gray-400">
            {Math.min(idx + 1, questions.length)}/{questions.length}
          </span>
        )}
      </div>

      {submitted ? (
        <p className="text-xs text-gray-500 italic mt-1">Answers sent, waiting for Claude...</p>
      ) : allSelected && showSubmitPanel ? (
        <>
          <div className="mt-1 text-gray-700">All questions answered. Confirm?</div>
          <div className="mt-1 flex flex-col gap-1">
            {canSend ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={sending}
                  onClick={e => { e.stopPropagation(); handleSubmit(); }}
                  className="text-left justify-start"
                >
                  1. Done
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={sending}
                  onClick={e => { e.stopPropagation(); handleCancel(); }}
                  className="text-left justify-start"
                >
                  2. Cancel
                </Button>
              </>
            ) : (
              <>
                <div className="text-gray-600">1. Done</div>
                <div className="text-gray-600">2. Cancel</div>
              </>
            )}
          </div>
        </>
      ) : (
        <>
          {current.question && <div className="mt-1 text-gray-800">{current.question}</div>}
          {current.choices.length > 0 && (
            <div className="mt-1 flex flex-col gap-1">
              {current.choices.map((c, i) =>
                canSend ? (
                  <Button
                    key={i}
                    variant="outline"
                    size="sm"
                    disabled={sending}
                    onClick={e => { e.stopPropagation(); handleChoice(String(i + 1)); }}
                    className="text-left flex flex-col items-start h-auto py-1.5"
                  >
                    <span className="font-semibold">{i + 1}. {c}</span>
                    {current.descriptions?.[i] && (
                      <span className="text-xs text-gray-400 font-normal mt-0.5">{current.descriptions[i]}</span>
                    )}
                  </Button>
                ) : (
                  <div key={i} className="text-gray-700">
                    <div className="font-semibold">{i + 1}. {c}</div>
                    {current.descriptions?.[i] && (
                      <div className="text-xs text-gray-400 ml-4">{current.descriptions[i]}</div>
                    )}
                  </div>
                )
              )}

              {canSend && (
                <>
                  {showCustomInput ? (
                    <div className="flex gap-1 mt-0.5" onClick={e => e.stopPropagation()}>
                      <input
                        type="text"
                        value={customAnswer}
                        autoFocus
                        onChange={e => setCustomAnswer(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); handleCustomSubmit(); } if (e.key === 'Escape') { setShowCustomInput(false); } }}
                        className="flex-1 text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
                        placeholder="Type your answer..."
                      />
                      <Button size="sm" variant="primary" disabled={sending || !customAnswer.trim()} onClick={e => { e.stopPropagation(); handleCustomSubmit(); }}>
                        Send
                      </Button>
                      <Button size="sm" variant="ghost" disabled={sending} onClick={e => { e.stopPropagation(); setShowCustomInput(false); }}>
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={sending}
                      onClick={e => { e.stopPropagation(); setShowCustomInput(true); }}
                      className="text-left justify-start"
                    >
                      <span className="font-semibold">{current.choices.length + 1}. Type your own answer</span>
                    </Button>
                  )}
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={sending}
                    onClick={e => { e.stopPropagation(); handleReject(); }}
                    className="text-left justify-start"
                  >
                    <span className="font-semibold">{current.choices.length + 2}. Reject tool</span>
                  </Button>
                </>
              )}
            </div>
          )}
        </>
      )}

      {error && <p className="text-xs text-red-600 mt-0.5">{error}</p>}
    </div>
  );
}

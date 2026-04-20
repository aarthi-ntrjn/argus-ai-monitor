import { useState, useEffect } from 'react';
import { sendPrompt } from '../../services/api';
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

  useEffect(() => {
    setError(null);
    setSubmitted(false);
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
                    onClick={e => { e.stopPropagation(); handleChoice(c); }}
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
            </div>
          )}
        </>
      )}

      {error && <p className="text-xs text-red-600 mt-0.5">{error}</p>}
    </div>
  );
}

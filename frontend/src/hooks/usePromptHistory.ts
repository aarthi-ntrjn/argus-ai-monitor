import { useState, useEffect, useRef } from 'react';
import type { SessionOutput } from '../types';

export interface UsePromptHistoryResult {
  isNavigating: boolean;
  indicator: string | null;
  navigateUp: (currentInput: string) => string;
  navigateDown: () => string;
  addEntry: (text: string) => void;
  resetNavigation: () => void;
}

const HISTORY_CAP = 50;

function isUserMessage(item: SessionOutput): boolean {
  return item.role === 'user' && item.type === 'message' && !item.isMeta && item.content.trim() !== '';
}

export function usePromptHistory(
  _sessionId: string,
  sessionOutputItems: SessionOutput[],
): UsePromptHistoryResult {
  const initialEntries = sessionOutputItems
    .filter(isUserMessage)
    .sort((a, b) => a.sequenceNumber - b.sequenceNumber)
    .map((item) => item.content.trim())
    .slice(-HISTORY_CAP);

  const [entries, setEntries] = useState<string[]>(initialEntries);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);

  const lastSeenSequence = useRef<number>(
    sessionOutputItems.reduce((max, item) => Math.max(max, item.sequenceNumber), 0),
  );
  const pendingBarSends = useRef<Map<string, number>>(new Map());

  // Sync refs immediately — updated in state setters to work correctly across
  // multiple calls within the same act() block in tests.
  const entriesRef = useRef<string[]>(initialEntries);
  const historyIndexRef = useRef<number | null>(null);
  const draftRef = useRef<string>('');

  useEffect(() => {
    const newItems = sessionOutputItems
      .filter(isUserMessage)
      .filter((item) => item.sequenceNumber > lastSeenSequence.current)
      .sort((a, b) => a.sequenceNumber - b.sequenceNumber);

    if (newItems.length === 0) return;

    lastSeenSequence.current = newItems.reduce(
      (max, item) => Math.max(max, item.sequenceNumber),
      lastSeenSequence.current,
    );

    setEntries((prev) => {
      let updated = [...prev];
      for (const item of newItems) {
        const text = item.content.trim();
        const pending = pendingBarSends.current;
        const count = pending.get(text) ?? 0;
        if (count > 0) {
          if (count === 1) {
            pending.delete(text);
          } else {
            pending.set(text, count - 1);
          }
        } else {
          updated = [...updated, text];
        }
      }
      const next = updated.slice(-HISTORY_CAP);
      entriesRef.current = next;
      return next;
    });
  }, [sessionOutputItems]);

  const isNavigating = historyIndex !== null;

  const indicator =
    historyIndex === null ? null : `${historyIndex + 1} / ${entries.length}`;

  function navigateUp(currentInput: string): string {
    const current = entriesRef.current;
    const currentIndex = historyIndexRef.current;

    if (current.length === 0) return currentInput;

    let nextIndex: number;
    if (currentIndex === null) {
      draftRef.current = currentInput;
      nextIndex = 0;
    } else {
      nextIndex = Math.min(currentIndex + 1, current.length - 1);
    }

    historyIndexRef.current = nextIndex;
    setHistoryIndex(nextIndex);
    return current[current.length - 1 - nextIndex] ?? currentInput;
  }

  function navigateDown(): string {
    const current = entriesRef.current;
    const currentIndex = historyIndexRef.current;
    const savedDraft = draftRef.current;

    if (currentIndex === null) return savedDraft;

    if (currentIndex === 0) {
      historyIndexRef.current = null;
      setHistoryIndex(null);
      return savedDraft;
    }

    const nextIndex = currentIndex - 1;
    historyIndexRef.current = nextIndex;
    setHistoryIndex(nextIndex);
    return current[current.length - 1 - nextIndex] ?? savedDraft;
  }

  function addEntry(text: string): void {
    const trimmed = text.trim();
    if (!trimmed) return;

    pendingBarSends.current.set(
      trimmed,
      (pendingBarSends.current.get(trimmed) ?? 0) + 1,
    );

    setEntries((prev) => {
      const next = [...prev, trimmed].slice(-HISTORY_CAP);
      entriesRef.current = next;
      return next;
    });
    historyIndexRef.current = null;
    setHistoryIndex(null);
    draftRef.current = '';
  }

  function resetNavigation(): void {
    historyIndexRef.current = null;
    setHistoryIndex(null);
  }

  return { isNavigating, indicator, navigateUp, navigateDown, addEntry, resetNavigation };
}

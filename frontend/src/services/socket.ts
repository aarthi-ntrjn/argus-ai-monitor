import type { QueryClient } from '@tanstack/react-query';
import type { Session, SessionOutput } from '../types';

type EventHandler = (data: Record<string, unknown>) => void;

const handlers = new Map<string, Set<EventHandler>>();
let ws: WebSocket | null = null;
let reconnectDelay = 1000;
const MAX_DELAY = 30000;
let shouldReconnect = true;

function getWsUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws`;
}

function handleMessage(event: MessageEvent): void {
  try {
    const msg = JSON.parse(event.data as string) as { type: string; data: Record<string, unknown> };
    const typeHandlers = handlers.get(msg.type);
    if (typeHandlers) {
      typeHandlers.forEach((h) => h(msg.data));
    }
    const allHandlers = handlers.get('*');
    if (allHandlers) {
      allHandlers.forEach((h) => h(msg));
    }
  } catch {
    // ignore parse errors
  }
}

export function connect(): void {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

  ws = new WebSocket(getWsUrl());

  ws.onopen = () => {
    reconnectDelay = 1000;
    const connHandlers = handlers.get('connected');
    if (connHandlers) connHandlers.forEach((h) => h({}));
  };

  ws.onmessage = handleMessage;

  ws.onclose = () => {
    ws = null;
    if (shouldReconnect) {
      setTimeout(() => {
        reconnectDelay = Math.min(reconnectDelay * 2, MAX_DELAY);
        connect();
      }, reconnectDelay);
    }
  };

  ws.onerror = () => {
    ws?.close();
  };
}

export function disconnect(): void {
  shouldReconnect = false;
  ws?.close();
  ws = null;
}

export function onEvent(type: string, handler: EventHandler): () => void {
  if (!handlers.has(type)) handlers.set(type, new Set());
  handlers.get(type)!.add(handler);
  return () => handlers.get(type)?.delete(handler);
}

export function initSocketHandlers(qc: QueryClient): void {
  onEvent('session.created', (data) => {
    const session = data as unknown as Session;
    qc.setQueryData<Session[]>(['sessions'], (old) => old ? [...old, session] : [session]);
  });
  onEvent('session.updated', (data) => {
    const session = data as unknown as Session;
    qc.setQueryData<Session[]>(['sessions'], (old) => {
      if (!old) return old;
      return old.map((s) => s.id === session.id ? { ...s, ...session } : s);
    });
  });
  onEvent('session.ended', (data) => {
    const session = data as unknown as Session;
    qc.setQueryData<Session[]>(['sessions'], (old) => {
      if (!old) return old;
      return old.map((s) => s.id === session.id ? { ...s, ...session } : s);
    });
  });
  onEvent('repository.added', () => {
    qc.invalidateQueries({ queryKey: ['repositories'] });
    qc.invalidateQueries({ queryKey: ['sessions'] });
  });
  onEvent('repository.removed', () => {
    qc.invalidateQueries({ queryKey: ['repositories'] });
    qc.invalidateQueries({ queryKey: ['sessions'] });
  });
  onEvent('session.output', (data) => {
    const { sessionId, output } = data as { sessionId: string; output: SessionOutput };
    // Update full output pane cache
    qc.setQueryData<{ items: SessionOutput[]; nextBefore: string | null; total: number }>(
      ['session-output', sessionId],
      (old) => {
        if (!old) return old;
        return { ...old, items: [...old.items, output], total: old.total + 1 };
      }
    );
    // Update SessionCard preview cache (last 10) — keeps per-card polling unnecessary
    qc.setQueryData<{ items: SessionOutput[]; nextBefore: string | null; total: number }>(
      ['session-output-last', sessionId],
      (old) => {
        if (!old) return old;
        const items = [...old.items, output].slice(-10);
        return { ...old, items, total: old.total + 1 };
      }
    );
  });
  onEvent('session.output.batch', (data) => {
    const { sessionId, outputs } = data as { sessionId: string; outputs: SessionOutput[] };
    qc.setQueryData<{ items: SessionOutput[]; nextBefore: string | null; total: number }>(
      ['session-output', sessionId],
      (old) => {
        if (!old) return old;
        return { ...old, items: [...old.items, ...outputs], total: old.total + outputs.length };
      }
    );
    qc.setQueryData<{ items: SessionOutput[]; nextBefore: string | null; total: number }>(
      ['session-output-last', sessionId],
      (old) => {
        if (!old) return old;
        const items = [...old.items, ...outputs].slice(-10);
        return { ...old, items, total: old.total + outputs.length };
      }
    );
  });
  onEvent('session.pending_choice', (data) => {
    const { sessionId, question, choices } = data as { sessionId: string; question: string; choices: string[] };
    qc.setQueryData<import('../utils/sessionUtils').PendingChoice | null>(
      ['session-pending-choice', sessionId],
      { question, choices }
    );
  });
  onEvent('session.pending_choice.resolved', (data) => {
    const { sessionId } = data as { sessionId: string };
    qc.setQueryData<import('../utils/sessionUtils').PendingChoice | null>(
      ['session-pending-choice', sessionId],
      null
    );
  });
}
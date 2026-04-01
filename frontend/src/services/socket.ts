import type { QueryClient } from '@tanstack/react-query';
import type { SessionOutput } from '../types';

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
  onEvent('session.created', () => { qc.invalidateQueries({ queryKey: ['sessions'] }); });
  onEvent('session.updated', () => { qc.invalidateQueries({ queryKey: ['sessions'] }); });
  onEvent('session.ended', () => { qc.invalidateQueries({ queryKey: ['sessions'] }); });
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
    qc.setQueryData<{ items: SessionOutput[]; nextBefore: string | null; total: number }>(
      ['session-output', sessionId],
      (old) => {
        if (!old) return old;
        return {
          ...old,
          items: [...old.items, output],
          total: old.total + 1,
        };
      }
    );
  });
}
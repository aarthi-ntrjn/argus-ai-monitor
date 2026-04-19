import * as logger from '../utils/logger.js';
import { getSession, upsertSession } from '../db/database.js';
import { broadcast } from '../api/ws/event-dispatcher.js';
import type { SessionOutput } from '../models/index.js';

export function applyActivityUpdate(sessionId: string): void {
  const now = new Date().toISOString();
  const active = getSession(sessionId);
  if (!active) return;
  const updated = { ...active, lastActivityAt: now };
  upsertSession(updated);
  broadcast({ type: 'session.updated', timestamp: now, data: updated as unknown as Record<string, unknown> });
}

export function applyModelUpdate(sessionId: string, model: string, tag: string): void {
  const existing = getSession(sessionId);
  if (!existing || existing.model) return;
  logger.info(`${tag} model detected sessionId=${sessionId} model=${model}`);
  const updated = { ...existing, model };
  upsertSession(updated);
  broadcast({ type: 'session.updated', timestamp: new Date().toISOString(), data: updated as unknown as Record<string, unknown> });
}

export function applySummaryUpdate(sessionId: string, outputs: SessionOutput[], tag: string): void {
  const lastUserMsg = [...outputs].reverse().find(
    (o) => o.role === 'user' && o.type === 'message' && !o.isMeta,
  );
  if (!lastUserMsg?.content) return;
  const existing = getSession(sessionId);
  if (!existing) return;
  const summary = lastUserMsg.content.slice(0, 120);
  if (existing.summary === summary) return;
  logger.info(`${tag} summary updated sessionId=${sessionId}`);
  const updated = { ...existing, summary };
  upsertSession(updated);
  broadcast({ type: 'session.updated', timestamp: new Date().toISOString(), data: updated as unknown as Record<string, unknown> });
}

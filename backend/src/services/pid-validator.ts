import psList from 'ps-list';
import { SessionTypes } from '../models/index.js';
import type { SessionType } from '../models/index.js';

export type PidValidationReason = 'process_not_found' | 'process_not_ai_tool';

export interface PidValidationResult {
  valid: boolean;
  reason?: PidValidationReason;
}

export function isAiToolProcess(name: string, sessionType: SessionType): boolean {
  const lower = name.toLowerCase();
  return sessionType === SessionTypes.CLAUDE_CODE ? lower.includes('claude') : lower.includes('copilot');
}

export async function validatePidOwnership(
  pid: number,
  sessionType: SessionType,
): Promise<PidValidationResult> {
  if (!Number.isInteger(pid) || pid <= 0) {
    return { valid: false, reason: 'process_not_found' };
  }

  const processes = await psList();
  const proc = processes.find(p => p.pid === pid);

  if (!proc) {
    return { valid: false, reason: 'process_not_found' };
  }

  if (!isAiToolProcess(proc.name, sessionType)) {
    return { valid: false, reason: 'process_not_ai_tool' };
  }

  return { valid: true };
}

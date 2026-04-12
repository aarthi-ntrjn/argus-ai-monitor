import psList from 'ps-list';

export type PidValidationReason = 'process_not_found' | 'process_not_ai_tool';

export interface PidValidationResult {
  valid: boolean;
  reason?: PidValidationReason;
}

export async function validatePidOwnership(
  pid: number,
  sessionType: 'claude-code' | 'copilot-cli',
): Promise<PidValidationResult> {
  if (!Number.isInteger(pid) || pid <= 0) {
    return { valid: false, reason: 'process_not_found' };
  }

  const processes = await psList();
  const proc = processes.find(p => p.pid === pid);

  if (!proc) {
    return { valid: false, reason: 'process_not_found' };
  }

  const name = proc.name.toLowerCase();

  const isAiTool =
    sessionType === 'claude-code'
      ? name.includes('claude')
      : name.includes('copilot');

  if (!isAiTool) {
    return { valid: false, reason: 'process_not_ai_tool' };
  }

  return { valid: true };
}

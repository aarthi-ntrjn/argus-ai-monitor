import { execSync } from 'child_process';
import { platform } from 'os';
import type { SessionType } from '../models/index.js';

const YOLO_FLAGS: Record<SessionType, string> = {
  'claude-code': '--dangerously-skip-permissions',
  'copilot-cli': '--allow-all',
};

/**
 * Inspect a running process's command line to detect yolo mode flags.
 * Returns true/false if the process was found, null if the command line could not be read.
 */
function detectYoloMode(pid: number, type: SessionType): boolean | null {
  try {
    const cmdLine = getProcessCommandLine(pid);
    if (!cmdLine) return null;
    return cmdLine.includes(YOLO_FLAGS[type]);
  } catch {
    return null;
  }
}

function getProcessCommandLine(pid: number): string | null {
  try {
    if (platform() === 'win32') {
      const out = execSync(
        `powershell -NoProfile -Command "(Get-CimInstance Win32_Process -Filter 'ProcessId = ${pid}' -ErrorAction SilentlyContinue).CommandLine"`,
        { encoding: 'utf-8', timeout: 3000 }
      ).trim();
      return out || null;
    } else {
      const out = execSync(`ps -o args= -p ${pid}`, {
        encoding: 'utf-8',
        timeout: 3000,
      }).trim();
      return out || null;
    }
  } catch {
    return null;
  }
}

/**
 * Get the base process name for the given PID on Windows only.
 * Uses Get-Process (Win32 API, no WMI).
 */
function getProcessName(pid: number): string | null {
  try {
    return execSync(
      `powershell -NoProfile -Command "(Get-Process -Id ${pid} -ErrorAction SilentlyContinue).Name"`,
      { encoding: 'utf-8', timeout: 3000 }
    ).trim() || null;
  } catch {
    return null;
  }
}

function isAiToolCmdLine(cmdLine: string, type: SessionType): boolean {
  const lower = cmdLine.toLowerCase();
  if (type === 'claude-code') return lower.includes('claude');
  // Match the copilot path segment to avoid false positives from strings like
  // "github-copilot-extension". Accepts /usr/local/bin/copilot and C:\...\copilot.exe.
  return /[/\\]copilot(\.exe)?(\s|$)/.test(lower);
}

function isAiToolName(name: string, type: SessionType): boolean {
  const lower = name.toLowerCase();
  if (type === 'claude-code') return lower === 'claude' || lower === 'claude.exe';
  return lower === 'copilot' || lower === 'copilot.exe';
}

/**
 * Guard 3: verify the process at the given PID is the expected AI tool.
 * Fails open (returns true) when the command line cannot be read.
 *
 * On Linux/Mac we use the full command line (ps -o args=) rather than the short
 * kernel name (/proc/pid/comm). The kernel name is useless here: it returns "node"
 * for any Node.js binary regardless of the script being run (e.g. /usr/local/bin/copilot).
 * On Windows we fall back to the short process name from Get-Process because
 * Get-CimInstance CommandLine is slower and less reliable for this check.
 */
export function isExpectedProcess(pid: number, type: SessionType): boolean {
  if (platform() === 'win32') {
    const name = getProcessName(pid);
    if (!name) return true; // cannot verify — fail open
    return isAiToolName(name, type);
  }
  // Linux/Mac: use the full command line — handles node-wrapped binaries like copilot.
  const cmdLine = getProcessCommandLine(pid);
  if (!cmdLine) return true; // cannot verify — fail open
  return isAiToolCmdLine(cmdLine, type);
}


/**
 * Lightweight liveness check using signal 0.
 * EPERM means the process exists but we lack permission (still alive).
 * ESRCH means the process does not exist.
 */
export function isPidRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === 'EPERM';
  }
}

/**
 * Check yolo mode by inspecting multiple PIDs (pid and hostPid).
 * Returns true if any process has the yolo flag, false if a process was found but has no flag,
 * or null if no process command line could be read (process not ready or WMI unavailable).
 */
export function detectYoloModeFromPids(
  pid: number | null,
  hostPid: number | null,
  type: SessionType
): boolean | null {
  let anyFound = false;
  if (hostPid != null) {
    const r = detectYoloMode(hostPid, type);
    if (r === true) return true;
    if (r === false) anyFound = true;
  }
  if (pid != null && pid !== hostPid) {
    const r = detectYoloMode(pid, type);
    if (r === true) return true;
    if (r === false) anyFound = true;
  }
  return anyFound ? false : null;
}


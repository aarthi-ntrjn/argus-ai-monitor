import { execSync } from 'child_process';
import { readFileSync } from 'fs';
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
 * Get the base process name (not full path) for the given PID.
 * Uses /proc/<pid>/comm on Linux (zero-subprocess), ps on Mac, Get-Process on Windows.
 * Returns null if the process cannot be found or the name cannot be read.
 */
function getProcessName(pid: number): string | null {
  try {
    if (platform() === 'linux') {
      try {
        return readFileSync(`/proc/${pid}/comm`, 'utf-8').trim() || null;
      } catch { /* fall through to ps */ }
    }
    if (platform() !== 'win32') {
      return execSync(`ps -o comm= -p ${pid}`, { encoding: 'utf-8', timeout: 3000 }).trim() || null;
    }
    // Windows: Get-Process uses Win32 API directly (no WMI, faster than Get-CimInstance)
    return execSync(
      `powershell -NoProfile -Command "(Get-Process -Id ${pid} -ErrorAction SilentlyContinue).Name"`,
      { encoding: 'utf-8', timeout: 3000 }
    ).trim() || null;
  } catch {
    return null;
  }
}

function isAiToolName(name: string, type: SessionType): boolean {
  const lower = name.toLowerCase();
  if (type === 'claude-code') return lower === 'claude' || lower === 'claude.exe';
  return lower === 'copilot' || lower === 'copilot.exe';
}

/**
 * Guard 3: verify the process at the given PID has the expected name for the session type.
 * Fails open (returns true) when the process name cannot be read, so a missing WMI/proc entry
 * does not incorrectly block a legitimate session.
 */
export function isExpectedProcess(pid: number, type: SessionType): boolean {
  const name = getProcessName(pid);
  if (!name) return true; // cannot verify — fail open rather than blocking a real session
  return isAiToolName(name, type);
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


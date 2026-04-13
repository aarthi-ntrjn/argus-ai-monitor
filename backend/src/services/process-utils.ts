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

export type FocusResult =
  | { focused: true; pid: number }
  | { focused: false; error: 'PROCESS_NOT_FOUND' | 'FOCUS_NOT_SUPPORTED' | 'FOCUS_FAILED'; message: string };

export function focusProcess(pid: number): FocusResult {
  const os = platform();
  try {
    if (os === 'win32') {
      execSync(
        `powershell -NoProfile -Command "Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class WinApi { [DllImport(\\"user32.dll\\")] public static extern bool SetForegroundWindow(IntPtr hWnd); }'; $proc = Get-Process -Id ${pid} -ErrorAction Stop; [WinApi]::SetForegroundWindow($proc.MainWindowHandle)"`,
        { encoding: 'utf-8', timeout: 5000 }
      );
      return { focused: true, pid };
    } else if (os === 'darwin') {
      execSync(
        `osascript -e 'tell application "System Events" to set frontmost of (first process whose unix id is ${pid}) to true'`,
        { encoding: 'utf-8', timeout: 5000 }
      );
      return { focused: true, pid };
    } else {
      try {
        execSync(`wmctrl -ia $(wmctrl -lp | awk -v p=${pid} '$3==p{print $1;exit}')`, { encoding: 'utf-8', timeout: 5000 });
        return { focused: true, pid };
      } catch {
        try {
          execSync(`xdotool search --pid ${pid} windowfocus --sync`, { encoding: 'utf-8', timeout: 5000 });
          return { focused: true, pid };
        } catch {
          return { focused: false, error: 'FOCUS_NOT_SUPPORTED', message: 'wmctrl and xdotool are not available on this system' };
        }
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('Cannot find a process') || msg.includes('No process') || msg.includes('not found')) {
      return { focused: false, error: 'PROCESS_NOT_FOUND', message: `Process ${pid} not found` };
    }
    return { focused: false, error: 'FOCUS_FAILED', message: msg };
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

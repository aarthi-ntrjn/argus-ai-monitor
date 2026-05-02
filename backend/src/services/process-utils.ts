import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { createRequire } from 'module';
import { platform } from 'os';
import { basename } from 'path';
import type { SessionType } from '../models/index.js';

const PLATFORM = platform();

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
    if (PLATFORM === 'win32') {
      const out = execSync(
        `powershell -NoProfile -Command "(Get-CimInstance Win32_Process -Filter 'ProcessId = ${pid}' -ErrorAction SilentlyContinue).CommandLine"`,
        { encoding: 'utf-8', timeout: 3000 }
      ).trim();
      return out || null;
    }
    if (PLATFORM === 'linux') {
      // Direct /proc read — no child-process spawn needed on Linux.
      const raw = readFileSync(`/proc/${pid}/cmdline`);
      return raw.toString('utf8').replace(/\0/g, ' ').trim() || null;
    }
    // macOS: no /proc, fall back to ps.
    const out = execSync(`ps -o args= -p ${pid}`, {
      encoding: 'utf-8',
      timeout: 3000,
    }).trim();
    return out || null;
  } catch {
    return null;
  }
}

// Lazy-initialized Windows-native process name lookup via koffi FFI.
// Avoids spawning a PowerShell process on every scan cycle.
type Win32GetNameFn = (pid: number) => string | null;
let _win32GetName: Win32GetNameFn | null | undefined = undefined;

function initWin32GetName(): Win32GetNameFn | null {
  if (PLATFORM !== 'win32') return null;
  try {
    // Use createRequire so the load is synchronous and any failure is caught here.
    const _require = createRequire(import.meta.url);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const koffi = _require('koffi') as any;
    const kernel32 = koffi.load('kernel32.dll');

    const PROCESS_QUERY_LIMITED_INFORMATION = 0x1000;
    const WCHAR_BUFSIZE = 32767; // supports extended-length paths

    const OpenProcess = kernel32.func(
      'void* __stdcall OpenProcess(uint32 dwDesiredAccess, bool bInheritHandle, uint32 dwProcessId)'
    );
    const CloseHandle = kernel32.func('bool __stdcall CloseHandle(void* hObject)');
    const QueryFullProcessImageNameW = kernel32.func(
      'bool __stdcall QueryFullProcessImageNameW(void* hProcess, uint32 dwFlags, void* lpExeName, _Inout_ uint32* lpdwSize)'
    );

    return (pid: number): string | null => {
      const handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid);
      if (!handle) return null;
      try {
        const buf = Buffer.alloc(WCHAR_BUFSIZE * 2); // 2 bytes per UTF-16 char
        const size = [WCHAR_BUFSIZE]; // in: capacity; out: chars written (excluding NUL)
        const ok = QueryFullProcessImageNameW(handle, 0, buf, size);
        if (!ok || size[0] === 0) return null;
        const fullPath = buf.toString('utf16le', 0, size[0] * 2);
        return basename(fullPath).replace(/\.exe$/i, '');
      } finally {
        CloseHandle(handle);
      }
    };
  } catch {
    return null; // koffi unavailable — isExpectedProcess will fail open
  }
}

function getProcessNameWin32(pid: number): string | null {
  if (_win32GetName === undefined) _win32GetName = initWin32GetName();
  return _win32GetName ? _win32GetName(pid) : null;
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
 * Fails open (returns true) when the process name cannot be read.
 *
 * On Windows: uses koffi FFI to call QueryFullProcessImageNameW directly —
 * sub-millisecond, no child-process spawn.
 * On Linux: reads /proc/<pid>/cmdline — no process spawn needed.
 * On macOS: falls back to spawning ps.
 *
 * The full command line (not just the kernel short name) is used on Linux/Mac
 * because Node.js binaries (e.g. /usr/local/bin/copilot) report as "node" in
 * /proc/pid/comm regardless of the script being run.
 */
export function isExpectedProcess(pid: number, type: SessionType): boolean {
  if (PLATFORM === 'win32') {
    const name = getProcessNameWin32(pid);
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


import { execSync } from 'child_process';
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
      return getProcessCmdLineWin32(pid);
    }
    const out = execSync(`ps -o args= -p ${pid}`, {
      encoding: 'utf-8',
      timeout: 3000,
    }).trim();
    return out || null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Windows-native process introspection via koffi FFI.
// Two independent lazy-init functions so a failure in one does not disable
// the other (e.g. ntdll binding failure must not break name lookup).
// ---------------------------------------------------------------------------

// Win32 BOOL is a 4-byte int, not C bool. Using int32 avoids ABI mismatch on
// any calling convention where size matters (e.g. ia32 stdcall).
const WIN32_BOOL = 'int32';

type Win32Fn<T> = (pid: number) => T;
let _win32GetName: Win32Fn<string | null> | null | undefined = undefined;
let _win32GetCmdLine: Win32Fn<string | null> | null | undefined = undefined;

function initWin32GetName(): Win32Fn<string | null> | null {
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
      `void* __stdcall OpenProcess(uint32 dwDesiredAccess, ${WIN32_BOOL} bInheritHandle, uint32 dwProcessId)`
    );
    const CloseHandle = kernel32.func(`${WIN32_BOOL} __stdcall CloseHandle(void* hObject)`);
    const QueryFullProcessImageNameW = kernel32.func(
      `${WIN32_BOOL} __stdcall QueryFullProcessImageNameW(void* hProcess, uint32 dwFlags, void* lpExeName, _Inout_ uint32* lpdwSize)`
    );

    return (pid: number): string | null => {
      const handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
      if (!handle) return null;
      try {
        const buf = Buffer.alloc(WCHAR_BUFSIZE * 2); // 2 bytes per UTF-16 char
        const size = [WCHAR_BUFSIZE]; // in: capacity; out: chars written (excluding NUL)
        const ok = QueryFullProcessImageNameW(handle, 0, buf, size);
        if (!ok || size[0] === 0) return null;
        const fullPath = buf.toString('utf16le', 0, size[0] * 2);
        // QueryFullProcessImageNameW returns the current on-disk path. During a Copilot CLI
        // auto-update, the updater renames the running binary from copilot.exe to copilot.exe.old
        // (it cannot delete a file that is in use) and drops the new binary as copilot.exe.
        // The process keeps running from the renamed file, so we get "copilot.exe.old" here
        // even though the session is legitimate. Strip .old first, then .exe, so that
        // copilot.exe.old -> copilot.exe -> copilot, matching isAiToolName.
        return basename(fullPath).replace(/\.old$/i, '').replace(/\.exe$/i, '');
      } finally {
        CloseHandle(handle);
      }
    };
  } catch {
    return null; // koffi unavailable — isExpectedProcess will fail open
  }
}

function initWin32GetCmdLine(): Win32Fn<string | null> | null {
  if (PLATFORM !== 'win32') return null;
  try {
    const _require = createRequire(import.meta.url);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const koffi = _require('koffi') as any;
    const kernel32 = koffi.load('kernel32.dll');
    const ntdll = koffi.load('ntdll.dll');

    const PROCESS_QUERY_LIMITED_INFORMATION = 0x1000;
    // UNICODE_STRING header layout on x64: Length(2) + MaxLen(2) + padding(4) + Buffer ptr(8) = 16 bytes.
    // On x86: Length(2) + MaxLen(2) + Buffer ptr(4) = 8 bytes. String data follows immediately after.
    const UNICODE_STRING_HEADER = process.arch === 'ia32' ? 8 : 16;
    // ProcessCommandLineInformation (class 60), available on Windows 8.1+.
    // NtQueryInformationProcess returns a UNICODE_STRING with the full command line copied inline.
    const PROCESS_CMDLINE_INFO = 60;
    const STATUS_SUCCESS = 0;

    const OpenProcess = kernel32.func(
      `void* __stdcall OpenProcess(uint32 dwDesiredAccess, ${WIN32_BOOL} bInheritHandle, uint32 dwProcessId)`
    );
    const CloseHandle = kernel32.func(`${WIN32_BOOL} __stdcall CloseHandle(void* hObject)`);
    const NtQueryInformationProcess = ntdll.func(
      'int32 __stdcall NtQueryInformationProcess(void* ProcessHandle, int32 ProcessInformationClass, void* ProcessInformation, uint32 ProcessInformationLength, _Out_ uint32* ReturnLength)'
    );

    return (pid: number): string | null => {
      const handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
      if (!handle) return null;
      try {
        // Probe call: passing length 0 causes STATUS_INFO_LENGTH_MISMATCH and writes the
        // required buffer size into retLen. A zero retLen means class 60 is unsupported.
        const retLen = [0];
        NtQueryInformationProcess(handle, PROCESS_CMDLINE_INFO, null, 0, retLen);
        const needed = retLen[0];
        if (needed < UNICODE_STRING_HEADER) return null;

        const buf = Buffer.alloc(needed);
        const status = NtQueryInformationProcess(handle, PROCESS_CMDLINE_INFO, buf, needed, retLen);
        if (status !== STATUS_SUCCESS) return null;

        // UNICODE_STRING.Length (offset 0) is the byte length of the string, excluding NUL.
        // The string data starts immediately after the struct header.
        const strBytes = buf.readUInt16LE(0);
        if (strBytes === 0 || UNICODE_STRING_HEADER + strBytes > needed) return null;
        return buf.toString('utf16le', UNICODE_STRING_HEADER, UNICODE_STRING_HEADER + strBytes);
      } finally {
        CloseHandle(handle);
      }
    };
  } catch {
    return null; // koffi or ntdll unavailable
  }
}

function getProcessNameWin32(pid: number): string | null {
  if (_win32GetName === undefined) _win32GetName = initWin32GetName();
  return _win32GetName ? _win32GetName(pid) : null;
}

function getProcessCmdLineWin32(pid: number): string | null {
  if (_win32GetCmdLine === undefined) _win32GetCmdLine = initWin32GetCmdLine();
  if (_win32GetCmdLine) return _win32GetCmdLine(pid);
  // Fall back to PowerShell WMI if koffi/ntdll is unavailable.
  const out = execSync(
    `powershell -NoProfile -Command "(Get-CimInstance Win32_Process -Filter 'ProcessId = ${pid}' -ErrorAction SilentlyContinue).CommandLine"`,
    { encoding: 'utf-8', timeout: 3000 }
  ).trim();
  return out || null;
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


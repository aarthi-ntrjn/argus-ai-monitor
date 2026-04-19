import { useRef, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Terminal, Copy, ChevronDown } from 'lucide-react';
import { ClaudeIcon, CopilotIcon } from '../SessionTypeIcon/SessionTypeIcon';
import { getAvailableTools, launchInTerminal } from '../../services/api';
import { Button } from '../Button';

interface Props {
  repoPath: string;
}

export default function LaunchDropdown({ repoPath }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<'claude' | 'copilot' | null>(null);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [noTerminalCmd, setNoTerminalCmd] = useState<string | null>(null);
  const [cmdCopied, setCmdCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const { data: tools } = useQuery({
    queryKey: ['available-tools'],
    queryFn: getAvailableTools,
    staleTime: 60_000,
  });

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const handleCopy = async (tool: 'claude' | 'copilot') => {
    const base = tool === 'claude' ? tools?.claudeCmd : tools?.copilotCmd;
    // Append --cwd so the command launches in this repo regardless of where it's pasted.
    const cmd = base ? `${base} --cwd "${repoPath}"` : undefined;
    if (!cmd) return;
    try {
      await navigator.clipboard.writeText(cmd);
    } catch {
      // Fallback for environments where the async Clipboard API is denied.
      const el = document.createElement('textarea');
      el.value = cmd;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopied(tool);
    setTimeout(() => setCopied(null), 1500);
    setOpen(false);
  };

  const handleLaunch = async (tool: 'claude' | 'copilot') => {
    setOpen(false);
    // In headless environments (Codespaces, SSH), skip the terminal launch attempt
    // and show the manual command immediately using the cmd from the tools response.
    if (tools?.terminalAvailable === false) {
      const cmd = tool === 'claude' ? tools.claudeCmd : tools.copilotCmd;
      if (cmd) setNoTerminalCmd(`${cmd} --cwd ${repoPath}`);
      return;
    }
    try {
      const { cmd } = await launchInTerminal(tool, repoPath);
      if (cmd) setNoTerminalCmd(cmd);
    } catch (err) {
      setLaunchError(err instanceof Error ? err.message : 'Failed to launch');
    }
  };

  const handleCopyCmd = async () => {
    if (!noTerminalCmd) return;
    try {
      await navigator.clipboard.writeText(noTerminalCmd);
    } catch {
      const el = document.createElement('textarea');
      el.value = noTerminalCmd;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCmdCopied(true);
    setTimeout(() => setCmdCopied(false), 1500);
  };

  const hasAny = tools?.claude || tools?.copilot;

  return (
    <div className="relative" ref={menuRef}>
      {launchError && (
        <p className="text-xs text-red-600 mb-1">{launchError}</p>
      )}
      {noTerminalCmd && (
        <div className="mb-1 p-2 bg-gray-50 border border-gray-200 rounded text-xs">
          <p className="text-gray-600 mb-1">No terminal available. Run manually:</p>
          <div className="flex items-start gap-1">
            <code className="flex-1 break-all text-gray-800 font-mono text-[10px] leading-relaxed">{noTerminalCmd}</code>
            <button
              onClick={handleCopyCmd}
              className="icon-btn shrink-0 text-gray-500 hover:text-gray-700"
              aria-label="Copy command"
              title="Copy command"
            >
              {cmdCopied ? <span className="text-green-600">✓</span> : <Copy size={11} aria-hidden="true" />}
            </button>
          </div>
        </div>
      )}
      <Button
        variant="outline"
        size="sm"
        data-tour-id="dashboard-launch"
        onClick={() => { setLaunchError(null); setNoTerminalCmd(null); setOpen(o => !o); }}
        title="Launch a new session with Argus"
        aria-label="Launch with Argus"
        aria-expanded={open}
        className="inline-flex items-center gap-1"
      >
        <Terminal size={11} aria-hidden="true" />
        Launch with Argus
        <ChevronDown size={10} aria-hidden="true" />
      </Button>

      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-40 min-w-[220px] py-1">
          {!tools ? (
            <p className="text-xs text-gray-500 px-3 py-2">Checking installed tools…</p>
          ) : !hasAny ? (
            <p className="text-xs text-gray-500 px-3 py-2">No supported tools found on PATH</p>
          ) : (
            <>
              {tools.claude && (
                <>
                  <div className="px-3 pt-2 pb-0.5">
                    <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Claude Code</span>
                  </div>
                  <button
                    onClick={() => handleLaunch('claude')}
                    className="icon-btn w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 focus-visible:bg-blue-50 transition-colors"
                  >
                    <span className="text-orange-500 shrink-0"><ClaudeIcon size={13} /></span>
                    {tools.terminalAvailable === false ? 'Get Claude command' : 'Launch Claude'}
                  </button>
                  <button
                    onClick={() => handleCopy('claude')}
                    className="icon-btn w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 focus-visible:bg-blue-50 transition-colors"
                  >
                    <Copy size={13} className="text-gray-400 shrink-0" aria-hidden="true" />
                    {copied === 'claude' ? 'Copied!' : 'Copy Claude command'}
                  </button>
                </>
              )}

              {tools.copilot && (
                <>
                  <div className={`px-3 pb-0.5 ${tools.claude ? 'pt-2 border-t border-gray-100 mt-1' : 'pt-2'}`}>
                    <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">GitHub Copilot CLI</span>
                  </div>
                  <button
                    onClick={() => handleLaunch('copilot')}
                    className="icon-btn w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 focus-visible:bg-blue-50 transition-colors"
                  >
                    <span className="text-purple-600 shrink-0"><CopilotIcon size={13} /></span>
                    {tools.terminalAvailable === false ? 'Get Copilot command' : 'Launch Copilot'}
                  </button>
                  <button
                    onClick={() => handleCopy('copilot')}
                    className="icon-btn w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 focus-visible:bg-blue-50 transition-colors"
                  >
                    <Copy size={13} className="text-gray-400 shrink-0" aria-hidden="true" />
                    {copied === 'copilot' ? 'Copied!' : 'Copy Copilot command'}
                  </button>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

import { useRef, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Terminal, Copy, ChevronDown, Check } from 'lucide-react';
import { ClaudeIcon, CopilotIcon } from '../SessionTypeIcon/SessionTypeIcon';
import { getAvailableTools, launchInTerminal } from '../../services/api';
import { Button } from '../Button';

interface Props {
  repoPath: string;
  onLaunchError: (msg: string) => void;
}

function toLaunchErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (!raw || raw === 'Failed to fetch') return 'Failed to launch session. The Argus server is unreachable.';
  return `Failed to launch session: ${raw}`;
}

export default function LaunchDropdown({ repoPath, onLaunchError }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<'claude' | 'copilot' | null>(null);
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

  const copyCommand = async (tool: 'claude' | 'copilot') => {
    const base = tool === 'claude' ? tools?.claudeCmd : tools?.copilotCmd;
    const cmd = base ? `${base} --cwd "${repoPath}"` : undefined;
    if (!cmd) return;
    try {
      await navigator.clipboard.writeText(cmd);
    } catch {
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
  };

  const handleCopy = async (e: React.MouseEvent, tool: 'claude' | 'copilot') => {
    e.stopPropagation();
    await copyCommand(tool);
  };

  const handleLaunch = async (tool: 'claude' | 'copilot') => {
    if (tools?.terminalAvailable === false) {
      await copyCommand(tool);
      return;
    }
    setOpen(false);
    try {
      await launchInTerminal(tool, repoPath);
    } catch (err) {
      onLaunchError(toLaunchErrorMessage(err));
    }
  };

  const headless = tools?.terminalAvailable === false;
  const hasAny = tools?.claude || tools?.copilot;

  return (
    <div className="relative" ref={menuRef}>
      <Button
        variant="outline"
        size="sm"
        data-tour-id="dashboard-launch"
        onClick={() => { setOpen(o => !o); }}
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
        <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-40 min-w-[200px] py-1">
          {!tools ? (
            <p className="text-xs text-gray-500 px-3 py-2">Checking installed tools…</p>
          ) : !hasAny ? (
            <div className="px-3 py-2 space-y-1">
              <p className="text-xs text-gray-700 font-medium">No supported tools installed</p>
              <p className="text-xs text-gray-500">Install one of the following to launch a session:</p>
              <ul className="text-xs space-y-0.5 mt-1">
                <li>
                  <a
                    href="https://docs.anthropic.com/en/docs/claude-code/getting-started"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-blue-600 hover:underline"
                  >
                    <span className="text-orange-500"><ClaudeIcon size={12} /></span>
                    Claude Code
                  </a>
                </li>
                <li>
                  <a
                    href="https://github.com/features/copilot/cli/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-blue-600 hover:underline"
                  >
                    <span className="text-purple-600"><CopilotIcon size={12} /></span>
                    GitHub Copilot CLI
                  </a>
                </li>
              </ul>
            </div>
          ) : (
            <>
              {tools.claude && (
                <LaunchRow
                  label="Launch Claude"
                  icon={<span className="text-orange-500"><ClaudeIcon size={13} /></span>}
                  headless={headless}
                  copied={copied === 'claude'}
                  onLaunch={() => handleLaunch('claude')}
                  onCopy={(e) => handleCopy(e, 'claude')}
                />
              )}
              {tools.copilot && (
                <LaunchRow
                  label="Launch Copilot"
                  icon={<span className="text-purple-600"><CopilotIcon size={13} /></span>}
                  headless={headless}
                  copied={copied === 'copilot'}
                  onLaunch={() => handleLaunch('copilot')}
                  onCopy={(e) => handleCopy(e, 'copilot')}
                />
              )}
              <div className="border-t border-gray-100 mt-1 px-3 pt-1.5 pb-2 space-y-1">
                {headless && (
                  <p className="text-[10px] text-gray-400">No terminal available. Copy and run manually.</p>
                )}
                <p className="text-[10px] text-gray-400">Log in to the CLI and trust this folder first so Argus can fully control the session.</p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

interface LaunchRowProps {
  label: string;
  icon: React.ReactNode;
  headless: boolean;
  copied: boolean;
  onLaunch: () => void;
  onCopy: (e: React.MouseEvent) => void;
}

function LaunchRow({ label, icon, headless, copied, onLaunch, onCopy }: LaunchRowProps) {
  return (
    <div className="flex items-center group">
      <button
        onClick={onLaunch}
        className="flex-1 flex items-center gap-2 px-3 py-1.5 text-xs text-left text-gray-700 hover:bg-gray-50 focus-visible:bg-blue-50 cursor-pointer transition-colors"
        title={headless ? 'Click to copy command' : undefined}
      >
        <span className="shrink-0">{icon}</span>
        {label}
      </button>
      <button
        onClick={onCopy}
        className="icon-btn shrink-0 px-2 py-1.5 text-gray-400 hover:text-gray-700 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
        aria-label={`Copy ${label.toLowerCase()} command`}
        title="Copy command"
      >
        {copied
          ? <Check size={12} className="text-green-600" aria-hidden="true" />
          : <Copy size={12} aria-hidden="true" />
        }
      </button>
    </div>
  );
}


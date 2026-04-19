import { useRef, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Terminal, Copy, ChevronDown, Check } from 'lucide-react';
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
      setLaunchError(err instanceof Error ? err.message : 'Failed to launch');
    }
  };

  const headless = tools?.terminalAvailable === false;
  const hasAny = tools?.claude || tools?.copilot;

  return (
    <div className="relative" ref={menuRef}>
      {launchError && (
        <p className="text-xs text-red-600 mb-1">{launchError}</p>
      )}
      <Button
        variant="outline"
        size="sm"
        data-tour-id="dashboard-launch"
        onClick={() => { setLaunchError(null); setOpen(o => !o); }}
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
            <p className="text-xs text-gray-500 px-3 py-2">No supported tools found on PATH</p>
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
              {headless && (
                <p className="px-3 pt-1.5 pb-2 text-[10px] text-gray-400 border-t border-gray-100 mt-1">
                  No terminal available. Copy and run manually.
                </p>
              )}
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


import { useRef, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Terminal, Copy, ChevronDown } from 'lucide-react';
import { ClaudeIcon, CopilotIcon } from '../SessionTypeIcon/SessionTypeIcon';
import { getAvailableTools, launchInTerminal } from '../../services/api';

interface Props {
  repoPath: string;
}

export default function LaunchDropdown({ repoPath }: Props) {
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

  const handleCopy = (tool: 'claude' | 'copilot') => {
    const cmd = tool === 'claude' ? tools?.claudeCmd : tools?.copilotCmd;
    if (cmd) navigator.clipboard.writeText(cmd);
    setCopied(tool);
    setTimeout(() => setCopied(null), 1500);
    setOpen(false);
  };

  const handleLaunch = async (tool: 'claude' | 'copilot') => {
    setOpen(false);
    await launchInTerminal(tool, repoPath);
  };

  const hasAny = tools?.claude || tools?.copilot;

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(o => !o)}
        title="Launch a new session with Argus"
        aria-label="Launch with Argus"
        aria-expanded={open}
        className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border border-gray-300 text-gray-500 hover:border-blue-400 hover:text-blue-700 transition-colors"
      >
        <Terminal size={11} />
        Launch with Argus
        <ChevronDown size={10} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-40 min-w-[220px] py-1">
          {!tools ? (
            <p className="text-xs text-gray-400 px-3 py-2">Checking installed tools…</p>
          ) : !hasAny ? (
            <p className="text-xs text-gray-400 px-3 py-2">No supported tools found on PATH</p>
          ) : (
            <>
              {tools.claude && (
                <>
                  <div className="px-3 pt-2 pb-0.5">
                    <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Claude Code</span>
                  </div>
                  <button
                    onClick={() => handleLaunch('claude')}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <span className="text-orange-500 shrink-0"><ClaudeIcon size={13} /></span>
                    Launch Claude
                  </button>
                  <button
                    onClick={() => handleCopy('claude')}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <Copy size={13} className="text-gray-400 shrink-0" />
                    {copied === 'claude' ? 'Copied!' : 'Copy Claude command'}
                  </button>
                </>
              )}

              {tools.copilot && (
                <>
                  <div className={`px-3 pb-0.5 ${tools.claude ? 'pt-2 border-t border-gray-100 mt-1' : 'pt-2'}`}>
                    <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">GitHub Copilot CLI</span>
                  </div>
                  <button
                    onClick={() => handleLaunch('copilot')}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <span className="text-purple-600 shrink-0"><CopilotIcon size={13} /></span>
                    Launch Copilot
                  </button>
                  <button
                    onClick={() => handleCopy('copilot')}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <Copy size={13} className="text-gray-400 shrink-0" />
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

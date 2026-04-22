import { Settings, Bug, Lightbulb } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import type { DashboardSettings } from '../../types';
import { getHealth } from '../../services/api';
import { buildBugReportUrl, buildFeatureRequestUrl, ARGUS_CHANGELOG_URL } from '../../config/feedback';
import { SectionHeading } from '../SectionHeading';
import { WebsiteIcon, GitHubIcon, NpmIcon } from '../BrandIcons';
import { ClaudeIcon, CopilotIcon } from '../SessionTypeIcon/SessionTypeIcon';
import { GeneralSettingsContent } from '../SettingsDialog/GeneralSettingsContent';

interface SettingsPanelProps {
  settings: DashboardSettings;
  onToggle: (key: keyof DashboardSettings, value: boolean) => void;
  onOpenAllSettings?: () => void;
}

export function SettingsPanel({ settings, onToggle, onOpenAllSettings }: SettingsPanelProps) {
  const { data: healthData } = useQuery({ queryKey: ['health'], queryFn: getHealth, staleTime: Infinity });

  return (
    <div className="absolute right-0 top-full mt-1 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50 p-5 max-h-[calc(100vh-4rem)] overflow-y-auto">
      <SectionHeading className="mb-2">Settings</SectionHeading>
      <GeneralSettingsContent settings={settings} onToggle={onToggle} compact />
      <div className="mt-2 pt-2 border-t border-gray-100">
        <div className="flex items-center gap-2">
          <SectionHeading>Supported CLIs</SectionHeading>
          <div className="flex items-center gap-2">
            <a
              href="https://docs.anthropic.com/en/docs/claude-code/getting-started"
              target="_blank"
              rel="noopener noreferrer"
              className="icon-btn text-orange-500 hover:text-orange-600"
              aria-label="Claude Code"
              title="Claude Code"
            >
              <ClaudeIcon size={14} />
            </a>
            <a
              href="https://github.com/features/copilot/cli/"
              target="_blank"
              rel="noopener noreferrer"
              className="icon-btn text-purple-600 hover:text-purple-700"
              aria-label="GitHub Copilot CLI"
              title="GitHub Copilot CLI"
            >
              <CopilotIcon size={14} />
            </a>
          </div>
        </div>
      </div>
      <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-3">
        <SectionHeading className="shrink-0">
          About Argus{healthData?.version && (
            <><a href={ARGUS_CHANGELOG_URL} target="_blank" rel="noopener noreferrer" className="ml-3 normal-case font-normal tabular-nums text-blue-600 hover:text-blue-700 hover:underline">v{healthData.version}</a></>
          )}
        </SectionHeading>
        <div className="flex items-center gap-1">
          <a href="https://aarthi-ntrjn.github.io/argus" target="_blank" rel="noopener noreferrer" aria-label="Website" title="Website" className="icon-btn text-gray-400 hover:text-blue-600">
            <WebsiteIcon />
          </a>
          <a href="https://github.com/aarthi-ntrjn/argus" target="_blank" rel="noopener noreferrer" aria-label="GitHub" title="GitHub" className="icon-btn text-gray-400 hover:text-blue-600">
            <GitHubIcon />
          </a>
          <a href="https://www.npmjs.com/package/argus-ai-hub" target="_blank" rel="noopener noreferrer" aria-label="npm" title="npm" className="icon-btn text-gray-400 hover:text-blue-600">
            <NpmIcon />
          </a>
        </div>
      </div>
      <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-3">
        <SectionHeading className="shrink-0">Feedback</SectionHeading>
        <div className="flex items-center gap-1">
          <a href={buildBugReportUrl()} target="_blank" rel="noopener noreferrer" aria-label="Report a bug" title="Report a bug" className="icon-btn text-gray-400 hover:text-blue-600">
            <Bug size={13} aria-hidden="true" />
          </a>
          <a href={buildFeatureRequestUrl()} target="_blank" rel="noopener noreferrer" aria-label="Request a feature" title="Request a feature" className="icon-btn text-gray-400 hover:text-blue-600">
            <Lightbulb size={13} aria-hidden="true" />
          </a>
        </div>
      </div>
      {onOpenAllSettings && (
        <div className="mt-2 pt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={onOpenAllSettings}
            className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 hover:underline"
          >
            <Settings size={13} className="shrink-0" aria-hidden="true" />
            Advanced settings
          </button>
        </div>
      )}
    </div>
  );
}

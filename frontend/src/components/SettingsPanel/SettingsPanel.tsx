import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { RotateCcw } from 'lucide-react';
import type { DashboardSettings } from '../../types';
import { useArgusSettings } from '../../hooks/useArgusSettings';
import { useTeamsSettings } from '../../hooks/useTeamsSettings';
import { YoloWarningDialog } from '../YoloWarningDialog/YoloWarningDialog';
import { Checkbox } from '../Checkbox';
import { Button } from '../Button';
import Badge from '../Badge';

const DEFAULT_THRESHOLD = 20;
const MIN_THRESHOLD = 1;
const MAX_THRESHOLD = 60;

interface SettingsPanelProps {
  settings: DashboardSettings;
  onToggle: (key: keyof DashboardSettings, value: boolean) => void;
  onRestartTour?: () => void;
}

export function SettingsPanel({ settings, onToggle, onRestartTour }: SettingsPanelProps) {
  const { settings: argusSettings, patchSetting } = useArgusSettings();
  const { config: teamsConfig, isSaving: isTeamsSaving, error: teamsError, save: saveTeams } = useTeamsSettings();
  const [showYoloWarning, setShowYoloWarning] = useState(false);
  const [thresholdInput, setThresholdInput] = useState(String(argusSettings?.restingThresholdMinutes ?? DEFAULT_THRESHOLD));
  const [thresholdError, setThresholdError] = useState<string | null>(null);
  const [teamsForm, setTeamsForm] = useState({
    teamId: '',
    channelId: '',
    ownerAadObjectId: '',
  });

  // Sync input when argusSettings loads from server
  useEffect(() => {
    if (argusSettings?.restingThresholdMinutes != null) {
      setThresholdInput(String(argusSettings.restingThresholdMinutes));
    }
  }, [argusSettings?.restingThresholdMinutes]);

  const handleYoloChange = (checked: boolean) => {
    if (checked) {
      setShowYoloWarning(true);
    } else {
      patchSetting({ yoloMode: false });
    }
  };

  const handleYoloConfirm = () => {
    setShowYoloWarning(false);
    patchSetting({ yoloMode: true });
  };

  const handleYoloCancel = () => {
    setShowYoloWarning(false);
  };

  const commitThreshold = (raw: string, normalizeInput = false) => {
    const trimmed = raw.trim();
    if (trimmed === '') {
      setThresholdError('Enter a number between 1 and 1440.');
      return;
    }
    const rounded = Math.round(parseFloat(trimmed));
    if (isNaN(rounded)) {
      setThresholdError('Enter a number between 1 and 1440.');
      return;
    }
    if (rounded < MIN_THRESHOLD) {
      setThresholdError('Minimum is 1 minute.');
      return;
    }
    if (rounded > MAX_THRESHOLD) {
      setThresholdError('Maximum is 60 minutes.');
      return;
    }
    setThresholdError(null);
    // On blur, normalise the display value (e.g. "05" -> "5", "5.7" -> "6").
    if (normalizeInput) setThresholdInput(String(rounded));
    patchSetting({ restingThresholdMinutes: rounded });
  };

  const handleReset = () => {
    setThresholdInput(String(DEFAULT_THRESHOLD));
    setThresholdError(null);
    patchSetting({ restingThresholdMinutes: DEFAULT_THRESHOLD });
  };

  return (
    <>
      <div className="absolute right-0 top-full mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50 p-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Settings</p>
        <div className="py-1">
          <Checkbox
            label="Hide ended sessions"
            aria-label="Hide ended sessions"
            checked={settings.hideEndedSessions}
            onChange={e => onToggle('hideEndedSessions', e.target.checked)}
          />
        </div>
        <div className="py-1">
          <Checkbox
            label="Hide repos with no active sessions"
            aria-label="Hide repos with no active sessions"
            checked={settings.hideReposWithNoActiveSessions}
            onChange={e => onToggle('hideReposWithNoActiveSessions', e.target.checked)}
          />
        </div>
        <div className="py-1">
          <Checkbox
            label={`Hide inactive sessions (>${argusSettings?.restingThresholdMinutes ?? DEFAULT_THRESHOLD} min)`}
            aria-label="Hide inactive sessions"
            checked={settings.hideInactiveSessions}
            onChange={e => onToggle('hideInactiveSessions', e.target.checked)}
          />
        </div>
        <div className="py-1">
          <Checkbox
            label="Hide To Do panel"
            aria-label="Hide To Do panel"
            checked={settings.hideTodoPanel}
            onChange={e => onToggle('hideTodoPanel', e.target.checked)}
          />
        </div>

        <div className="mt-2 pt-2 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Resting</p>
          <div className="flex items-center gap-2 py-1">
            <label htmlFor="resting-threshold-input" className="text-sm text-gray-700 shrink-0">
              Resting after
            </label>
            <input
              id="resting-threshold-input"
              type="number"
              aria-label="Resting after"
              value={thresholdInput}
              min={MIN_THRESHOLD}
              max={MAX_THRESHOLD}
              onChange={e => {
                setThresholdInput(e.target.value);
                commitThreshold(e.target.value);
              }}
              onBlur={e => commitThreshold(e.target.value, true)}
              className="w-14 text-sm px-1 py-0.5 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 text-center"
            />
            <span className="text-sm text-gray-500 shrink-0">min</span>
            <button
              type="button"
              onClick={handleReset}
              aria-label="Reset resting threshold to default"
              title="Reset to default (20 min, max 60 min)"
              className="icon-btn text-gray-500 hover:text-blue-600"
            >
              <RotateCcw size={12} aria-hidden="true" />
            </button>
          </div>
          {thresholdError && (
            <p role="alert" className="text-xs text-red-600 mt-0.5 px-1">{thresholdError}</p>
          )}
        </div>

        <div className="mt-2 pt-2 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Launch Behaviour</p>
          <label className="flex items-start gap-2 cursor-pointer select-none py-1">
            <Checkbox
              aria-label="Yolo mode"
              checked={argusSettings?.yoloMode ?? false}
              onChange={e => handleYoloChange(e.target.checked)}
              className="mt-0.5"
            />
            <span className="flex flex-col">
              <span className="text-sm text-gray-600">Yolo mode</span>
              {argusSettings?.yoloMode && (
                <span className="text-xs text-amber-700">All permission checks disabled</span>
              )}
            </span>
          </label>
        </div>

        <div className="mt-2 pt-2 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Privacy</p>
          <div className="py-1">
            <Checkbox
              label="Send anonymous usage telemetry"
              aria-label="Send anonymous usage telemetry"
              checked={argusSettings?.telemetryEnabled ?? true}
              onChange={e => patchSetting({ telemetryEnabled: e.target.checked })}
            />
          </div>
          <Link to="/telemetry" className="block text-xs text-blue-600 hover:underline mt-1">
            What we collect
          </Link>
        </div>

        {onRestartTour && (
          <div className="mt-2 pt-2 border-t border-gray-100 flex flex-col gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={onRestartTour}
              className="w-full text-left !text-sm"
            >
              Restart Tour
            </Button>
          </div>
        )}

        <div className="mt-2 pt-2 border-t border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Microsoft Teams</span>
            {teamsConfig && (
              <Badge colorClass={
                teamsConfig.connectionStatus === 'connected' ? 'bg-green-100 text-green-700' :
                'bg-gray-100 text-gray-600'
              }>
                {teamsConfig.connectionStatus}
              </Badge>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-xs text-gray-500">Auth is configured via <span className="font-mono">CLIENT_ID</span>, <span className="font-mono">CLIENT_SECRET</span>, and <span className="font-mono">TENANT_ID</span> environment variables.</p>
            <div>
              <label htmlFor="teams-team-id" className="text-xs text-gray-600 block mb-1">Team ID</label>
              <input
                id="teams-team-id"
                type="text"
                className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-blue-400"
                value={teamsForm.teamId || teamsConfig?.teamId || ''}
                onChange={e => setTeamsForm(f => ({ ...f, teamId: e.target.value }))}
                placeholder="Team (Group) ID"
              />
            </div>
            <div>
              <label htmlFor="teams-channel-id" className="text-xs text-gray-600 block mb-1">Channel ID</label>
              <input
                id="teams-channel-id"
                type="text"
                className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-blue-400"
                value={teamsForm.channelId || teamsConfig?.channelId || ''}
                onChange={e => setTeamsForm(f => ({ ...f, channelId: e.target.value }))}
                placeholder="19:xxxx@thread.tacv2"
              />
            </div>
            <div>
              <label htmlFor="teams-owner-aad-object-id" className="text-xs text-gray-600 block mb-1">Owner AAD Object ID</label>
              <input
                id="teams-owner-aad-object-id"
                type="text"
                className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-blue-400"
                value={teamsForm.ownerAadObjectId || teamsConfig?.ownerAadObjectId || ''}
                onChange={e => setTeamsForm(f => ({ ...f, ownerAadObjectId: e.target.value }))}
                placeholder="AAD Object ID of the session owner"
              />
            </div>
            <div>
              <p className="text-xs text-gray-500">
                Webhook URL: <span className="font-mono">{window.location.origin}/api/v1/teams/webhook</span>
              </p>
            </div>
            {teamsError && <p className="text-xs text-red-600">{teamsError}</p>}
            <Button
              variant="ghost"
              size="sm"
              disabled={isTeamsSaving}
              onClick={() => saveTeams({
                enabled: true,
                teamId: teamsForm.teamId || teamsConfig?.teamId,
                channelId: teamsForm.channelId || teamsConfig?.channelId,
                ownerAadObjectId: teamsForm.ownerAadObjectId || teamsConfig?.ownerAadObjectId,
              })}
              className="text-xs"
            >
              {isTeamsSaving ? 'Saving...' : 'Save Teams Settings'}
            </Button>
          </div>
        </div>
      </div>

      <YoloWarningDialog
        open={showYoloWarning}
        onConfirm={handleYoloConfirm}
        onCancel={handleYoloCancel}
      />
    </>
  );
}

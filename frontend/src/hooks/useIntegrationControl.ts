import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getIntegrationStatus, startIntegration, stopIntegration } from '../services/api';
import type { ConnectionStatus } from '../services/api';

export function useIntegrationControl() {
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ['integration-status'],
    queryFn: getIntegrationStatus,
  });

  const integrationsEnabled = data?.integrationsEnabled === true;
  const teamsStatus: ConnectionStatus = data?.teams.connectionStatus ?? 'unconfigured';
  const slackStatus: ConnectionStatus = data?.slack.connectionStatus ?? 'unconfigured';
  const teamsRunning = teamsStatus === 'connected';
  const slackRunning = slackStatus === 'connected';

  const { mutate: toggle, isPending } = useMutation({
    mutationFn: async (platform: 'slack' | 'teams') => {
      const isRunning = platform === 'teams' ? teamsRunning : slackRunning;
      if (isRunning) {
        await stopIntegration(platform);
      } else {
        await startIntegration(platform);
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['integration-status'] });
    },
  });

  return { integrationsEnabled, teamsRunning, slackRunning, teamsStatus, slackStatus, toggle, isPending };
}

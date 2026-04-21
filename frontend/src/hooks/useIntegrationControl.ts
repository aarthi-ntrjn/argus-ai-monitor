import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getIntegrationStatus, startIntegration, stopIntegration } from '../services/api';

export function useIntegrationControl() {
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ['integration-status'],
    queryFn: getIntegrationStatus,
  });

  const integrationsEnabled = data?.integrationsEnabled === true;
  const teamsConfigured = data?.teams.notifier !== null;
  const slackConfigured = data?.slack.notifier !== null;
  const teamsRunning = data?.teams.notifier?.running === true;
  const slackRunning = data?.slack.notifier?.running === true;

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

  return { integrationsEnabled, teamsRunning, slackRunning, teamsConfigured, slackConfigured, toggle, isPending };
}

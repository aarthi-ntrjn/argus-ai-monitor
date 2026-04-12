import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getArgusSettings, patchArgusSettings } from '../services/api';
import type { ArgusConfig } from '../types';

export const ARGUS_SETTINGS_QUERY_KEY = ['argus-settings'];

export function useArgusSettings() {
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ARGUS_SETTINGS_QUERY_KEY,
    queryFn: getArgusSettings,
    staleTime: 30_000,
  });

  const { mutateAsync: patchSetting } = useMutation({
    mutationFn: (patch: Partial<ArgusConfig>) => patchArgusSettings(patch),
    onSuccess: (updated) => {
      queryClient.setQueryData(ARGUS_SETTINGS_QUERY_KEY, updated);
    },
  });

  return { settings, isLoading, patchSetting };
}

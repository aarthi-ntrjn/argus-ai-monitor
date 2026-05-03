import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { UseMutationResult } from '@tanstack/react-query';
import { getArgusSettings, patchArgusSettings } from '../services/api';
import type { ArgusConfig } from '../types';

export const ARGUS_SETTINGS_QUERY_KEY = ['argus-settings'];

export interface UseArgusSettingsResult {
  settings: ArgusConfig | undefined;
  isLoading: boolean;
  patchSetting: UseMutationResult<ArgusConfig, Error, Partial<ArgusConfig>>['mutateAsync'];
}

export function useArgusSettings(): UseArgusSettingsResult {
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
      // Invalidate the tools cache so the copy command picks up the new yolo flags.
      queryClient.invalidateQueries({ queryKey: ['available-tools'] });
    },
  });

  return { settings, isLoading, patchSetting };
}

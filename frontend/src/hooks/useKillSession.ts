import { useState, useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { stopSession, getSession } from '../services/api';

export function useKillSession(options?: { onKilled?: () => void }) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [targetSessionId, setTargetSessionId] = useState<string | null>(null);
  const [isWaitingForExit, setIsWaitingForExit] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onKilledRef = useRef(options?.onKilled);
  onKilledRef.current = options?.onKilled;

  const mutation = useMutation({
    mutationFn: (sessionId: string) => stopSession(sessionId),
    onSuccess: (_data, sessionId) => {
      setIsWaitingForExit(true);
      // Poll until the session status shows ended/completed
      pollRef.current = setInterval(async () => {
        try {
          const session = await getSession(sessionId);
          if (session.status === 'ended' || session.status === 'completed') {
            clearPoll();
            setIsWaitingForExit(false);
            setDialogOpen(false);
            setTargetSessionId(null);
            queryClient.invalidateQueries({ queryKey: ['session', sessionId] });
            queryClient.invalidateQueries({ queryKey: ['sessions'] });
            onKilledRef.current?.();
          }
        } catch {
          // Session may have been removed; treat as success
          clearPoll();
          setIsWaitingForExit(false);
          setDialogOpen(false);
          setTargetSessionId(null);
          queryClient.invalidateQueries({ queryKey: ['sessions'] });
          onKilledRef.current?.();
        }
      }, 500);
    },
  });

  function clearPoll() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  // Cleanup on unmount
  useEffect(() => clearPoll, []);

  function requestKill(sessionId: string) {
    mutation.reset();
    setIsWaitingForExit(false);
    setTargetSessionId(sessionId);
    setDialogOpen(true);
  }

  function confirmKill() {
    if (targetSessionId) {
      mutation.mutate(targetSessionId);
    }
  }

  function cancelKill() {
    if (isWaitingForExit) return; // can't cancel while killing
    clearPoll();
    setDialogOpen(false);
    setTargetSessionId(null);
    mutation.reset();
  }

  return {
    dialogOpen,
    targetSessionId,
    isPending: mutation.isPending || isWaitingForExit,
    isError: mutation.isError,
    error: mutation.error,
    requestKill,
    confirmKill,
    cancelKill,
    reset: mutation.reset,
  };
}

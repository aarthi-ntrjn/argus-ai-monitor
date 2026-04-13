import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { focusSession } from '../services/api';

export function useFocusSession() {
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (sessionId: string) => focusSession(sessionId),
    onSuccess: (result) => {
      if (!result.focused && result.message) {
        setError(result.message);
      } else {
        setError(null);
      }
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  function focus(sessionId: string) {
    setError(null);
    mutation.mutate(sessionId);
  }

  return {
    focus,
    isPending: mutation.isPending,
    error,
  };
}

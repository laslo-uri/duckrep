import { useState, useCallback } from 'react';

export function useMutationError() {
  const [error, setError] = useState<string | null>(null);
  const clearError = useCallback(() => setError(null), []);
  const onMutationError = useCallback((err: Error) => {
    setError(err.message || 'error');
  }, []);
  return { mutationError: error, clearError, onMutationError };
}

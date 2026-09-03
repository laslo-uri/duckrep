import { useCallback, useRef, useState } from 'react';

export type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  variant?: 'default' | 'danger';
};

type ConfirmState = ConfirmOptions & {
  open: boolean;
};

export function useConfirm() {
  const resolverRef = useRef<((confirmed: boolean) => void) | null>(null);
  const [state, setState] = useState<ConfirmState | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setState({ ...options, open: true });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    resolverRef.current?.(true);
    resolverRef.current = null;
    setState(null);
  }, []);

  const handleCancel = useCallback(() => {
    resolverRef.current?.(false);
    resolverRef.current = null;
    setState(null);
  }, []);

  return {
    confirm,
    confirmState: state,
    handleConfirm,
    handleCancel,
  };
}

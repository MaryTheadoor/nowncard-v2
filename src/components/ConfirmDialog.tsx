import { useState, useCallback, type ReactNode } from 'react';
import ModalShell from './ModalShell';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

interface ConfirmState extends ConfirmOptions {
  resolve: (ok: boolean) => void;
}

/**
 * Hook that provides a themed confirmation dialog.
 * Returns [showConfirm, ConfirmDialogElement].
 *
 * Usage:
 *   const [showConfirm, ConfirmDialog] = useConfirm();
 *   // in a handler:
 *   const ok = await showConfirm({ title: 'Delete?', message: '...', destructive: true });
 *   if (ok) { // proceed }
 *   // in JSX:
 *   <>{ConfirmDialog}</>
 */
export function useConfirm(): [
  (opts: ConfirmOptions) => Promise<boolean>,
  () => ReactNode,
] {
  const [state, setState] = useState<ConfirmState | null>(null);

  const showConfirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setState({ ...opts, resolve });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    state?.resolve(true);
    setState(null);
  }, [state]);

  const handleCancel = useCallback(() => {
    state?.resolve(false);
    setState(null);
  }, [state]);

  const ConfirmDialog = () => state ? (
    <ModalShell open={true} onClose={handleCancel}>
      <h2 id="confirm-dialog-title" className="text-xl font-extrabold mb-2">{state.title}</h2>
      <p className="text-sm text-ink-muted mb-6 leading-relaxed">{state.message}</p>
      <div className="flex items-center justify-end gap-3">
        <button onClick={handleCancel} className="btn btn-secondary btn-md">
          {state.cancelLabel || 'Cancel'}
        </button>
        <button
          onClick={handleConfirm}
          className={`btn ${state.destructive ? 'btn-danger' : 'btn-primary'} btn-md`}
        >
          {state.confirmLabel || 'Confirm'}
        </button>
      </div>
    </ModalShell>
  ) : null;

  return [showConfirm, ConfirmDialog];
}

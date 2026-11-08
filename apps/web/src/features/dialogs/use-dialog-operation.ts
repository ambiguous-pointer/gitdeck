/**
 * Shared submit pipeline for operation dialogs.
 *
 * Pipes the mutation through `notifyOperation` so:
 * - a successful git command shows the dialog-specific success toast + closes,
 * - a completed-but-failed command (conflict / rejected push) stays open and
 *   shows its output instead of silently closing,
 * - transport/validation errors are rendered in the dialog via `DialogError`.
 */
import type { OperationResult } from '@gitdeck/shared';
import { useState } from 'react';
import { errorMessage } from '@/api/client';
import { useToast } from '@/components/feedback/toast';
import { useI18n } from '@/i18n';
import { notifyOperation } from './helpers';
import { useCloseDialog } from './use-dialog';

/** The slice of `UseMutationResult` this helper needs (keeps call sites simple). */
export interface OperationMutation<TVars> {
  mutate: (
    variables: TVars,
    options?: {
      onSuccess?: (data: OperationResult) => void;
      onError?: (error: Error) => void;
    },
  ) => void;
  isPending: boolean;
  error: Error | null;
}

export interface DialogOperation<TVars> {
  run: (variables: TVars) => void;
  pending: boolean;
  error: Error | null;
  /** Last completed command; rendered when the git command itself failed. */
  result: OperationResult | null;
}

export function useDialogOperation<TVars>(
  mutation: OperationMutation<TVars>,
  successTitle: string,
): DialogOperation<TVars> {
  const toast = useToast();
  const { t } = useI18n();
  const closeDialog = useCloseDialog();
  const [result, setResult] = useState<OperationResult | null>(null);

  const run = (variables: TVars) => {
    setResult(null);
    mutation.mutate(variables, {
      onSuccess: (data) => {
        setResult(data);
        if (notifyOperation(toast, t, data, successTitle)) closeDialog();
      },
      onError: (error) => {
        toast.error(t('toast.failed', 'Operation failed'), errorMessage(error));
      },
    });
  };

  return { run, pending: mutation.isPending, error: mutation.error, result };
}

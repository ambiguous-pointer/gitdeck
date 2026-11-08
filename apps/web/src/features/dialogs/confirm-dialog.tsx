/**
 * Generic confirmation dialog used by destructive actions anywhere in the app
 * (`openDialog('confirm', { title, description, onConfirm })`).
 */
import { ShieldAlert } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { errorMessage } from '@/api/client';
import { useToast } from '@/components/feedback/toast';
import { useI18n } from '@/i18n';
import { DialogShell } from './dialog-shell';
import { useCloseDialog, useDialogProps } from './use-dialog';

export interface ConfirmDialogProps extends Record<string, unknown> {
  title?: string;
  description?: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm?: () => void | Promise<void>;
}

export function ConfirmDialog(): JSX.Element {
  const { t } = useI18n();
  const toast = useToast();
  const closeDialog = useCloseDialog();
  const props = useDialogProps<ConfirmDialogProps>();
  const [pending, setPending] = useState(false);

  const danger = props.danger ?? true;

  const confirm = async () => {
    const onConfirm = props.onConfirm;
    if (!onConfirm) {
      closeDialog();
      return;
    }
    try {
      setPending(true);
      await onConfirm();
      closeDialog();
    } catch (error) {
      setPending(false);
      toast.error(t('toast.failed', 'Operation failed'), errorMessage(error));
    }
  };

  return (
    <DialogShell
      title={props.title ?? t('dialog.confirm.title', 'Are you sure?')}
      description={props.description != null ? undefined : undefined}
      danger={danger}
      busy={pending}
      submitLabel={props.confirmLabel ?? t('dialog.confirm.confirm', 'Confirm')}
      onSubmit={() => {
        void confirm();
      }}
      onClose={closeDialog}
    >
      <div className="flex items-start gap-2.5 rounded-md border border-danger/30 bg-danger/10 px-3 py-2.5">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
        <div className="min-w-0 flex-1 text-xs leading-5 text-fg-secondary">
          {props.description ?? t('dialog.confirm.description', 'This action cannot be undone.')}
        </div>
      </div>
    </DialogShell>
  );
}

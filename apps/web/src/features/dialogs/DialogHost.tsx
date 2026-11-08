import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n';
import { useAppStore } from '@/stores/app-store';

/**
 * Single mount point for every dialog. STUB: the actions feature branch
 * implements the real dialogs (merge, rebase, push, worktree, config, …).
 */
export function DialogHost(): JSX.Element {
  const { t } = useI18n();
  const dialog = useAppStore((state) => state.dialog);
  const closeDialog = useAppStore((state) => state.closeDialog);

  return (
    <Modal
      open={Boolean(dialog)}
      onClose={closeDialog}
      title={dialog ? t(`dialog.${dialog.id.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())}.title`, dialog.id) : ''}
      footer={
        <>
          <Button variant="ghost" onClick={closeDialog}>
            {t('common.close', 'Close')}
          </Button>
        </>
      }
    >
      {dialog?.props ? (
        <pre className="max-h-64 overflow-auto rounded border border-border bg-canvas p-2 font-mono text-xs text-fg-muted">
          {JSON.stringify(dialog.props, null, 2)}
        </pre>
      ) : (
        <p className="text-xs text-fg-muted">Dialog: {dialog?.id}</p>
      )}
    </Modal>
  );
}

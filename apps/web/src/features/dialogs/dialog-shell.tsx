/**
 * Shared chrome for every operation dialog: modal shell with a proper
 * `<form>` (submit works from the footer), command preview, inline error /
 * command-output blocks and small alert boxes.
 */
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Info,
  ShieldAlert,
  Terminal,
} from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { errorDetails, errorMessage } from '@/api/client';
import { useToast } from '@/components/feedback/toast';
import { Button, type ButtonVariant } from '@/components/ui/button';
import { Modal, type ModalSize } from '@/components/ui/modal';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/cn';
import { copyText } from './helpers';

/* ------------------------------------------------------------------ */
/* Shell                                                               */
/* ------------------------------------------------------------------ */

export interface DialogShellProps {
  title: ReactNode;
  description?: ReactNode;
  size?: ModalSize;
  danger?: boolean;
  /** Disables every way of closing while a command is running. */
  busy?: boolean;
  submitLabel: string;
  submitVariant?: ButtonVariant;
  submitDisabled?: boolean;
  cancelLabel?: string;
  onSubmit: () => void;
  onClose: () => void;
  children: ReactNode;
  /** Extra buttons rendered before Cancel (e.g. stash pop/drop). */
  extraFooter?: ReactNode;
  /** Mutation error rendered inside the dialog. */
  error?: unknown;
  /** Completed-but-failed command output rendered inside the dialog. */
  failure?: { command: string; output: string } | null;
}

export function DialogShell({
  title,
  description,
  size = 'md',
  danger,
  busy,
  submitLabel,
  submitVariant,
  submitDisabled,
  cancelLabel,
  onSubmit,
  onClose,
  children,
  extraFooter,
  error,
  failure,
}: DialogShellProps): JSX.Element {
  const { t } = useI18n();
  const formId = useId();

  return (
    <Modal
      open
      onClose={() => {
        if (!busy) onClose();
      }}
      title={title}
      description={description}
      size={size}
      danger={danger}
      dismissible={!busy}
      footer={
        <>
          {extraFooter}
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {cancelLabel ?? t('common.cancel', 'Cancel')}
          </Button>
          <Button
            type="submit"
            form={formId}
            variant={submitVariant ?? (danger ? 'danger' : 'primary')}
            loading={busy}
            disabled={busy || submitDisabled}
          >
            {submitLabel}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        onSubmit={(event) => {
          event.preventDefault();
          if (!busy && !submitDisabled) onSubmit();
        }}
        className="space-y-3"
      >
        {children}
        {failure ? <DialogOutput command={failure.command} output={failure.output} /> : null}
        {error ? <DialogError error={error} /> : null}
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Command preview                                                     */
/* ------------------------------------------------------------------ */

export function DialogPreview({
  command,
  danger,
  label,
}: {
  command: string;
  danger?: boolean;
  label?: string;
}): JSX.Element {
  const { t } = useI18n();
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (await copyText(command)) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_500);
    } else {
      toast.error(t('toast.failed', 'Operation failed'), t('error.generic', 'Something went wrong'));
    }
  };

  return (
    <div
      className={cn(
        'rounded-md border bg-canvas px-2.5 py-2',
        danger ? 'border-danger/40' : 'border-border',
      )}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1 text-2xs font-medium uppercase tracking-wide text-fg-muted">
          {danger ? <ShieldAlert className="h-3 w-3 text-danger" /> : <Terminal className="h-3 w-3" />}
          {label ?? t('dialog.command.preview', 'Command preview')}
        </span>
        <button
          type="button"
          onClick={copy}
          className="flex items-center gap-1 rounded px-1 py-0.5 text-2xs text-fg-muted transition-colors hover:bg-hover hover:text-fg"
        >
          {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
          {copied ? t('common.copied', 'Copied') : t('common.copy', 'Copy')}
        </button>
      </div>
      <code className="block max-h-24 overflow-auto whitespace-pre-wrap break-all font-mono text-xs leading-5 text-fg-secondary">
        <span className="select-none text-accent">$ </span>
        {command}
      </code>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Alerts                                                              */
/* ------------------------------------------------------------------ */

export function DialogAlert({
  variant = 'info',
  children,
}: {
  variant?: 'info' | 'warning' | 'danger';
  children: ReactNode;
}): JSX.Element {
  const Icon = variant === 'info' ? Info : variant === 'warning' ? AlertTriangle : ShieldAlert;
  const styles =
    variant === 'info'
      ? 'border-info/40 bg-info/10 text-info'
      : variant === 'warning'
        ? 'border-warning/40 bg-warning/10 text-warning'
        : 'border-danger/40 bg-danger/10 text-danger';
  return (
    <div className={cn('flex items-start gap-2 rounded-md border px-2.5 py-2 text-xs', styles)}>
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <div className="min-w-0 flex-1 leading-5 text-fg-secondary">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Error / output blocks                                               */
/* ------------------------------------------------------------------ */

export function DialogError({ error }: { error?: unknown }): JSX.Element | null {
  const { t } = useI18n();
  const [showDetails, setShowDetails] = useState(false);
  if (!error) return null;
  const details = errorDetails(error);

  return (
    <div role="alert" className="rounded-md border border-danger/40 bg-danger/10 px-2.5 py-2">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-danger" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-danger">{t('toast.failed', 'Operation failed')}</p>
          <p className="mt-0.5 break-words text-xs leading-5 text-fg-secondary">{errorMessage(error)}</p>
        </div>
      </div>
      {details ? (
        <>
          <button
            type="button"
            onClick={() => setShowDetails((value) => !value)}
            className="mt-1.5 flex items-center gap-1 text-2xs text-danger transition-colors hover:underline"
          >
            {showDetails ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            {t('common.details', 'Details')}
          </button>
          {showDetails ? (
            <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded border border-border bg-canvas p-2 font-mono text-2xs leading-5 text-fg-secondary">
              {details}
            </pre>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

/** Monospace command + output block (useExec results, failed git commands). */
export function DialogOutput({
  command,
  output,
  tone = 'default',
  maxHeight = 'max-h-48',
}: {
  command: string;
  output: string;
  tone?: 'default' | 'danger';
  maxHeight?: string;
}): JSX.Element {
  const { t } = useI18n();
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (await copyText(output)) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_500);
    } else {
      toast.error(t('toast.failed', 'Operation failed'), t('error.generic', 'Something went wrong'));
    }
  };

  return (
    <div className={cn('overflow-hidden rounded-md border bg-canvas', tone === 'danger' ? 'border-danger/40' : 'border-border')}>
      <div className="flex items-center justify-between gap-2 border-b border-border-subtle bg-surface px-2.5 py-1">
        <code className="min-w-0 truncate font-mono text-2xs text-fg-muted">$ {command}</code>
        <button
          type="button"
          onClick={copy}
          className="flex shrink-0 items-center gap-1 rounded px-1 py-0.5 text-2xs text-fg-muted transition-colors hover:bg-hover hover:text-fg"
        >
          {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
          {t('console.copyOutput', 'Copy output')}
        </button>
      </div>
      <pre
        className={cn(
          'overflow-auto whitespace-pre-wrap break-all p-2.5 font-mono text-2xs leading-5',
          maxHeight,
          tone === 'danger' ? 'text-danger' : 'text-fg-secondary',
        )}
      >
        {output || '—'}
      </pre>
    </div>
  );
}

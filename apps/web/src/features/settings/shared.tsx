/**
 * Small building blocks shared by the settings tabs: section cards, label/value
 * rows, clipboard helpers and value formatting.
 */
import { Check, Copy } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useToast } from '@/components/feedback/toast';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/cn';

export interface SettingsSectionProps {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** A titled card that groups related settings rows. */
export function SettingsSection({ title, description, action, children, className }: SettingsSectionProps): JSX.Element {
  return (
    <section className={cn('space-y-2', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-xs font-semibold text-fg">{title}</h3>
          {description ? <p className="mt-0.5 text-xs leading-4 text-fg-muted">{description}</p> : null}
        </div>
        {action ? <div className="flex shrink-0 items-center gap-1.5">{action}</div> : null}
      </div>
      <div className="overflow-hidden rounded-md border border-border bg-surface">{children}</div>
    </section>
  );
}

export interface SettingRowProps {
  label: ReactNode;
  description?: ReactNode;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
  /** Allow controls to stretch instead of staying on one line. */
  stacked?: boolean;
}

/** A dense label/control row separated by hairlines. */
export function SettingRow({
  label,
  description,
  htmlFor,
  children,
  className,
  stacked,
}: SettingRowProps): JSX.Element {
  return (
    <div
      className={cn(
        'border-b border-border-subtle px-3 py-2.5 last:border-b-0',
        stacked ? 'space-y-2' : 'flex items-center justify-between gap-4',
        className,
      )}
    >
      <div className="min-w-0">
        {htmlFor ? (
          <label htmlFor={htmlFor} className="block text-[13px] leading-5 text-fg">
            {label}
          </label>
        ) : (
          <span className="block text-[13px] leading-5 text-fg">{label}</span>
        )}
        {description ? <p className="mt-0.5 text-xs leading-4 text-fg-muted">{description}</p> : null}
      </div>
      <div className={cn('flex items-center gap-2', stacked ? 'w-full' : 'shrink-0')}>{children}</div>
    </div>
  );
}

export interface CopyButtonProps {
  value: string;
  label?: string;
  className?: string;
}

/** Copy-to-clipboard icon button with "copied" feedback and toast. */
export function CopyButton({ value, label, className }: CopyButtonProps): JSX.Element {
  const { t } = useI18n();
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  const copy = useCallback(async () => {
    const succeeded = await copyText(value);
    if (!succeeded) return;
    setCopied(true);
    toast.success(t('common.copied', 'Copied'));
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setCopied(false), 1400);
  }, [value, toast, t]);

  const hint = label ?? t('common.copy', 'Copy');
  if (!value) return <span className="inline-block h-7 w-7" aria-hidden />;
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={hint}
      title={hint}
      onClick={() => void copy()}
      className={cn('text-fg-muted hover:text-fg', className)}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  );
}

/** Clipboard write with a legacy fallback for non-secure contexts. */
export async function copyText(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    /* fall through to the legacy path */
  }
  try {
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

/** Monospace value chip used for paths, hashes and versions. */
export function ValueChip({ children, className }: { children: ReactNode; className?: string }): JSX.Element {
  return (
    <span
      className={cn(
        'inline-flex min-w-0 items-center gap-1.5 rounded border border-border bg-canvas px-2 py-1 mono text-xs text-fg-secondary',
        className,
      )}
    >
      <span className="min-w-0 truncate">{children}</span>
    </span>
  );
}

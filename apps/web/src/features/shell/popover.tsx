import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface PopoverProps {
  open: boolean;
  onClose: () => void;
  trigger: ReactNode;
  children: ReactNode;
  align?: 'start' | 'end';
  className?: string;
  panelClassName?: string;
}

/**
 * Lightweight anchored popover used by the top bar (repo switcher, branch
 * selector). Closes on outside click, Escape, window resize and page scroll.
 * The design-system branch can replace it with a richer MenuButton later.
 */
export function Popover({
  open,
  onClose,
  trigger,
  children,
  align = 'start',
  className,
  panelClassName,
}: PopoverProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onClose);
    window.addEventListener('blur', onClose);
    return () => {
      document.removeEventListener('mousedown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onClose);
      window.removeEventListener('blur', onClose);
    };
  }, [open, onClose]);

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {trigger}
      {open ? (
        <div
          role="dialog"
          className={cn(
            'absolute top-[calc(100%+6px)] z-50 overflow-hidden rounded-md border border-border bg-elevated shadow-pop animate-scale-in',
            align === 'end' ? 'right-0' : 'left-0',
            panelClassName,
          )}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

/** A compact, dense action row rendered inside a popover. */
export function PopoverAction({
  icon,
  label,
  hint,
  disabled,
  danger,
  onClick,
}: {
  icon?: ReactNode;
  label: ReactNode;
  hint?: ReactNode;
  disabled?: boolean;
  danger?: boolean;
  onClick: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex h-8 w-full items-center gap-2 px-2.5 text-left text-xs transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-40',
        danger ? 'text-danger hover:bg-danger/10' : 'text-fg hover:bg-hover',
      )}
    >
      {icon ? (
        <span className="flex h-4 w-4 shrink-0 items-center justify-center text-fg-muted">{icon}</span>
      ) : null}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {hint ? <span className="shrink-0 text-2xs text-fg-muted">{hint}</span> : null}
    </button>
  );
}

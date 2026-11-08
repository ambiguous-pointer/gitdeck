import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';
import { Button } from './button';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: ModalSize;
  danger?: boolean;
  className?: string;
  /** Disable closing by backdrop / escape (e.g. while a command runs). */
  dismissible?: boolean;
}

const SIZES: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-[min(1280px,calc(100vw-4rem))] h-[calc(100vh-8rem)]',
};

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  danger,
  className,
  dismissible = true,
}: ModalProps): JSX.Element | null {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && dismissible) {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previous?.focus?.();
    };
  }, [open, onClose, dismissible]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      role="presentation"
      onMouseDown={(event) => {
        if (dismissible && event.target === event.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-black/50 animate-fade-in" aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
        className={cn(
          'relative flex max-h-[calc(100vh-6rem)] w-full flex-col overflow-hidden rounded-lg border border-border bg-elevated shadow-modal animate-scale-in',
          SIZES[size],
          className,
        )}
      >
        {title || description ? (
          <header className="flex items-start justify-between gap-4 border-b border-border px-4 py-3">
            <div className="min-w-0">
              <h2 className={cn('truncate text-sm font-semibold', danger ? 'text-danger' : 'text-fg')}>
                {title}
              </h2>
              {description ? <p className="mt-0.5 text-xs text-fg-muted">{description}</p> : null}
            </div>
            <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close" disabled={!dismissible}>
              <X className="h-4 w-4" />
            </Button>
          </header>
        ) : null}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3.5">{children}</div>
        {footer ? (
          <footer className="flex items-center justify-end gap-2 border-t border-border bg-surface px-4 py-3">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

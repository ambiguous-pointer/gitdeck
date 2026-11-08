import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
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
  /** Extra classes for the scrollable body (e.g. `p-0` for edge-to-edge layouts). */
  bodyClassName?: string;
  /** Disable closing by backdrop / escape (e.g. while a command runs). */
  dismissible?: boolean;
  /** Accessible label for the close button. */
  closeLabel?: string;
}

const SIZES: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-[min(1280px,calc(100vw-4rem))] h-[calc(100vh-8rem)]',
};

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/* Focus-trap/scroll-lock stacks so nested modals behave like desktop windows. */
const modalStack: symbol[] = [];
let scrollLockCount = 0;
let previousBodyOverflow = '';

function lockBodyScroll(): void {
  if (typeof document === 'undefined') return;
  if (scrollLockCount === 0) {
    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  scrollLockCount += 1;
}

function unlockBodyScroll(): void {
  if (typeof document === 'undefined') return;
  scrollLockCount = Math.max(0, scrollLockCount - 1);
  if (scrollLockCount === 0) document.body.style.overflow = previousBodyOverflow;
}

function trapTabKey(event: KeyboardEvent, panel: HTMLDivElement): void {
  const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (node) => node.getClientRects().length > 0 && node.getAttribute('aria-hidden') !== 'true',
  );
  if (nodes.length === 0) {
    event.preventDefault();
    panel.focus();
    return;
  }
  const first = nodes[0]!;
  const last = nodes[nodes.length - 1]!;
  const active = document.activeElement;
  if (event.shiftKey) {
    if (active === first || active === panel || !panel.contains(active)) {
      event.preventDefault();
      last.focus();
    }
    return;
  }
  if (active === last) {
    event.preventDefault();
    first.focus();
  }
}

/**
 * Accessible modal dialog rendered in a portal:
 * focus trap, focus restore, Escape + backdrop close, body scroll lock and
 * nested-dialog aware stacking. Sizes map to a max width; content scrolls.
 */
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
  bodyClassName,
  dismissible = true,
  closeLabel = 'Close',
}: ModalProps): JSX.Element | null {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const onCloseRef = useRef(onClose);
  const dismissibleRef = useRef(dismissible);
  onCloseRef.current = onClose;
  dismissibleRef.current = dismissible;

  useEffect(() => {
    if (!open) return;
    const token = Symbol('modal');
    modalStack.push(token);
    lockBodyScroll();

    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const onKeyDown = (event: KeyboardEvent) => {
      if (!dismissibleRef.current && event.key !== 'Tab') return;
      const isTopmost = modalStack[modalStack.length - 1] === token;
      if (!isTopmost) return;
      if (event.key === 'Escape') {
        if (!dismissibleRef.current) return;
        event.stopPropagation();
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key === 'Tab' && panelRef.current) {
        trapTabKey(event, panelRef.current);
      }
    };
    document.addEventListener('keydown', onKeyDown, true);

    const timer = window.setTimeout(() => panelRef.current?.focus({ preventScroll: true }), 0);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', onKeyDown, true);
      const index = modalStack.indexOf(token);
      if (index >= 0) modalStack.splice(index, 1);
      unlockBodyScroll();
      // Only restore focus once the last dialog in the stack is gone.
      if (modalStack.length === 0) previousFocus?.focus?.({ preventScroll: true });
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      role="presentation"
      onMouseDown={(event) => {
        if (dismissible && event.target === event.currentTarget) onClose();
      }}
    >
      <div className="overlay-scrim absolute inset-0 animate-fade-in" aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
        className={cn(
          'relative flex max-h-[calc(100vh-3rem)] w-full flex-col overflow-hidden rounded-lg border border-border bg-elevated shadow-modal animate-scale-in',
          'focus:outline-none',
          SIZES[size],
          className,
        )}
      >
        {title != null || description != null ? (
          <header className="flex shrink-0 items-start justify-between gap-4 border-b border-border bg-elevated px-4 py-3">
            <div className="min-w-0">
              {title != null ? (
                <h2
                  id={titleId}
                  className={cn('truncate text-sm font-semibold leading-5', danger ? 'text-danger' : 'text-fg')}
                >
                  {title}
                </h2>
              ) : null}
              {description != null ? (
                <p id={descriptionId} className="mt-0.5 text-xs leading-4 text-fg-muted">
                  {description}
                </p>
              ) : null}
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onClose}
              aria-label={closeLabel}
              disabled={!dismissible}
              className="-mr-1 -mt-0.5 shrink-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </header>
        ) : null}
        <div className={cn('min-h-0 flex-1 overflow-y-auto px-4 py-3.5', bodyClassName)}>{children}</div>
        {footer ? (
          <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-border bg-surface px-4 py-3">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

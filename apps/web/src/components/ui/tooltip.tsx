import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';

export type TooltipSide = 'top' | 'bottom' | 'left' | 'right';

export interface TooltipProps {
  label: ReactNode;
  children: ReactNode;
  side?: TooltipSide;
  /** Delay before showing on hover (ms). Focus shows immediately. */
  delay?: number;
  className?: string;
}

const GAP = 6;
const VIEWPORT_MARGIN = 8;

/**
 * Lightweight tooltip rendered in a portal so it never gets clipped by
 * scroll containers or `overflow-hidden` panels. Hover (with delay) + focus.
 */
export function Tooltip({ label, children, side = 'top', delay = 320, className }: TooltipProps): JSX.Element {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ left: number; top: number; ready: boolean }>({
    left: 0,
    top: 0,
    ready: false,
  });

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const show = useCallback(
    (immediate: boolean) => {
      clearTimer();
      if (immediate) setOpen(true);
      else timerRef.current = window.setTimeout(() => setOpen(true), delay);
    },
    [clearTimer, delay],
  );

  const hide = useCallback(() => {
    clearTimer();
    setOpen(false);
  }, [clearTimer]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  // Hide on scroll/resize/escape so a floating tooltip never gets stale.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') hide();
    };
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    window.addEventListener('blur', hide);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide);
      window.removeEventListener('blur', hide);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [open, hide]);

  useLayoutEffect(() => {
    if (!open) {
      setPosition((current) => (current.ready ? { left: 0, top: 0, ready: false } : current));
      return;
    }
    const anchor = anchorRef.current;
    const tip = tipRef.current;
    if (!anchor || !tip) return;
    const a = anchor.getBoundingClientRect();
    const t = tip.getBoundingClientRect();
    let left = a.left + a.width / 2 - t.width / 2;
    let top = a.top - t.height - GAP;
    if (side === 'bottom') top = a.bottom + GAP;
    if (side === 'left') {
      left = a.left - t.width - GAP;
      top = a.top + a.height / 2 - t.height / 2;
    }
    if (side === 'right') {
      left = a.right + GAP;
      top = a.top + a.height / 2 - t.height / 2;
    }
    left = Math.min(Math.max(left, VIEWPORT_MARGIN), window.innerWidth - t.width - VIEWPORT_MARGIN);
    top = Math.min(Math.max(top, VIEWPORT_MARGIN), window.innerHeight - t.height - VIEWPORT_MARGIN);
    setPosition({ left, top, ready: true });
  }, [open, side]);

  return (
    <span
      ref={anchorRef}
      className={cn('inline-flex', className)}
      onMouseEnter={() => show(false)}
      onMouseLeave={hide}
      onMouseDown={hide}
      onFocus={() => show(true)}
      onBlur={hide}
    >
      {children}
      {open
        ? createPortal(
            <div
              ref={tipRef}
              role="tooltip"
              style={{ left: position.left, top: position.top, visibility: position.ready ? 'visible' : 'hidden' }}
              className="pointer-events-none fixed z-[70] max-w-[320px] whitespace-nowrap rounded border border-border bg-overlay px-2 py-1 text-2xs font-medium text-fg shadow-pop animate-fade-in"
            >
              {label}
            </div>,
            document.body,
          )
        : null}
    </span>
  );
}

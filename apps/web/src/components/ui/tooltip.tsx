import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface TooltipProps {
  label: ReactNode;
  children: ReactNode;
  side?: 'top' | 'bottom';
  className?: string;
}

/** Lightweight CSS-only tooltip (hover + focus). */
export function Tooltip({ label, children, side = 'top', className }: TooltipProps): JSX.Element {
  return (
    <span className={cn('group/tooltip relative inline-flex', className)}>
      {children}
      <span
        role="tooltip"
        className={cn(
          'pointer-events-none absolute z-[70] hidden whitespace-nowrap rounded border border-border bg-overlay px-2 py-1 text-2xs text-fg shadow-pop',
          'group-hover/tooltip:block group-focus-within/tooltip:block',
          side === 'top' ? 'bottom-[calc(100%+6px)] left-1/2 -translate-x-1/2' : 'top-[calc(100%+6px)] left-1/2 -translate-x-1/2',
        )}
      >
        {label}
      </span>
    </span>
  );
}

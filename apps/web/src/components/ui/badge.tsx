import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type BadgeVariant = 'default' | 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'outline';

export interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
  icon?: ReactNode;
  title?: string;
  /** Optional leading dot (status/branch indicator). */
  dot?: boolean;
  /** Use monospace glyphs (hashes, counts, shortcuts). */
  mono?: boolean;
}

const VARIANTS: Record<BadgeVariant, string> = {
  default: 'border border-border bg-elevated text-fg-secondary',
  accent: 'border tone-accent',
  success: 'border tone-success',
  warning: 'border tone-warning',
  danger: 'border tone-danger',
  info: 'border tone-info',
  outline: 'border border-border-strong bg-transparent text-fg-secondary',
};

const DOT: Record<BadgeVariant, string> = {
  default: 'bg-fg-muted',
  accent: 'bg-accent',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
  outline: 'bg-fg-muted',
};

export function Badge({
  variant = 'default',
  children,
  className,
  icon,
  title,
  dot,
  mono,
}: BadgeProps): JSX.Element {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex h-5 max-w-full select-none items-center gap-1 truncate rounded px-1.5 text-2xs font-medium leading-none',
        VARIANTS[variant],
        mono && 'mono tracking-tight',
        className,
      )}
    >
      {dot ? <span aria-hidden className={cn('h-1.5 w-1.5 shrink-0 rounded-full', DOT[variant])} /> : null}
      {icon ? (
        <span className="flex h-3 w-3 shrink-0 items-center justify-center [&>svg]:h-3 [&>svg]:w-3">{icon}</span>
      ) : null}
      <span className="truncate">{children}</span>
    </span>
  );
}

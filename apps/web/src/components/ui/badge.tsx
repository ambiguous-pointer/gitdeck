import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type BadgeVariant = 'default' | 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'outline';

export interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
  icon?: ReactNode;
  title?: string;
}

const VARIANTS: Record<BadgeVariant, string> = {
  default: 'bg-elevated text-fg-secondary border border-border',
  accent: 'bg-accent-soft text-accent border border-accent/30',
  success: 'bg-success/15 text-success border border-success/30',
  warning: 'bg-warning/15 text-warning border border-warning/30',
  danger: 'bg-danger/15 text-danger border border-danger/30',
  info: 'bg-info/15 text-info border border-info/30',
  outline: 'border border-border-strong text-fg-secondary',
};

export function Badge({ variant = 'default', children, className, icon, title }: BadgeProps): JSX.Element {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex h-5 max-w-full items-center gap-1 truncate rounded px-1.5 text-2xs font-medium leading-none',
        VARIANTS[variant],
        className,
      )}
    >
      {icon ? <span className="flex h-3 w-3 items-center justify-center">{icon}</span> : null}
      <span className="truncate">{children}</span>
    </span>
  );
}

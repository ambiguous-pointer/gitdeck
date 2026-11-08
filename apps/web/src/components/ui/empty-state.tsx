import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}

/** Centered empty/placeholder state with an icon medallion. */
export function EmptyState({ icon, title, description, action, className, compact }: EmptyStateProps): JSX.Element {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 text-center',
        compact ? 'p-5' : 'p-8',
        className,
      )}
    >
      {icon ? (
        <div
          className={cn(
            'mb-1 flex items-center justify-center rounded-full border border-border bg-elevated text-fg-muted',
            compact ? 'h-9 w-9 [&>svg]:h-4 [&>svg]:w-4' : 'h-11 w-11 [&>svg]:h-5 [&>svg]:w-5',
          )}
        >
          {icon}
        </div>
      ) : null}
      <p className={cn('font-medium text-fg-secondary', compact ? 'text-xs' : 'text-sm')}>{title}</p>
      {description ? (
        <p className="max-w-sm text-xs leading-5 text-fg-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

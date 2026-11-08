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

export function EmptyState({ icon, title, description, action, className, compact }: EmptyStateProps): JSX.Element {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 p-8 text-center', compact && 'p-5', className)}>
      {icon ? <div className="mb-1 text-fg-muted opacity-70">{icon}</div> : null}
      <p className="text-sm font-medium text-fg-secondary">{title}</p>
      {description ? <p className="max-w-sm text-xs leading-5 text-fg-muted">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

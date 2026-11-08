import { cn } from '@/lib/cn';

export function Skeleton({ className }: { className?: string }): JSX.Element {
  return <div aria-hidden className={cn('skeleton-shimmer rounded', className)} />;
}

export function SkeletonRows({ rows = 6, className }: { rows?: number; className?: string }): JSX.Element {
  return (
    <div className={cn('space-y-2 p-3', className)} aria-hidden>
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-6" />
      ))}
    </div>
  );
}

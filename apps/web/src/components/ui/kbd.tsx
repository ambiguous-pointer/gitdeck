import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function Kbd({ children, className }: { children: ReactNode; className?: string }): JSX.Element {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded border border-border-strong bg-elevated px-1 font-sans text-2xs text-fg-secondary',
        className,
      )}
    >
      {children}
    </kbd>
  );
}

/** Renders `Ctrl + K` style shortcut hints. */
export function Shortcut({ keys }: { keys: string[] }): JSX.Element {
  return (
    <span className="inline-flex items-center gap-1">
      {keys.map((key, index) => (
        <span key={`${key}-${index}`} className="inline-flex items-center gap-1">
          {index > 0 ? <span className="text-2xs text-fg-muted">+</span> : null}
          <Kbd>{key}</Kbd>
        </span>
      ))}
    </span>
  );
}

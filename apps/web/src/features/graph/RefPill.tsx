import { CircleDot, Cloud, GitBranch, Tag } from 'lucide-react';
import type { MouseEvent, ReactNode } from 'react';
import type { GitRef } from '@gitdeck/shared';
import { cn } from '@/lib/cn';

const REF_STYLES: Record<GitRef['type'], string> = {
  branch: 'border-accent/45 bg-accent-soft text-accent',
  remote: 'border-border-strong bg-elevated text-fg-secondary',
  tag: 'border-warning/40 bg-warning/15 text-warning',
  head: 'border-accent bg-accent text-accent-fg',
  stash: 'border-border bg-elevated text-fg-muted',
};

const REF_ICONS: Record<GitRef['type'], ReactNode> = {
  branch: <GitBranch className="h-2.5 w-2.5" />,
  remote: <Cloud className="h-2.5 w-2.5" />,
  tag: <Tag className="h-2.5 w-2.5" />,
  head: <CircleDot className="h-2.5 w-2.5" />,
  stash: <Tag className="h-2.5 w-2.5" />,
};

export interface RefPillProps {
  /** Named `gitRef` because React reserves the `ref` prop. */
  gitRef: GitRef;
  onClick?: (ref: GitRef) => void;
  onContextMenu?: (event: MouseEvent<HTMLButtonElement>, ref: GitRef) => void;
  className?: string;
}

/** Compact commit-graph ref label (local branch / remote / tag / HEAD). */
export function RefPill({ gitRef, onClick, onContextMenu, className }: RefPillProps): JSX.Element {
  const interactive = Boolean(onClick || onContextMenu);
  const label = gitRef.type === 'head' ? 'HEAD' : gitRef.label;
  return (
    <button
      type="button"
      tabIndex={interactive ? 0 : -1}
      onClick={onClick ? () => onClick(gitRef) : undefined}
      onContextMenu={
        onContextMenu
          ? (event) => {
              event.preventDefault();
              event.stopPropagation();
              onContextMenu(event, gitRef);
            }
          : undefined
      }
      title={gitRef.refName}
      className={cn(
        'inline-flex h-[17px] max-w-[160px] shrink-0 items-center gap-1 overflow-hidden rounded-[3px] border px-1 text-2xs font-medium leading-none',
        REF_STYLES[gitRef.type],
        !interactive && 'pointer-events-none',
        className,
      )}
    >
      <span className="flex h-2.5 w-2.5 shrink-0 items-center justify-center">{REF_ICONS[gitRef.type]}</span>
      <span className="truncate">{label}</span>
    </button>
  );
}

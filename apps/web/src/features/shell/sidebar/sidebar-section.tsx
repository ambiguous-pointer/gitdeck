import { ChevronDown, ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { useAppStore } from '@/stores/app-store';

export interface SidebarSectionProps {
  sectionKey: string;
  title: string;
  icon: ReactNode;
  count?: number;
  /** Optional header action (e.g. "create branch"). */
  action?: ReactNode;
  children: ReactNode;
}

/** Collapsible sidebar section (open/closed state persisted in the app store). */
export function SidebarSection({
  sectionKey,
  title,
  icon,
  count,
  action,
  children,
}: SidebarSectionProps): JSX.Element {
  const open = useAppStore((state) => state.sidebarSections[sectionKey] ?? true);
  const toggle = useAppStore((state) => state.toggleSidebarSection);

  return (
    <section className="border-b border-border-subtle">
      <div className="flex h-7 items-center gap-0.5 pl-0.5 pr-1">
        <button
          type="button"
          onClick={() => toggle(sectionKey)}
          className="flex h-full min-w-0 flex-1 items-center gap-1 rounded px-1 text-2xs font-semibold uppercase tracking-wide text-fg-muted transition-colors hover:text-fg"
          aria-expanded={open}
        >
          {open ? (
            <ChevronDown className="h-3 w-3 shrink-0" />
          ) : (
            <ChevronRight className="h-3 w-3 shrink-0" />
          )}
          <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center">{icon}</span>
          <span className="truncate">{title}</span>
          {count !== undefined ? (
            <span className="ml-auto rounded bg-elevated px-1 text-2xs font-normal text-fg-muted">
              {count}
            </span>
          ) : null}
        </button>
        {action ? <div className="flex shrink-0 items-center">{action}</div> : null}
      </div>
      {open ? <div className="pb-1">{children}</div> : null}
    </section>
  );
}

/** Small icon button rendered in a sidebar section header. */
export function SectionAction({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="flex h-5 w-5 items-center justify-center rounded text-fg-muted transition-colors hover:bg-hover hover:text-fg"
    >
      {icon}
    </button>
  );
}

/** Inline sub-heading used to split local vs remote branches. */
export function SidebarSubHeading({
  open,
  label,
  count,
  onToggle,
}: {
  open: boolean;
  label: string;
  count: number;
  onToggle: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex h-5 w-full items-center gap-1 px-2 text-2xs uppercase tracking-wide text-fg-muted transition-colors hover:text-fg"
      aria-expanded={open}
    >
      {open ? <ChevronDown className="h-2.5 w-2.5" /> : <ChevronRight className="h-2.5 w-2.5" />}
      <span className="truncate">{label}</span>
      <span className="ml-auto rounded px-1 text-2xs text-fg-muted/80">{count}</span>
    </button>
  );
}

export const sidebarRowClass = cn(
  'group flex h-6 w-full min-w-0 items-center gap-1.5 rounded px-2 text-left text-xs transition-colors',
);

import { useRef, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface TabItem {
  id: string;
  label: ReactNode;
  icon?: ReactNode;
  badge?: ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  tabs: TabItem[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
  size?: 'sm' | 'md';
}

/** Underlined tab strip with roving-focus keyboard support (←/→/Home/End). */
export function Tabs({ tabs, value, onChange, className, size = 'md' }: TabsProps): JSX.Element {
  const listRef = useRef<HTMLDivElement>(null);

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const enabled = tabs.filter((tab) => !tab.disabled);
    if (enabled.length === 0) return;
    const current = enabled.findIndex((tab) => tab.id === value);
    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight') nextIndex = current < 0 ? 0 : (current + 1) % enabled.length;
    else if (event.key === 'ArrowLeft') nextIndex = current < 0 ? enabled.length - 1 : (current - 1 + enabled.length) % enabled.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = enabled.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    const next = enabled[nextIndex]!;
    onChange(next.id);
    const node = listRef.current?.querySelector<HTMLElement>(`[data-tab-id="${CSS.escape(next.id)}"]`);
    node?.focus();
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      onKeyDown={onKeyDown}
      className={cn('flex min-w-0 items-center gap-0.5 border-b border-border', className)}
    >
      {tabs.map((tab) => {
        const active = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            data-tab-id={tab.id}
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            disabled={tab.disabled}
            onClick={() => onChange(tab.id)}
            className={cn(
              'relative -mb-px flex select-none items-center gap-1.5 whitespace-nowrap border-b-2 font-medium transition-colors duration-100',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent',
              size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-8 px-3 text-[13px]',
              active
                ? 'border-accent text-fg'
                : 'border-transparent text-fg-muted hover:text-fg-secondary',
              tab.disabled && 'cursor-not-allowed opacity-50',
            )}
          >
            {tab.icon ? <span className="flex h-3.5 w-3.5 items-center justify-center">{tab.icon}</span> : null}
            <span>{tab.label}</span>
            {tab.badge != null ? (
              <span
                className={cn(
                  'min-w-[16px] rounded px-1 text-center text-2xs leading-4',
                  active ? 'tone-accent' : 'bg-hover text-fg-muted',
                )}
              >
                {tab.badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

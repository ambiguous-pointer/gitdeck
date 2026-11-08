import type { ReactNode } from 'react';
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

export function Tabs({ tabs, value, onChange, className, size = 'md' }: TabsProps): JSX.Element {
  return (
    <div
      role="tablist"
      className={cn('flex items-center gap-0.5 border-b border-border', className)}
    >
      {tabs.map((tab) => {
        const active = tab.id === value;
        return (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={active}
            disabled={tab.disabled}
            onClick={() => onChange(tab.id)}
            className={cn(
              'relative flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 font-medium transition-colors',
              size === 'sm' ? 'h-7 text-xs' : 'h-8 text-[13px]',
              active
                ? 'border-accent text-fg'
                : 'border-transparent text-fg-muted hover:border-border-strong hover:text-fg',
              tab.disabled && 'cursor-not-allowed opacity-50',
            )}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.badge != null ? (
              <span
                className={cn(
                  'rounded px-1 text-2xs',
                  active ? 'bg-accent-soft text-accent' : 'bg-elevated text-fg-muted',
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

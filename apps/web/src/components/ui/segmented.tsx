import { useRef, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  size?: 'sm' | 'md';
  fullWidth?: boolean;
}

/** Compact radio-group control with ←/→ keyboard navigation. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
  size = 'md',
  fullWidth,
}: SegmentedControlProps<T>): JSX.Element {
  const groupRef = useRef<HTMLDivElement>(null);

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const enabled = options.filter((option) => !option.disabled);
    if (enabled.length === 0) return;
    const current = enabled.findIndex((option) => option.value === value);
    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = current < 0 ? 0 : (current + 1) % enabled.length;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = current < 0 ? enabled.length - 1 : (current - 1 + enabled.length) % enabled.length;
    } else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = enabled.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    const next = enabled[nextIndex]!;
    onChange(next.value);
    const node = groupRef.current?.querySelector<HTMLElement>(`[data-segment-value="${CSS.escape(next.value)}"]`);
    node?.focus();
  };

  return (
    <div
      ref={groupRef}
      role="radiogroup"
      onKeyDown={onKeyDown}
      className={cn(
        'inline-flex items-center gap-0.5 rounded-md border border-border bg-canvas p-0.5',
        fullWidth && 'flex w-full',
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            data-segment-value={option.value}
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              'flex select-none items-center justify-center gap-1.5 rounded font-medium transition-[background-color,color,box-shadow] duration-100',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              size === 'sm' ? 'h-6 px-2 text-2xs' : 'h-7 px-2.5 text-xs',
              fullWidth && 'flex-1',
              active ? 'bg-elevated text-fg shadow-panel' : 'text-fg-muted hover:bg-hover hover:text-fg-secondary',
              option.disabled && 'cursor-not-allowed opacity-50',
            )}
          >
            {option.icon ? <span className="flex h-3.5 w-3.5 items-center justify-center">{option.icon}</span> : null}
            <span className="truncate">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

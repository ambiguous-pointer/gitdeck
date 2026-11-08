import { cn } from '@/lib/cn';

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  label?: string;
  id?: string;
  size?: 'sm' | 'md';
}

/** Accessible toggle switch (native button with `role="switch"`). */
export function Switch({ checked, onChange, disabled, className, label, id, size = 'md' }: SwitchProps): JSX.Element {
  const small = size === 'sm';
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'group relative inline-flex shrink-0 items-center rounded-full border transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-canvas',
        small ? 'h-4 w-7' : 'h-5 w-9',
        checked ? 'border-accent bg-accent' : 'border-border-strong bg-elevated hover:border-fg-muted',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          'pointer-events-none inline-block rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.3)] transition-transform duration-150 ease-out',
          small ? 'h-3 w-3' : 'h-3.5 w-3.5',
          small
            ? checked
              ? 'translate-x-[13px]'
              : 'translate-x-[3px]'
            : checked
              ? 'translate-x-[18px]'
              : 'translate-x-[3px]',
        )}
      />
    </button>
  );
}

import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: React.ReactNode;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export function Checkbox({ checked, onChange, label, disabled, className, id }: CheckboxProps): JSX.Element {
  return (
    <label
      className={cn(
        'inline-flex cursor-pointer select-none items-center gap-2 text-[13px] text-fg',
        disabled && 'cursor-not-allowed opacity-60',
        className,
      )}
    >
      <span
        className={cn(
          'flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors',
          checked ? 'border-accent bg-accent text-accent-fg' : 'border-border-strong bg-canvas',
        )}
      >
        {checked ? <Check className="h-3 w-3" strokeWidth={3} aria-hidden /> : null}
      </span>
      <input
        id={id}
        type="checkbox"
        className="sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      {label ? <span className="leading-5">{label}</span> : null}
    </label>
  );
}

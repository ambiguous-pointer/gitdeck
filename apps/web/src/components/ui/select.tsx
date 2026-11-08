import { useId } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  'aria-label'?: string;
}

/**
 * Minimal styled native select: reliable, keyboard and screen-reader friendly.
 * (The design-system branch may replace it with a richer listbox.)
 */
export function Select({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  className,
  id,
  ...rest
}: SelectProps): JSX.Element {
  const generatedId = useId();
  return (
    <div className={cn('relative', className)}>
      <select
        id={id ?? generatedId}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          'h-8 w-full appearance-none truncate rounded-md border border-border bg-canvas pl-2.5 pr-7 text-[13px] text-fg',
          'focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25',
          'disabled:cursor-not-allowed disabled:opacity-60',
        )}
        aria-label={rest['aria-label']}
      >
        {placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-muted" />
    </div>
  );
}

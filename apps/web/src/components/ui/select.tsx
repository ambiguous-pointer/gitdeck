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
  size?: 'sm' | 'md';
  invalid?: boolean;
  'aria-label'?: string;
}

/**
 * Styled native select: reliable, keyboard and screen-reader friendly (no
 * custom listbox needed — the native popup is faster and fully accessible).
 */
export function Select({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  className,
  id,
  size = 'md',
  invalid,
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
        aria-label={rest['aria-label']}
        aria-invalid={invalid || undefined}
        className={cn(
          'w-full appearance-none truncate rounded-md border border-border bg-canvas pl-2.5 pr-7 text-fg',
          'transition-[border-color,box-shadow] duration-100 hover:border-border-strong',
          'focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent',
          'disabled:cursor-not-allowed disabled:opacity-60',
          size === 'sm' ? 'h-7 text-xs' : 'h-8 text-[13px]',
          invalid && 'border-danger focus:border-danger focus:ring-danger',
        )}
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
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-muted"
      />
    </div>
  );
}

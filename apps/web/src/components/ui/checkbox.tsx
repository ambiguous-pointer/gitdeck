import { Check, Minus } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: ReactNode;
  /** Optional second line shown under the label. */
  description?: ReactNode;
  /** Visually render the mixed state (e.g. partial selection). */
  indeterminate?: boolean;
  disabled?: boolean;
  className?: string;
  id?: string;
}

/**
 * Dense, accessible checkbox row. The native input stays in the layout (so
 * keyboard, focus and screen readers behave natively) and is visually covered
 * by the themed control.
 */
export function Checkbox({
  checked,
  onChange,
  label,
  description,
  indeterminate,
  disabled,
  className,
  id,
}: CheckboxProps): JSX.Element {
  const active = checked || Boolean(indeterminate);
  return (
    <label
      className={cn(
        'group inline-flex select-none items-start gap-2 text-[13px] text-fg',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
        className,
      )}
    >
      <span className="relative mt-px inline-flex h-4 w-4 shrink-0 items-center justify-center">
        <input
          id={id}
          type="checkbox"
          className="peer absolute inset-0 z-10 m-0 h-full w-full cursor-pointer appearance-none rounded-[4px] opacity-0 disabled:cursor-not-allowed"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
          ref={(node) => {
            if (node) node.indeterminate = Boolean(indeterminate) && !checked;
          }}
        />
        <span
          aria-hidden
          className={cn(
            'flex h-4 w-4 items-center justify-center rounded-[4px] border transition-colors duration-100',
            'peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-1 peer-focus-visible:ring-offset-canvas',
            active
              ? 'border-accent bg-accent text-accent-fg'
              : 'border-border-strong bg-canvas group-hover:border-fg-muted',
          )}
        >
          {indeterminate && !checked ? (
            <Minus className="h-3 w-3" strokeWidth={3} aria-hidden />
          ) : checked ? (
            <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
          ) : null}
        </span>
      </span>
      {label != null || description != null ? (
        <span className="min-w-0 leading-[18px]">
          {label != null ? <span className="block truncate">{label}</span> : null}
          {description != null ? <span className="block text-xs text-fg-muted">{description}</span> : null}
        </span>
      ) : null}
    </label>
  );
}

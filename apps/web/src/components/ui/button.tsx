import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline' | 'subtle';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'icon' | 'icon-sm';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  /** Stretch to the width of the parent container. */
  fullWidth?: boolean;
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-accent text-accent-fg shadow-panel hover:bg-accent-hover active:brightness-95 border border-transparent',
  secondary:
    'border border-border bg-elevated text-fg shadow-panel hover:border-border-strong hover:bg-hover active:bg-active',
  ghost: 'border border-transparent text-fg-secondary hover:bg-hover hover:text-fg active:bg-active',
  danger: 'border border-transparent bg-danger text-white shadow-panel hover:brightness-110 active:brightness-95',
  outline:
    'border border-border-strong bg-transparent text-fg hover:border-border-strong hover:bg-hover active:bg-active',
  subtle: 'border border-transparent bg-accent-soft text-accent hover-accent-soft active:brightness-95',
};

const SIZES: Record<ButtonSize, string> = {
  xs: 'h-6 gap-1 rounded px-2 text-2xs',
  sm: 'h-7 gap-1.5 rounded px-2.5 text-xs',
  md: 'h-8 gap-1.5 rounded-md px-3 text-[13px]',
  icon: 'h-8 w-8 rounded-md',
  'icon-sm': 'h-7 w-7 rounded',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'secondary',
    size = 'md',
    loading,
    icon,
    fullWidth,
    className,
    children,
    disabled,
    type = 'button',
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'relative inline-flex select-none items-center justify-center whitespace-nowrap font-medium leading-none transition-[background-color,border-color,color,filter,box-shadow] duration-100',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
        'disabled:pointer-events-none disabled:opacity-50',
        VARIANTS[variant],
        SIZES[size],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
      ) : icon ? (
        <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center [&>svg]:h-3.5 [&>svg]:w-3.5">
          {icon}
        </span>
      ) : null}
      {children != null && children !== '' ? (
        <span className={cn('truncate', (loading || icon) && 'ml-0.5')}>{children}</span>
      ) : null}
    </button>
  );
});

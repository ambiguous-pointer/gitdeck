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
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-accent-fg hover:bg-accent-hover shadow-sm',
  secondary: 'bg-elevated text-fg border border-border hover:bg-hover hover:border-border-strong',
  ghost: 'text-fg-secondary hover:bg-hover hover:text-fg',
  danger: 'bg-danger text-white hover:opacity-90',
  outline: 'border border-border text-fg hover:bg-hover hover:border-border-strong',
  subtle: 'bg-accent-soft text-accent hover:bg-accent/25',
};

const SIZES: Record<ButtonSize, string> = {
  xs: 'h-6 gap-1 rounded px-2 text-2xs',
  sm: 'h-7 gap-1.5 rounded px-2.5 text-xs',
  md: 'h-8 gap-2 rounded-md px-3 text-[13px]',
  icon: 'h-8 w-8 rounded-md',
  'icon-sm': 'h-7 w-7 rounded',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading, icon, className, children, disabled, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        'inline-flex select-none items-center justify-center whitespace-nowrap font-medium transition-colors',
        'disabled:pointer-events-none disabled:opacity-50',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
});

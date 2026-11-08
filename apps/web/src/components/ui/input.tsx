import { forwardRef, type InputHTMLAttributes, type LabelHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ className, invalid, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        'h-8 w-full rounded-md border border-border bg-canvas px-2.5 text-[13px] text-fg',
        'placeholder:text-fg-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25',
        'disabled:cursor-not-allowed disabled:opacity-60',
        invalid && 'border-danger focus:border-danger focus:ring-danger/25',
        className,
      )}
      {...props}
    />
  );
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, invalid, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      className={cn(
        'w-full rounded-md border border-border bg-canvas px-2.5 py-2 text-[13px] text-fg',
        'placeholder:text-fg-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25',
        'disabled:cursor-not-allowed disabled:opacity-60',
        invalid && 'border-danger focus:border-danger focus:ring-danger/25',
        className,
      )}
      {...props}
    />
  );
});

export interface FieldProps {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function Field({ label, hint, error, required, className, children }: FieldProps): JSX.Element {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label ? (
        <label className="block text-xs font-medium text-fg-secondary">
          {label}
          {required ? <span className="ml-0.5 text-danger">*</span> : null}
        </label>
      ) : null}
      {children}
      {error ? (
        <p className="text-xs text-danger">{error}</p>
      ) : hint ? (
        <p className="text-xs text-fg-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {}

export function Label({ className, ...props }: LabelProps): JSX.Element {
  return <label className={cn('text-xs font-medium text-fg-secondary', className)} {...props} />;
}

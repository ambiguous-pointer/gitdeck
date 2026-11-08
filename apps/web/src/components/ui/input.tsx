import {
  forwardRef,
  type InputHTMLAttributes,
  type LabelHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react';
import { cn } from '@/lib/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

const FIELD_BASE =
  'w-full rounded-md border border-border bg-canvas text-[13px] text-fg ' +
  'placeholder:text-fg-muted ' +
  'transition-[border-color,box-shadow] duration-100 ' +
  'hover:border-border-strong ' +
  'focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent ' +
  'disabled:cursor-not-allowed disabled:opacity-60';

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        FIELD_BASE,
        'h-8 px-2.5',
        invalid && 'border-danger focus:border-danger focus:ring-danger',
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
      aria-invalid={invalid || undefined}
      className={cn(
        FIELD_BASE,
        'min-h-[64px] resize-y px-2.5 py-2 leading-5',
        invalid && 'border-danger focus:border-danger focus:ring-danger',
        className,
      )}
      {...props}
    />
  );
});

export interface FieldProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  /** Associates the visible label with a form control. */
  htmlFor?: string;
  className?: string;
  children: ReactNode;
}

export function Field({ label, hint, error, required, htmlFor, className, children }: FieldProps): JSX.Element {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label ? (
        <label htmlFor={htmlFor} className="flex items-center gap-1 text-xs font-medium text-fg-secondary">
          {label}
          {required ? (
            <span className="text-danger" aria-hidden>
              *
            </span>
          ) : null}
        </label>
      ) : null}
      {children}
      {error ? (
        <p className="text-xs leading-4 text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs leading-4 text-fg-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {}

export function Label({ className, ...props }: LabelProps): JSX.Element {
  return <label className={cn('text-xs font-medium text-fg-secondary', className)} {...props} />;
}

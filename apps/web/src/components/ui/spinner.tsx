import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface SpinnerProps {
  size?: number;
  className?: string;
  /** Optional accessible label; when omitted the spinner is decorative. */
  label?: string;
}

export function Spinner({ size = 16, className, label }: SpinnerProps): JSX.Element {
  return (
    <span
      role={label ? 'status' : undefined}
      aria-label={label}
      className={cn('inline-flex items-center justify-center text-fg-muted', className)}
    >
      <Loader2 className="animate-spin" style={{ width: size, height: size }} aria-hidden />
    </span>
  );
}

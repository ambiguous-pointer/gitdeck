import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

export function Spinner({ size = 16, className }: { size?: number; className?: string }): JSX.Element {
  return <Loader2 className={cn('animate-spin text-fg-muted', className)} style={{ width: size, height: size }} />;
}

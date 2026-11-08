import { cn } from '@/lib/cn';
import { initials, nameHue } from '@/lib/format';

export interface AvatarProps {
  name: string;
  email?: string;
  size?: number;
  src?: string;
  className?: string;
  ring?: boolean;
}

export function Avatar({ name, email, size = 28, src, className, ring }: AvatarProps): JSX.Element {
  const hue = nameHue(name || email || '?');
  const style = {
    width: size,
    height: size,
    fontSize: Math.max(9, Math.round(size * 0.36)),
    backgroundColor: `hsl(${hue} 55% 42%)`,
    color: '#fff',
  } as const;

  return (
    <span
      title={email ? `${name} <${email}>` : name}
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full font-semibold',
        ring && 'ring-2 ring-border',
        className,
      )}
      style={style}
    >
      {src ? <img src={src} alt={name} className="h-full w-full object-cover" /> : initials(name || email || '?')}
    </span>
  );
}

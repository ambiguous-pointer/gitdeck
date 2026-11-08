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

/** Deterministic gradient avatar with initials fallback. */
export function Avatar({ name, email, size = 28, src, className, ring }: AvatarProps): JSX.Element {
  const seed = name || email || '?';
  const hue = nameHue(seed);
  const style = {
    width: size,
    height: size,
    fontSize: Math.max(9, Math.round(size * 0.36)),
    backgroundImage: `linear-gradient(135deg, hsl(${hue} 52% 47%), hsl(${(hue + 22) % 360} 56% 38%))`,
    color: '#ffffff',
    boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.12)',
  } as const;

  return (
    <span
      title={email ? `${name} <${email}>` : name}
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full font-semibold uppercase leading-none',
        ring && 'ring-2 ring-border',
        className,
      )}
      style={style}
    >
      {src ? <img src={src} alt={name} className="h-full w-full object-cover" /> : initials(seed)}
    </span>
  );
}

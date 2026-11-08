import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';

export interface MenuItemSpec {
  id: string;
  label: ReactNode;
  icon?: ReactNode;
  shortcut?: string;
  danger?: boolean;
  disabled?: boolean;
  /** Render a separator above this item. */
  separatorBefore?: boolean;
  checked?: boolean;
}

interface MenuListProps {
  items: MenuItemSpec[];
  onSelect: (id: string) => void;
  className?: string;
}

function MenuList({ items, onSelect, className }: MenuListProps): JSX.Element {
  return (
    <div
      role="menu"
      className={cn(
        'min-w-[220px] overflow-hidden rounded-md border border-border bg-elevated py-1 shadow-pop animate-scale-in',
        className,
      )}
    >
      {items.map((item) => (
        <div key={item.id}>
          {item.separatorBefore ? <div className="my-1 h-px bg-border" /> : null}
          <button
            type="button"
            role="menuitem"
            disabled={item.disabled}
            onClick={() => onSelect(item.id)}
            className={cn(
              'flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13px] transition-colors',
              'disabled:cursor-not-allowed disabled:opacity-40',
              item.danger ? 'text-danger hover:bg-danger/10' : 'text-fg hover:bg-hover',
            )}
          >
            {item.icon ? <span className="flex h-4 w-4 shrink-0 items-center justify-center text-fg-muted">{item.icon}</span> : null}
            <span className="flex-1 truncate">{item.label}</span>
            {item.shortcut ? <span className="text-2xs text-fg-muted">{item.shortcut}</span> : null}
            {item.checked ? <span className="text-accent">✓</span> : null}
          </button>
        </div>
      ))}
    </div>
  );
}

export interface ContextMenuProps {
  x: number;
  y: number;
  items: MenuItemSpec[];
  onSelect: (id: string) => void;
  onClose: () => void;
}

/** Right-click menu anchored at viewport coordinates. */
export function ContextMenu({ x, y, items, onSelect, onClose }: ContextMenuProps): JSX.Element {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: x, top: y });

  useLayoutEffect(() => {
    const element = menuRef.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const margin = 8;
    setPosition({
      left: Math.min(x, window.innerWidth - rect.width - margin),
      top: Math.min(y, window.innerHeight - rect.height - margin),
    });
  }, [x, y]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onClose);
    window.addEventListener('scroll', onClose, true);
    return () => {
      document.removeEventListener('mousedown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onClose);
      window.removeEventListener('scroll', onClose, true);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-[60]"
      style={{ left: position.left, top: position.top }}
      onContextMenu={(event) => event.preventDefault()}
    >
      <MenuList
        items={items}
        onSelect={(id) => {
          onClose();
          onSelect(id);
        }}
      />
    </div>,
    document.body,
  );
}

export interface DropdownMenuProps {
  trigger: ReactNode;
  items: MenuItemSpec[];
  onSelect: (id: string) => void;
  align?: 'start' | 'end';
  className?: string;
}

/** Click triggered dropdown menu. */
export function DropdownMenu({ trigger, items, onSelect, align = 'start', className }: DropdownMenuProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div onClick={() => setOpen((value) => !value)}>{trigger}</div>
      {open ? (
        <div className={cn('absolute top-[calc(100%+4px)] z-50', align === 'end' ? 'right-0' : 'left-0')}>
          <MenuList
            items={items}
            onSelect={(id) => {
              setOpen(false);
              onSelect(id);
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

import { Check, ChevronDown } from 'lucide-react';
import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';
import { Button, type ButtonSize, type ButtonVariant } from './button';

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
  onClose: () => void;
  className?: string;
  menuId: string;
}

/** Keyboard-navigable ARIA menu (ArrowUp/Down/Home/End, Enter/Space, Esc). */
function MenuList({ items, onSelect, onClose, className, menuId }: MenuListProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const enabledIndexes = items.map((item, index) => (item.disabled ? -1 : index)).filter((index) => index >= 0);
  const [activeIndex, setActiveIndex] = useState<number>(() => enabledIndexes[0] ?? -1);

  const focusItem = useCallback((index: number) => {
    setActiveIndex(index);
    const node = containerRef.current?.querySelector<HTMLElement>(`#${CSS.escape(`${menuId}-item-${index}`)}`);
    node?.scrollIntoView({ block: 'nearest' });
  }, [menuId]);

  const move = useCallback(
    (direction: 1 | -1) => {
      if (enabledIndexes.length === 0) return;
      const currentPosition = enabledIndexes.indexOf(activeIndex);
      const nextPosition =
        currentPosition < 0
          ? direction > 0
            ? 0
            : enabledIndexes.length - 1
          : (currentPosition + direction + enabledIndexes.length) % enabledIndexes.length;
      focusItem(enabledIndexes[nextPosition]!);
    },
    [activeIndex, enabledIndexes, focusItem],
  );

  const activate = useCallback(
    (index: number) => {
      const item = items[index];
      if (!item || item.disabled) return;
      onSelect(item.id);
    },
    [items, onSelect],
  );

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        move(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        move(-1);
        break;
      case 'Home':
        event.preventDefault();
        if (enabledIndexes.length > 0) focusItem(enabledIndexes[0]!);
        break;
      case 'End':
        event.preventDefault();
        if (enabledIndexes.length > 0) focusItem(enabledIndexes[enabledIndexes.length - 1]!);
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        activate(activeIndex);
        break;
      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        onClose();
        break;
      case 'Tab':
        event.preventDefault();
        onClose();
        break;
      default:
        break;
    }
  };

  useEffect(() => {
    containerRef.current?.focus({ preventScroll: true });
  }, []);

  // Keep the highlight inside the list if the items array changes while open.
  useEffect(() => {
    if (activeIndex >= 0 && items[activeIndex] && !items[activeIndex]!.disabled) return;
    setActiveIndex(enabledIndexes[0] ?? -1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, activeIndex]);

  return (
    <div
      ref={containerRef}
      id={menuId}
      role="menu"
      tabIndex={-1}
      aria-activedescendant={activeIndex >= 0 ? `${menuId}-item-${activeIndex}` : undefined}
      onKeyDown={onKeyDown}
      className={cn(
        'min-w-[220px] max-w-[340px] overflow-y-auto rounded-md border border-border bg-elevated py-1 shadow-pop outline-none animate-scale-in',
        className,
      )}
    >
      {items.map((item, index) => (
        <div key={item.id}>
          {item.separatorBefore ? <div role="separator" className="my-1 h-px bg-border-subtle" /> : null}
          <button
            id={`${menuId}-item-${index}`}
            type="button"
            role="menuitem"
            tabIndex={-1}
            aria-disabled={item.disabled || undefined}
            disabled={item.disabled}
            onMouseEnter={() => !item.disabled && setActiveIndex(index)}
            onClick={() => activate(index)}
            className={cn(
              'flex w-full select-none items-center gap-2.5 px-2.5 py-1.5 text-left text-[13px] leading-4 transition-colors duration-75',
              'disabled:cursor-not-allowed disabled:opacity-40',
              item.danger
                ? 'text-danger hover-danger-soft'
                : 'text-fg-secondary hover:text-fg',
              !item.danger && (activeIndex === index ? 'bg-hover text-fg' : ''),
              item.danger && activeIndex === index ? 'danger-active' : '',
            )}
          >
            {item.icon ? (
              <span className="flex h-4 w-4 shrink-0 items-center justify-center text-fg-muted [&>svg]:h-3.5 [&>svg]:w-3.5">
                {item.icon}
              </span>
            ) : (
              <span className="h-4 w-4 shrink-0" aria-hidden />
            )}
            <span className="flex-1 truncate">{item.label}</span>
            {item.shortcut ? (
              <span className="ml-3 shrink-0 text-2xs tracking-wide text-fg-muted">{item.shortcut}</span>
            ) : null}
            {item.checked ? <Check className="ml-2 h-3.5 w-3.5 shrink-0 text-accent" aria-hidden /> : null}
          </button>
        </div>
      ))}
    </div>
  );
}

/**
 * Attach the global close-on-outside behaviors shared by all menus. Restores
 * focus on close only when focus was dropped to `<body>` (an outside click on
 * another focusable control should keep its focus).
 */
function useDismissOnOutside(
  open: boolean,
  ref: React.RefObject<HTMLElement>,
  onClose: () => void,
  restoreFocusRef?: React.MutableRefObject<HTMLElement | null>,
): void {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) onCloseRef.current();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCloseRef.current();
      }
    };
    const onViewportChange = () => onCloseRef.current();
    document.addEventListener('mousedown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('resize', onViewportChange);
    window.addEventListener('scroll', onViewportChange, true);
    return () => {
      document.removeEventListener('mousedown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('resize', onViewportChange);
      window.removeEventListener('scroll', onViewportChange, true);
      const active = document.activeElement;
      if (restoreFocusRef && (!active || active === document.body)) {
        restoreFocusRef.current?.focus?.({ preventScroll: true });
      }
    };
  }, [open, ref, restoreFocusRef]);
}

const VIEWPORT_MARGIN = 8;

export interface ContextMenuProps {
  x: number;
  y: number;
  items: MenuItemSpec[];
  onSelect: (id: string) => void;
  onClose: () => void;
}

/** Right-click menu anchored at viewport coordinates, clamped to the screen. */
export function ContextMenu({ x, y, items, onSelect, onClose }: ContextMenuProps): JSX.Element {
  const menuRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(
    typeof document !== 'undefined' && document.activeElement instanceof HTMLElement ? document.activeElement : null,
  );
  const [position, setPosition] = useState<{ left: number; top: number; ready: boolean }>({
    left: x,
    top: y,
    ready: false,
  });
  const menuId = useId();

  useLayoutEffect(() => {
    const element = menuRef.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const maxLeft = Math.max(VIEWPORT_MARGIN, window.innerWidth - rect.width - VIEWPORT_MARGIN);
    const showAbove = y + rect.height > window.innerHeight - VIEWPORT_MARGIN && y - rect.height > VIEWPORT_MARGIN;
    const maxTop = Math.max(VIEWPORT_MARGIN, window.innerHeight - rect.height - VIEWPORT_MARGIN);
    setPosition({
      left: Math.min(Math.max(x, VIEWPORT_MARGIN), maxLeft),
      top: Math.min(showAbove ? y - rect.height : y, maxTop),
      ready: true,
    });
  }, [x, y]);

  useDismissOnOutside(true, menuRef, onClose, restoreFocusRef);

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-[60]"
      style={{ left: position.left, top: position.top, opacity: position.ready ? 1 : 0, pointerEvents: position.ready ? 'auto' : 'none' }}
      onContextMenu={(event) => event.preventDefault()}
    >
      <MenuList
        menuId={menuId}
        items={items}
        onSelect={(id) => {
          onClose();
          onSelect(id);
        }}
        onClose={onClose}
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

/** Click-triggered dropdown menu, portalled and clamped to the viewport. */
export function DropdownMenu({ trigger, items, onSelect, align = 'start', className }: DropdownMenuProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const openedFromRef = useRef<HTMLElement | null>(null);
  const [position, setPosition] = useState({ left: 0, top: 0, ready: false });
  const menuId = useId();

  const close = useCallback(() => setOpen(false), []);

  useLayoutEffect(() => {
    if (!open) {
      setPosition((current) => (current.ready ? { left: 0, top: 0, ready: false } : current));
      return;
    }
    const triggerEl = triggerRef.current;
    const menuEl = menuRef.current;
    if (!triggerEl || !menuEl) return;
    const triggerRect = triggerEl.getBoundingClientRect();
    const menuRect = menuEl.getBoundingClientRect();
    const maxLeft = Math.max(VIEWPORT_MARGIN, window.innerWidth - menuRect.width - VIEWPORT_MARGIN);
    const desiredLeft = align === 'end' ? triggerRect.right - menuRect.width : triggerRect.left;
    const showAbove =
      triggerRect.bottom + menuRect.height > window.innerHeight - VIEWPORT_MARGIN &&
      triggerRect.top - menuRect.height > VIEWPORT_MARGIN;
    const desiredTop = showAbove ? triggerRect.top - menuRect.height - 4 : triggerRect.bottom + 4;
    setPosition({
      left: Math.min(Math.max(desiredLeft, VIEWPORT_MARGIN), maxLeft),
      top: Math.min(Math.max(desiredTop, VIEWPORT_MARGIN), window.innerHeight - menuRect.height - VIEWPORT_MARGIN),
      ready: true,
    });
  }, [open, align]);

  useDismissOnOutside(open, containerRef, close, openedFromRef);

  return (
    <div ref={containerRef} className={cn('relative inline-flex', className)}>
      <div
        ref={triggerRef}
        onClick={() => {
          openedFromRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
          setOpen((value) => !value);
        }}
        aria-expanded={open}
      >
        {trigger}
      </div>
      {open
        ? createPortal(
            <div
              ref={menuRef}
              className="fixed z-[60]"
              style={{
                left: position.left,
                top: position.top,
                visibility: position.ready ? 'visible' : 'hidden',
              }}
            >
              <MenuList
                menuId={menuId}
                items={items}
                onSelect={(id) => {
                  setOpen(false);
                  onSelect(id);
                }}
                onClose={close}
              />
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

export interface MenuButtonProps extends Omit<DropdownMenuProps, 'trigger'> {
  trigger?: ReactNode;
  label?: ReactNode;
  icon?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  buttonProps?: ButtonHTMLAttributes<HTMLButtonElement>;
}

/**
 * Convenience button + dropdown: render a themed `Button` labelled by `label`
 * (or pass a custom `trigger`). Useful for toolbar and row actions.
 */
export const MenuButton = forwardRef<HTMLButtonElement, MenuButtonProps>(function MenuButton(
  { trigger, label, icon, variant = 'secondary', size = 'sm', buttonProps, ...menuProps },
  ref,
) {
  const defaultTrigger = (
    <Button ref={ref} variant={variant} size={size} icon={icon} {...buttonProps}>
      {label}
      <ChevronDown className="ml-0.5 h-3 w-3 shrink-0 text-fg-muted" aria-hidden />
    </Button>
  );
  return <DropdownMenu {...menuProps} trigger={trigger ?? defaultTrigger} />;
});

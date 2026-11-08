import { useCallback, useState } from 'react';
import { ContextMenu, type MenuItemSpec } from '@/components/ui/menu';

export interface MenuState {
  x: number;
  y: number;
  items: MenuItemSpec[];
  onSelect: (id: string) => void;
}

export interface ContextMenuController {
  menu: MenuState | null;
  openMenu: (
    event: { clientX: number; clientY: number; preventDefault: () => void; stopPropagation: () => void },
    items: MenuItemSpec[],
    onSelect: (id: string) => void,
  ) => void;
  closeMenu: () => void;
}

/** Shared state controller for right-click menus across shell + graph. */
export function useContextMenuController(): ContextMenuController {
  const [menu, setMenu] = useState<MenuState | null>(null);

  const openMenu = useCallback<ContextMenuController['openMenu']>((event, items, onSelect) => {
    event.preventDefault();
    event.stopPropagation();
    setMenu({ x: event.clientX, y: event.clientY, items, onSelect });
  }, []);

  const closeMenu = useCallback(() => setMenu(null), []);

  return { menu, openMenu, closeMenu };
}

/** Renders the currently open context menu (if any). */
export function ContextMenuHost({
  menu,
  onClose,
}: {
  menu: MenuState | null;
  onClose: () => void;
}): JSX.Element | null {
  if (!menu) return null;
  return <ContextMenu x={menu.x} y={menu.y} items={menu.items} onSelect={menu.onSelect} onClose={onClose} />;
}

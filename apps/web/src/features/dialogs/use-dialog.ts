/**
 * Hooks for the dialog host: read the currently open dialog's props and the
 * active repository without every dialog duplicating the store selectors.
 */
import { useAppStore } from '@/stores/app-store';

/**
 * Props passed to `openDialog(id, props)`. The store keeps them loosely typed
 * (`Record<string, unknown>`), each dialog re-declares the shape it expects.
 */
export function useDialogProps<T extends object = Record<string, unknown>>(): T {
  const props = useAppStore((state) => state.dialog?.props);
  return (props ?? {}) as unknown as T;
}

/** Close the active dialog (resets the store to `null`). */
export function useCloseDialog(): () => void {
  return useAppStore((state) => state.closeDialog);
}

/** Active repository id — every operation dialog works on it. */
export function useDialogRepoId(): string | null {
  return useAppStore((state) => state.activeRepoId);
}

/** Switch the bottom dock to the command console (used after raw execution). */
export function useShowConsole(): () => void {
  return useAppStore((state) => () => state.setBottomTab('console'));
}

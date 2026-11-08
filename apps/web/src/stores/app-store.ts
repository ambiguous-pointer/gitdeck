/**
 * Global UI state (zustand). Data fetching lives in `src/api/hooks.ts` —
 * this store only owns ephemeral UI state and command history.
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type BottomTab = 'changes' | 'console';

export type DialogId =
  | 'settings'
  | 'commit'
  | 'merge'
  | 'rebase'
  | 'cherry-pick'
  | 'revert'
  | 'reset'
  | 'checkout'
  | 'branch-create'
  | 'branch-delete'
  | 'branch-rename'
  | 'tag-create'
  | 'tag-delete'
  | 'push'
  | 'pull'
  | 'fetch'
  | 'stash-create'
  | 'stash-view'
  | 'worktree-add'
  | 'worktree-remove'
  | 'remote-add'
  | 'remote-edit'
  | 'remote-remove'
  | 'config-set'
  | 'add-repo'
  | 'command-run'
  | 'confirm';

export interface DialogState {
  id: DialogId;
  props?: Record<string, unknown>;
}

export interface DiffTarget {
  scope: 'worktree' | 'staged' | 'commit' | 'range';
  path?: string;
  from?: string;
  to?: string;
  title?: string;
}

export interface CommandLogEntry {
  id: string;
  repoId?: string;
  command: string;
  output: string;
  ok: boolean;
  exitCode: number;
  durationMs: number;
  timestamp: number;
}

export interface AppFilters {
  search: string;
  allBranches: boolean;
}

interface AppState {
  activeRepoId: string | null;
  setActiveRepo: (repoId: string | null) => void;

  sidebarCollapsed: boolean;
  toggleSidebar: () => void;

  sidebarSections: Record<string, boolean>;
  toggleSidebarSection: (key: string) => void;

  bottomPanelOpen: boolean;
  setBottomPanelOpen: (open: boolean) => void;
  toggleBottomPanel: () => void;
  bottomTab: BottomTab;
  setBottomTab: (tab: BottomTab) => void;

  detailsWidth: number;
  setDetailsWidth: (width: number) => void;

  selectedCommitHash: string | null;
  selectCommit: (hash: string | null) => void;

  filters: AppFilters;
  setSearch: (search: string) => void;
  setAllBranches: (all: boolean) => void;

  dialog: DialogState | null;
  openDialog: (id: DialogId, props?: Record<string, unknown>) => void;
  closeDialog: () => void;

  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;

  diffTarget: DiffTarget | null;
  openDiff: (target: DiffTarget) => void;
  closeDiff: () => void;

  commandLog: CommandLogEntry[];
  logCommand: (entry: CommandLogEntry) => void;
  clearCommandLog: () => void;
}

const MAX_COMMAND_LOG = 300;

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      activeRepoId: null,
      setActiveRepo: (activeRepoId) => set({ activeRepoId, selectedCommitHash: null }),

      sidebarCollapsed: false,
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

      sidebarSections: { branches: true, remotes: true, tags: true, stashes: false, worktrees: true },
      toggleSidebarSection: (key) =>
        set((state) => ({
          sidebarSections: {
            ...state.sidebarSections,
            [key]: !(state.sidebarSections[key] ?? true),
          },
        })),

      bottomPanelOpen: true,
      setBottomPanelOpen: (bottomPanelOpen) => set({ bottomPanelOpen }),
      toggleBottomPanel: () => set((state) => ({ bottomPanelOpen: !state.bottomPanelOpen })),
      bottomTab: 'changes',
      setBottomTab: (bottomTab) => set({ bottomTab, bottomPanelOpen: true }),

      detailsWidth: 380,
      setDetailsWidth: (detailsWidth) => set({ detailsWidth: Math.min(720, Math.max(300, detailsWidth)) }),

      selectedCommitHash: null,
      selectCommit: (selectedCommitHash) => set({ selectedCommitHash }),

      filters: { search: '', allBranches: true },
      setSearch: (search) => set((state) => ({ filters: { ...state.filters, search } })),
      setAllBranches: (allBranches) => set((state) => ({ filters: { ...state.filters, allBranches } })),

      dialog: null,
      openDialog: (id, props) => set({ dialog: { id, props } }),
      closeDialog: () => set({ dialog: null }),

      commandPaletteOpen: false,
      setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),

      diffTarget: null,
      openDiff: (diffTarget) => set({ diffTarget }),
      closeDiff: () => set({ diffTarget: null }),

      commandLog: [],
      logCommand: (entry) =>
        set((state) => ({
          commandLog: [entry, ...state.commandLog].slice(0, MAX_COMMAND_LOG),
        })),
      clearCommandLog: () => set({ commandLog: [] }),
    }),
    {
      name: 'gitdeck.ui',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        activeRepoId: state.activeRepoId,
        sidebarCollapsed: state.sidebarCollapsed,
        sidebarSections: state.sidebarSections,
        bottomPanelOpen: state.bottomPanelOpen,
        bottomTab: state.bottomTab,
        detailsWidth: state.detailsWidth,
        filters: state.filters,
      }),
    },
  ),
);

/** Convenience selector for the active repository id. */
export function useActiveRepoId(): string | null {
  return useAppStore((state) => state.activeRepoId);
}

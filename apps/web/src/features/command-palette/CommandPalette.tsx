import {
  Archive,
  ArrowDownToLine,
  ArrowUpFromLine,
  Command as CommandIcon,
  CornerDownLeft,
  FileDiff,
  FolderGit2,
  FolderOpen,
  GitBranch,
  GitBranchPlus,
  GitCommitHorizontal,
  GitFork,
  GitMerge,
  GitPullRequest,
  Languages,
  Moon,
  PanelBottom,
  PanelLeft,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  Sun,
  Tag,
  TerminalSquare,
  Undo2,
  Waypoints,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useCloseRepo, useReposQuery } from '@/api/hooks';
import { qk } from '@/api/query-keys';
import { Kbd } from '@/components/ui/kbd';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/cn';
import { useAppStore, type DialogId } from '@/stores/app-store';
import { useTheme } from '@/theme/ThemeProvider';

interface PaletteCommand {
  id: string;
  group: string;
  title: string;
  hint?: string;
  keywords?: string;
  icon: ReactNode;
  run: () => void;
}

const GROUP_ORDER = ['actions', 'view', 'repositories'];

const PALETTE_DIALOGS: { id: DialogId; key: string; fallback: string; icon: ReactNode }[] = [
  { id: 'merge', key: 'actions.merge', fallback: 'Merge…', icon: <GitMerge className="h-4 w-4" /> },
  { id: 'rebase', key: 'actions.rebase', fallback: 'Rebase…', icon: <GitPullRequest className="h-4 w-4" /> },
  {
    id: 'cherry-pick',
    key: 'actions.cherryPick',
    fallback: 'Cherry pick…',
    icon: <GitFork className="h-4 w-4" />,
  },
  { id: 'revert', key: 'menu.revert', fallback: 'Revert commit…', icon: <Undo2 className="h-4 w-4" /> },
  { id: 'reset', key: 'actions.reset', fallback: 'Reset…', icon: <RotateCcw className="h-4 w-4" /> },
  { id: 'push', key: 'actions.push', fallback: 'Push', icon: <ArrowUpFromLine className="h-4 w-4" /> },
  { id: 'pull', key: 'actions.pull', fallback: 'Pull', icon: <ArrowDownToLine className="h-4 w-4" /> },
  { id: 'fetch', key: 'actions.fetch', fallback: 'Fetch', icon: <RefreshCw className="h-4 w-4" /> },
  {
    id: 'branch-create',
    key: 'actions.branch',
    fallback: 'New branch',
    icon: <GitBranchPlus className="h-4 w-4" />,
  },
  {
    id: 'checkout',
    key: 'menu.checkoutBranch',
    fallback: 'Checkout branch',
    icon: <GitBranch className="h-4 w-4" />,
  },
  { id: 'tag-create', key: 'actions.tag', fallback: 'Tag', icon: <Tag className="h-4 w-4" /> },
  { id: 'stash-create', key: 'actions.stash', fallback: 'Stash', icon: <Archive className="h-4 w-4" /> },
  {
    id: 'worktree-add',
    key: 'actions.worktree',
    fallback: 'Worktree',
    icon: <FolderGit2 className="h-4 w-4" />,
  },
  { id: 'remote-add', key: 'actions.remote', fallback: 'Remote', icon: <Waypoints className="h-4 w-4" /> },
  {
    id: 'add-repo',
    key: 'repo.openButton',
    fallback: 'Open repository',
    icon: <FolderOpen className="h-4 w-4" />,
  },
  {
    id: 'command-run',
    key: 'console.runCommand',
    fallback: 'Run a Git command',
    icon: <TerminalSquare className="h-4 w-4" />,
  },
  { id: 'settings', key: 'common.settings', fallback: 'Settings', icon: <Settings className="h-4 w-4" /> },
];

/**
 * Ctrl/Cmd+K command palette: fuzzy-ish filtering over dialog actions, view
 * toggles and repository switching, with full keyboard navigation.
 */
export function CommandPalette(): JSX.Element | null {
  const { t, toggleLocale } = useI18n();
  const { mode, setMode } = useTheme();
  const open = useAppStore((state) => state.commandPaletteOpen);
  const setOpen = useAppStore((state) => state.setCommandPaletteOpen);
  const openDialog = useAppStore((state) => state.openDialog);
  const activeRepoId = useAppStore((state) => state.activeRepoId);
  const setActiveRepo = useAppStore((state) => state.setActiveRepo);
  const bottomPanelOpen = useAppStore((state) => state.bottomPanelOpen);
  const bottomTab = useAppStore((state) => state.bottomTab);
  const setBottomTab = useAppStore((state) => state.setBottomTab);
  const toggleBottomPanel = useAppStore((state) => state.toggleBottomPanel);
  const sidebarCollapsed = useAppStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useAppStore((state) => state.toggleSidebar);
  const allBranches = useAppStore((state) => state.filters.allBranches);
  const setAllBranches = useAppStore((state) => state.setAllBranches);
  const selectedCommitHash = useAppStore((state) => state.selectedCommitHash);
  const queryClient = useQueryClient();
  const repos = useReposQuery();
  const closeRepo = useCloseRepo();

  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Global shortcut: Ctrl/Cmd+K toggles, Escape closes.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && (event.key === 'k' || event.key === 'K')) {
        event.preventDefault();
        setOpen(!useAppStore.getState().commandPaletteOpen);
        return;
      }
      if (event.key === 'Escape' && useAppStore.getState().commandPaletteOpen) {
        event.preventDefault();
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [setOpen]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActiveIndex(0);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  const commands = useMemo<PaletteCommand[]>(() => {
    const list: PaletteCommand[] = [];
    const close = (): void => setOpen(false);
    const openAfterClose = (id: DialogId): void => {
      close();
      openDialog(id);
    };

    for (const dialog of PALETTE_DIALOGS) {
      list.push({
        id: `dialog-${dialog.id}`,
        group: 'actions',
        title: t(dialog.key, dialog.fallback),
        hint: t('common.actions', 'Actions'),
        keywords: `${dialog.id} ${dialog.key}`,
        icon: dialog.icon,
        run: () => openAfterClose(dialog.id),
      });
    }

    list.push(
      {
        id: 'toggle-theme',
        group: 'view',
        title: t('shortcuts.theme', 'Toggle theme'),
        hint: mode === 'light' ? t('settings.themeDark', 'Dark') : t('settings.themeLight', 'Light'),
        icon: mode === 'light' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />,
        run: () => {
          setMode(mode === 'light' ? 'dark' : 'light');
          close();
        },
      },
      {
        id: 'toggle-language',
        group: 'view',
        title: t('common.language', 'Language'),
        hint: '中文 / English',
        icon: <Languages className="h-4 w-4" />,
        run: () => {
          toggleLocale();
          close();
        },
      },
      {
        id: 'toggle-changes',
        group: 'view',
        title: t('actions.changes', 'Changes'),
        hint:
          bottomPanelOpen && bottomTab === 'changes' ? t('common.close', 'Close') : t('common.open', 'Open'),
        icon: <FileDiff className="h-4 w-4" />,
        run: () => {
          setBottomTab('changes');
          close();
        },
      },
      {
        id: 'toggle-console',
        group: 'view',
        title: t('console.title', 'Command console'),
        icon: <TerminalSquare className="h-4 w-4" />,
        run: () => {
          setBottomTab('console');
          close();
        },
      },
      {
        id: 'toggle-bottom-panel',
        group: 'view',
        title: bottomPanelOpen
          ? t('changes.collapseAll', 'Collapse panel')
          : t('common.open', 'Open') + ' ' + t('actions.changes', 'Changes'),
        hint: t('actions.changes', 'Changes'),
        icon: <PanelBottom className="h-4 w-4" />,
        run: () => {
          toggleBottomPanel();
          close();
        },
      },
      {
        id: 'toggle-sidebar',
        group: 'view',
        title: sidebarCollapsed ? t('nav.repositories', 'Repositories') : t('common.close', 'Close'),
        hint: t('nav.repositories', 'Repositories'),
        icon: <PanelLeft className="h-4 w-4" />,
        run: () => {
          toggleSidebar();
          close();
        },
      },
      {
        id: 'toggle-all-branches',
        group: 'view',
        title: t('graph.allBranches', 'All branches'),
        hint: t('graph.toggleAllBranches', 'Show commits from all branches'),
        icon: <GitBranch className="h-4 w-4" />,
        run: () => {
          setAllBranches(!allBranches);
          close();
        },
      },
    );

    if (activeRepoId) {
      list.push({
        id: 'refresh-repo',
        group: 'repositories',
        title: t('graph.refresh', 'Refresh history'),
        hint: t('actions.refresh', 'Refresh'),
        icon: <RefreshCw className="h-4 w-4" />,
        run: () => {
          void queryClient.invalidateQueries({ queryKey: qk.repoAll(activeRepoId) });
          close();
        },
      });
      list.push({
        id: 'close-repo',
        group: 'repositories',
        title: t('repo.close', 'Close repository'),
        icon: <X className="h-4 w-4" />,
        run: () => {
          closeRepo.mutate(activeRepoId, {
            onSuccess: () => setActiveRepo(null),
          });
          close();
        },
      });
      if (selectedCommitHash) {
        list.push(
          {
            id: 'tag-selected',
            group: 'repositories',
            title: t('menu.addTag', 'Add tag…'),
            hint: selectedCommitHash.slice(0, 8),
            icon: <Tag className="h-4 w-4" />,
            run: () => openAfterClose('tag-create'),
          },
          {
            id: 'branch-selected',
            group: 'repositories',
            title: t('menu.createBranch', 'Create branch…'),
            hint: selectedCommitHash.slice(0, 8),
            icon: <GitCommitHorizontal className="h-4 w-4" />,
            run: () => {
              close();
              openDialog('branch-create', { startPoint: selectedCommitHash });
            },
          },
        );
      }
    }

    for (const repo of (repos.data?.repos ?? []).slice(0, 8)) {
      if (repo.id === activeRepoId) continue;
      list.push({
        id: `repo-${repo.id}`,
        group: 'repositories',
        title: repo.name,
        hint: t('repo.switch', 'Switch repository'),
        keywords: repo.path,
        icon: <FolderGit2 className="h-4 w-4" />,
        run: () => {
          setActiveRepo(repo.id);
          close();
        },
      });
    }

    return list.sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group));
  }, [
    activeRepoId,
    allBranches,
    bottomPanelOpen,
    bottomTab,
    closeRepo,
    mode,
    openDialog,
    queryClient,
    repos.data,
    selectedCommitHash,
    setActiveRepo,
    setAllBranches,
    setBottomTab,
    setMode,
    setOpen,
    toggleBottomPanel,
    toggleLocale,
    toggleSidebar,
    t,
  ]);

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return commands;
    const terms = value.split(/\s+/).filter(Boolean);
    return commands.filter((command) => {
      const haystack =
        `${command.title} ${command.hint ?? ''} ${command.keywords ?? ''} ${command.group}`.toLowerCase();
      return terms.every((term) => haystack.includes(term));
    });
  }, [commands, query]);

  useEffect(() => {
    if (activeIndex < filtered.length) return;
    setActiveIndex(filtered.length > 0 ? filtered.length - 1 : 0);
  }, [filtered, activeIndex]);

  useEffect(() => {
    const node = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    node?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  if (!open) return null;

  const runCommand = (command: PaletteCommand) => {
    command.run();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (filtered.length === 0) return;
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex((current) => (current + delta + filtered.length) % filtered.length);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const command = filtered[activeIndex] ?? filtered[0];
      if (command) runCommand(command);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
    }
  };

  let lastGroup: string | null = null;

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center bg-black/45 p-4 pt-[10vh] animate-fade-in"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setOpen(false);
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('actions.openPalette', 'Command palette')}
        className="flex max-h-[70vh] w-full max-w-xl flex-col overflow-hidden rounded-lg border border-border bg-elevated shadow-modal animate-scale-in"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex h-12 shrink-0 items-center gap-2.5 border-b border-border px-3">
          <Search className="h-4 w-4 shrink-0 text-fg-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={onKeyDown}
            placeholder={t('actions.openPalette', 'Command palette')}
            className="min-w-0 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-fg-muted"
            aria-label={t('actions.openPalette', 'Command palette')}
            autoComplete="off"
            spellCheck={false}
          />
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setActiveIndex(0);
                inputRef.current?.focus();
              }}
              className="flex h-5 w-5 items-center justify-center rounded text-fg-muted hover:bg-hover hover:text-fg"
              aria-label={t('common.clear', 'Clear')}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : (
            <Kbd>esc</Kbd>
          )}
        </div>

        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto scrollbar-thin py-1.5">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-1 px-4 py-10 text-center">
              <CommandIcon className="h-6 w-6 text-fg-muted opacity-60" />
              <p className="text-xs text-fg-muted">{t('common.noResults', 'No commands found')}</p>
            </div>
          ) : (
            filtered.map((command, index) => {
              const showGroup = command.group !== lastGroup;
              lastGroup = command.group;
              const active = index === activeIndex;
              const groupLabel =
                command.group === 'actions'
                  ? t('common.actions', 'Actions')
                  : command.group === 'view'
                    ? t('common.view', 'View')
                    : t('nav.repositories', 'Repositories');
              return (
                <div key={command.id}>
                  {showGroup ? (
                    <div className="px-3 pb-1 pt-2 text-2xs font-semibold uppercase tracking-wide text-fg-muted">
                      {groupLabel}
                    </div>
                  ) : null}
                  <button
                    type="button"
                    data-index={index}
                    onMouseMove={() => setActiveIndex(index)}
                    onClick={() => runCommand(command)}
                    className={cn(
                      'flex h-9 w-full items-center gap-2.5 px-3 text-left text-[13px] transition-colors',
                      active ? 'bg-accent-soft text-accent' : 'text-fg hover:bg-hover',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-5 w-5 shrink-0 items-center justify-center',
                        active ? 'text-accent' : 'text-fg-muted',
                      )}
                    >
                      {command.icon}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{command.title}</span>
                    {command.hint ? (
                      <span className="shrink-0 text-2xs text-fg-muted">{command.hint}</span>
                    ) : null}
                    {active ? <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-accent" /> : null}
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="flex h-8 shrink-0 items-center gap-3 border-t border-border bg-surface px-3 text-2xs text-fg-muted">
          <span className="flex items-center gap-1">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd>
            {t('common.select', 'Select')}
          </span>
          <span className="flex items-center gap-1">
            <Kbd>↵</Kbd>
            {t('common.open', 'Open')}
          </span>
          <span className="flex items-center gap-1">
            <Kbd>esc</Kbd>
            {t('common.close', 'Close')}
          </span>
          <span className="ml-auto tabular-nums">{filtered.length}</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}

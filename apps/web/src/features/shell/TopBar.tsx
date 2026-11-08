import {
  GitBranch,
  Languages,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  Sun,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Kbd } from '@/components/ui/kbd';
import { Tooltip } from '@/components/ui/tooltip';
import { useRepoSummary } from '@/api/hooks';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/cn';
import { useAppStore } from '@/stores/app-store';
import { useTheme } from '@/theme/ThemeProvider';
import { BranchSelector } from './BranchSelector';
import { RepoSwitcher } from './RepoSwitcher';
import { SyncControls } from './SyncControls';

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

/** Top application bar: identity, repo/branch context, sync and global actions. */
export function TopBar(): JSX.Element {
  const { t, locale, toggleLocale } = useI18n();
  const { mode, setMode } = useTheme();
  const activeRepoId = useAppStore((state) => state.activeRepoId);
  const sidebarCollapsed = useAppStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useAppStore((state) => state.toggleSidebar);
  const openDialog = useAppStore((state) => state.openDialog);
  const setCommandPaletteOpen = useAppStore((state) => state.setCommandPaletteOpen);
  const summary = useRepoSummary(activeRepoId);

  const iconButton =
    'flex h-7 w-7 items-center justify-center rounded-md text-fg-secondary transition-colors hover:bg-hover hover:text-fg';

  return (
    <header className="flex h-11 shrink-0 items-center gap-1.5 border-b border-border bg-surface px-2">
      <Tooltip label={sidebarCollapsed ? t('nav.repositories', 'Repositories') : t('common.close', 'Close')}>
        <button
          type="button"
          onClick={toggleSidebar}
          className={iconButton}
          aria-label={t('nav.repositories', 'Repositories')}
        >
          {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </Tooltip>

      <div className="flex items-center gap-2 pr-1">
        <div className="flex h-6 w-6 items-center justify-center rounded bg-accent text-accent-fg shadow-panel">
          <GitBranch className="h-3.5 w-3.5" />
        </div>
        <span className="hidden text-sm font-semibold tracking-tight text-fg sm:block">
          {t('app.name', 'GitDeck')}
        </span>
      </div>

      <span className="mx-0.5 h-5 w-px bg-border" />

      <RepoSwitcher />
      {activeRepoId ? <BranchSelector /> : null}
      {activeRepoId && summary.data?.isWorktree ? (
        <Badge variant="info" className="hidden lg:inline-flex">
          {t('repo.worktreeBadge', 'worktree')}
        </Badge>
      ) : null}
      {activeRepoId && summary.data?.detached ? (
        <Badge variant="warning" className="hidden lg:inline-flex">
          {t('repo.detached', 'detached HEAD')}
        </Badge>
      ) : null}

      <div className="ml-auto flex items-center gap-1.5">
        <SyncControls />
        <span className="h-5 w-px bg-border" />

        <button
          type="button"
          onClick={() => setCommandPaletteOpen(true)}
          className={cn(
            'flex h-7 items-center gap-1.5 rounded-md border border-border bg-canvas px-2 text-xs text-fg-muted',
            'transition-colors hover:border-border-strong hover:text-fg',
          )}
          aria-label={t('actions.openPalette', 'Command palette')}
          title={t('shortcuts.commandPalette', 'Command palette')}
        >
          <Search className="h-3.5 w-3.5" />
          <span className="hidden xl:inline">{t('actions.openPalette', 'Command palette')}</span>
          <Kbd className="hidden sm:inline-flex">{IS_MAC ? '⌘' : 'Ctrl'}</Kbd>
          <Kbd className="hidden sm:inline-flex">K</Kbd>
        </button>

        <Tooltip label={t('common.language', 'Language')}>
          <button
            type="button"
            onClick={toggleLocale}
            className={cn(iconButton, 'w-auto gap-1 px-1.5')}
            aria-label={t('common.language', 'Language')}
          >
            <Languages className="h-4 w-4" />
            <span className="text-2xs font-medium">{locale === 'zh' ? '中' : 'EN'}</span>
          </button>
        </Tooltip>

        <Tooltip label={t('common.theme', 'Theme')}>
          <button
            type="button"
            onClick={() => setMode(mode === 'light' ? 'dark' : 'light')}
            className={iconButton}
            aria-label={t('common.theme', 'Theme')}
          >
            {mode === 'light' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </Tooltip>

        <Tooltip label={t('common.settings', 'Settings')}>
          <button
            type="button"
            onClick={() => openDialog('settings')}
            className={iconButton}
            aria-label={t('common.settings', 'Settings')}
          >
            <Settings className="h-4 w-4" />
          </button>
        </Tooltip>
      </div>
    </header>
  );
}

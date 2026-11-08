import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Command,
  GitBranch,
  Languages,
  Moon,
  RefreshCw,
  Settings,
  Sun,
} from 'lucide-react';
import { useRepoSummary } from '@/api/hooks';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { useI18n } from '@/i18n';
import { useAppStore } from '@/stores/app-store';
import { useTheme } from '@/theme/ThemeProvider';

/** Top application bar: repo identity, sync actions and global controls. */
export function TopBar(): JSX.Element {
  const { t, locale, toggleLocale } = useI18n();
  const { mode, setMode } = useTheme();
  const activeRepoId = useAppStore((state) => state.activeRepoId);
  const openDialog = useAppStore((state) => state.openDialog);
  const setCommandPaletteOpen = useAppStore((state) => state.setCommandPaletteOpen);
  const summary = useRepoSummary(activeRepoId);

  const toggleTheme = () => setMode(mode === 'light' ? 'dark' : 'light');

  return (
    <header className="flex h-11 shrink-0 items-center gap-3 border-b border-border bg-surface px-3">
      <div className="flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded bg-accent text-accent-fg">
          <GitBranch className="h-3.5 w-3.5" />
        </div>
        <span className="text-sm font-semibold tracking-tight">{t('app.name', 'GitDeck')}</span>
      </div>

      {summary.data ? (
        <div className="flex min-w-0 items-center gap-2">
          <span className="max-w-[240px] truncate text-[13px] font-medium text-fg">{summary.data.name}</span>
          {summary.data.isWorktree ? <Badge variant="info">{t('repo.worktreeBadge', 'worktree')}</Badge> : null}
          <Button
            variant="ghost"
            size="xs"
            icon={<GitBranch className="h-3 w-3" />}
            onClick={() => openDialog('checkout')}
          >
            {summary.data.branch}
          </Button>
        </div>
      ) : (
        <span className="text-xs text-fg-muted">{t('repo.noRepo', 'No repository selected')}</span>
      )}

      <div className="ml-auto flex items-center gap-1">
        <Tooltip label={t('actions.fetch', 'Fetch')}>
          <Button variant="ghost" size="icon-sm" aria-label="Fetch">
            <ArrowDownToLine className="h-4 w-4" />
          </Button>
        </Tooltip>
        <Tooltip label={t('actions.pull', 'Pull')}>
          <Button variant="ghost" size="icon-sm" aria-label="Pull">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </Tooltip>
        <Tooltip label={t('actions.push', 'Push')}>
          <Button variant="ghost" size="icon-sm" aria-label="Push">
            <ArrowUpFromLine className="h-4 w-4" />
          </Button>
        </Tooltip>
        <div className="mx-1 h-5 w-px bg-border" />
        <Tooltip label={t('actions.openPalette', 'Command palette')}>
          <Button variant="ghost" size="icon-sm" aria-label="Command palette" onClick={() => setCommandPaletteOpen(true)}>
            <Command className="h-4 w-4" />
          </Button>
        </Tooltip>
        <Button variant="ghost" size="icon-sm" aria-label="Toggle language" onClick={toggleLocale}>
          <Languages className="h-4 w-4" />
          <span className="ml-0.5 text-2xs">{locale === 'zh' ? 'EN' : '中'}</span>
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label="Toggle theme" onClick={toggleTheme}>
          {mode === 'light' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label="Settings" onClick={() => openDialog('settings')}>
          <Settings className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}

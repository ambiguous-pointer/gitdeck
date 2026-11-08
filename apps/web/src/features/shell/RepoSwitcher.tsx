import { Check, ChevronDown, FolderGit2, FolderOpen, FolderSearch, GitBranch, Plus, X } from 'lucide-react';
import { useState } from 'react';
import type { RepoRecord } from '@gitdeck/shared';
import { errorMessage } from '@/api/client';
import {
  useCloseRepo,
  useOpenRepo,
  useReposQuery,
  useRepoSummary,
  useScanRepos,
  useServerSettings,
} from '@/api/hooks';
import { useToast } from '@/components/feedback/toast';
import { Spinner } from '@/components/ui/spinner';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/cn';
import { useAppStore } from '@/stores/app-store';
import { Popover, PopoverAction } from './popover';

/**
 * Active repository switcher: recent repositories, open/scan actions and the
 * "close repository" entry point.
 */
export function RepoSwitcher(): JSX.Element {
  const { t } = useI18n();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const activeRepoId = useAppStore((state) => state.activeRepoId);
  const setActiveRepo = useAppStore((state) => state.setActiveRepo);
  const openDialog = useAppStore((state) => state.openDialog);
  const repos = useReposQuery();
  const summary = useRepoSummary(activeRepoId);
  const settings = useServerSettings();
  const closeRepo = useCloseRepo();
  const openRepo = useOpenRepo();
  const scan = useScanRepos();

  const activeRepo: RepoRecord | undefined = repos.data?.repos.find((repo) => repo.id === activeRepoId);
  const activeRepoName = activeRepo?.name ?? (activeRepoId ? summary.data?.name : undefined);
  const scanRoots = settings.data?.scanRoots ?? [];

  const openPath = (path: string) => {
    if (!path.trim()) return;
    openRepo.mutate(
      { path: path.trim() },
      {
        onSuccess: (result) => {
          setActiveRepo(result.repo.id);
          setOpen(false);
          toast.success(t('repo.openButton', 'Open repository'), result.repo.name);
        },
        onError: (error) => toast.error(t('toast.failed', 'Operation failed'), errorMessage(error)),
      },
    );
  };

  const startScan = () => {
    if (scanRoots.length === 0) {
      setOpen(false);
      openDialog('settings');
      toast.info(t('settings.scanRoots', 'Scan folders'), t('repo.scanRoots', 'Folders to scan'));
      return;
    }
    scan.mutate(
      { roots: scanRoots, maxDepth: settings.data?.maxScanDepth },
      {
        onSuccess: (result) => {
          toast.success(
            t('repo.scanResult', 'Found {count} repositories', { count: result.found.length }),
            result.found.length > 0
              ? result.found
                  .map((repo) => repo.name)
                  .slice(0, 6)
                  .join(', ')
              : t('repo.scanEmpty', 'No repositories found in the selected folders.'),
          );
        },
        onError: (error) => toast.error(t('toast.failed', 'Operation failed'), errorMessage(error)),
      },
    );
  };

  const closeActiveRepo = () => {
    if (!activeRepoId) return;
    closeRepo.mutate(activeRepoId, {
      onSuccess: () => {
        setActiveRepo(null);
        setOpen(false);
        toast.success(t('repo.close', 'Close repository'), activeRepo?.name);
      },
      onError: (error) => toast.error(t('toast.failed', 'Operation failed'), errorMessage(error)),
    });
  };

  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      align="start"
      panelClassName="w-[360px]"
      trigger={
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className={cn(
            'flex h-8 min-w-0 max-w-[280px] items-center gap-1.5 rounded-md border border-transparent px-2 text-left transition-colors',
            'hover:border-border hover:bg-hover',
            open && 'border-border bg-hover',
          )}
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          <FolderGit2 className="h-3.5 w-3.5 shrink-0 text-fg-muted" />
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-fg">
            {activeRepoName ?? t('repo.noRepo', 'No repository selected')}
          </span>
          <ChevronDown
            className={cn('h-3.5 w-3.5 shrink-0 text-fg-muted transition-transform', open && 'rotate-180')}
          />
        </button>
      }
    >
      <div className="flex h-8 items-center justify-between border-b border-border px-2.5">
        <span className="text-2xs font-semibold uppercase tracking-wide text-fg-muted">
          {t('nav.repositories', 'Repositories')}
        </span>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            openDialog('add-repo');
          }}
          className="flex h-6 w-6 items-center justify-center rounded text-fg-muted hover:bg-hover hover:text-fg"
          title={t('repo.openButton', 'Open repository')}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="max-h-[260px] overflow-y-auto scrollbar-thin py-1">
        {repos.isLoading ? (
          <div className="flex items-center gap-2 px-3 py-4 text-xs text-fg-muted">
            <Spinner size={13} /> {t('common.loading', 'Loading…')}
          </div>
        ) : repos.isError ? (
          <div className="px-3 py-3 text-xs text-danger">
            {errorMessage(repos.error)}
            <button
              type="button"
              onClick={() => void repos.refetch()}
              className="ml-2 text-accent hover:underline"
            >
              {t('common.retry', 'Retry')}
            </button>
          </div>
        ) : (repos.data?.repos.length ?? 0) === 0 ? (
          <p className="px-3 py-4 text-xs text-fg-muted">{t('repo.noRepo', 'No repository selected')}</p>
        ) : (
          (repos.data?.repos ?? []).map((repo) => {
            const active = repo.id === activeRepoId;
            return (
              <div
                key={repo.id}
                className={cn(
                  'group flex items-center gap-1 px-1.5 py-0.5',
                  active ? 'bg-accent-soft' : 'hover:bg-hover',
                )}
              >
                <button
                  type="button"
                  onClick={() => {
                    setActiveRepo(repo.id);
                    setOpen(false);
                  }}
                  className="flex min-w-0 flex-1 items-center gap-2 rounded px-1.5 py-1 text-left"
                >
                  <FolderGit2
                    className={cn('h-3.5 w-3.5 shrink-0', active ? 'text-accent' : 'text-fg-muted')}
                  />
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn('block truncate text-xs', active ? 'font-medium text-accent' : 'text-fg')}
                    >
                      {repo.name}
                    </span>
                    <span className="block truncate text-2xs text-fg-muted" title={repo.path}>
                      {repo.path}
                    </span>
                  </span>
                  {active ? <Check className="h-3.5 w-3.5 shrink-0 text-accent" /> : null}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    closeRepo.mutate(repo.id, {
                      onSuccess: () => (repo.id === activeRepoId ? setActiveRepo(null) : undefined),
                    })
                  }
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-fg-muted opacity-0 transition-opacity hover:bg-hover hover:text-danger group-hover:opacity-100"
                  title={t('repo.removeFromWorkspace', 'Remove from workspace')}
                  aria-label={t('repo.removeFromWorkspace', 'Remove from workspace')}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>

      {scan.data ? (
        <div className="border-t border-border">
          <div className="flex items-center justify-between px-2.5 py-1.5 text-2xs font-semibold uppercase tracking-wide text-fg-muted">
            <span>
              {t('repo.foundRepos', 'Repositories found')} · {scan.data.found.length}
            </span>
            <span>{scan.data.durationMs} ms</span>
          </div>
          <div className="max-h-[170px] overflow-y-auto scrollbar-thin pb-1">
            {scan.data.found.length === 0 ? (
              <p className="px-3 pb-2 text-xs text-fg-muted">
                {t('repo.scanEmpty', 'No repositories found in the selected folders.')}
              </p>
            ) : (
              scan.data.found.map((found) => (
                <button
                  key={`${found.kind}-${found.path}`}
                  type="button"
                  onClick={() => openPath(found.path)}
                  className="flex w-full items-center gap-2 px-2.5 py-1 text-left hover:bg-hover"
                >
                  {found.kind === 'worktree' ? (
                    <GitBranch className="h-3.5 w-3.5 shrink-0 text-info" />
                  ) : (
                    <FolderGit2 className="h-3.5 w-3.5 shrink-0 text-fg-muted" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs text-fg">{found.name}</span>
                    <span className="block truncate text-2xs text-fg-muted">{found.path}</span>
                  </span>
                  {found.branch ? (
                    <span className="shrink-0 text-2xs text-fg-muted">{found.branch}</span>
                  ) : null}
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}

      <div className="border-t border-border py-1">
        <PopoverAction
          icon={<FolderOpen className="h-3.5 w-3.5" />}
          label={t('repo.openButton', 'Open repository')}
          onClick={() => {
            setOpen(false);
            openDialog('add-repo');
          }}
        />
        <PopoverAction
          icon={scan.isPending ? <Spinner size={13} /> : <FolderSearch className="h-3.5 w-3.5" />}
          label={scan.isPending ? t('repo.scanning', 'Scanning…') : t('repo.scan', 'Scan for repositories')}
          disabled={scan.isPending}
          onClick={startScan}
        />
        <PopoverAction
          icon={<X className="h-3.5 w-3.5" />}
          label={t('repo.close', 'Close repository')}
          danger
          disabled={!activeRepoId || closeRepo.isPending}
          onClick={closeActiveRepo}
        />
      </div>
    </Popover>
  );
}

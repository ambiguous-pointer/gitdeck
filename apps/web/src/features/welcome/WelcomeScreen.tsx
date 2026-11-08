import {
  AlertTriangle,
  ArrowRight,
  FolderGit2,
  FolderOpen,
  FolderSearch,
  GitBranch,
  GitCommitHorizontal,
  GitMerge,
  History,
  RefreshCw,
  Search,
  Settings,
  Waypoints,
  X,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import type { ScannedRepo } from '@gitdeck/shared';
import { errorMessage } from '@/api/client';
import { useCloseRepo, useOpenRepo, useReposQuery, useScanRepos, useServerSettings } from '@/api/hooks';
import { useToast } from '@/components/feedback/toast';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Field, Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/cn';
import { formatRelativeTime } from '@/lib/format';
import { useAppStore } from '@/stores/app-store';

const FEATURES: {
  icon: ReactNode;
  titleKey: string;
  titleFallback: string;
  descKey: string;
  descFallback: string;
}[] = [
  {
    icon: <History className="h-4 w-4" />,
    titleKey: 'repo.featureGraph',
    titleFallback: 'Commit graph',
    descKey: 'repo.featureGraphDesc',
    descFallback: 'A clean, GitKraken-style history with branches, tags and merges.',
  },
  {
    icon: <GitCommitHorizontal className="h-4 w-4" />,
    titleKey: 'repo.featureDiff',
    titleFallback: 'Diffs & staging',
    descKey: 'repo.featureDiffDesc',
    descFallback: 'Stage, unstage and review file diffs before committing.',
  },
  {
    icon: <GitMerge className="h-4 w-4" />,
    titleKey: 'repo.featureOps',
    titleFallback: 'Full Git operations',
    descKey: 'repo.featureOpsDesc',
    descFallback: 'Merge, rebase, cherry-pick, stash, tags, remotes and upstream tracking.',
  },
  {
    icon: <Waypoints className="h-4 w-4" />,
    titleKey: 'repo.featureWorktree',
    titleFallback: 'Worktree manager',
    descKey: 'repo.featureWorktreeDesc',
    descFallback: 'Automatically discover repositories and worktrees in your folders.',
  },
];

/** Landing screen: open a repository, scan folders and reopen recent ones. */
export function WelcomeScreen(): JSX.Element {
  const { t, locale } = useI18n();
  const toast = useToast();
  const [path, setPath] = useState('');
  const repos = useReposQuery();
  const settings = useServerSettings();
  const openRepo = useOpenRepo();
  const closeRepo = useCloseRepo();
  const scan = useScanRepos();
  const setActiveRepo = useAppStore((state) => state.setActiveRepo);
  const openDialog = useAppStore((state) => state.openDialog);

  const openPath = (target: string) => {
    const value = target.trim();
    if (!value) return;
    openRepo.mutate(
      { path: value },
      {
        onSuccess: (result) => {
          setActiveRepo(result.repo.id);
          toast.success(t('repo.openButton', 'Open repository'), result.repo.name);
        },
        onError: (error) => toast.error(t('toast.failed', 'Operation failed'), errorMessage(error)),
      },
    );
  };

  const scanRoots = settings.data?.scanRoots ?? [];
  const fallbackRoot = path.trim() ? [path.trim()] : [];
  const scanTargets = scanRoots.length > 0 ? scanRoots : fallbackRoot;

  const startScan = () => {
    if (scanTargets.length === 0) {
      openDialog('settings');
      toast.info(t('settings.scanRoots', 'Scan folders'), t('repo.scanRoots', 'Folders to scan'));
      return;
    }
    scan.mutate(
      { roots: scanTargets, maxDepth: settings.data?.maxScanDepth },
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

  const removeRecent = (repoId: string) => {
    closeRepo.mutate(repoId, {
      onError: (error) => toast.error(t('toast.failed', 'Operation failed'), errorMessage(error)),
    });
  };

  const recentRepos = repos.data?.repos ?? [];
  const serverUnreachable = settings.isError && repos.isError;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto scrollbar-thin">
      <div className="mx-auto w-full max-w-5xl px-6 py-10">
        {serverUnreachable ? (
          <div className="mb-6 flex items-start gap-2 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2.5 text-xs text-danger">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="flex-1">
              <p className="font-medium">
                {t('error.network', 'Cannot reach the GitDeck server. Is it running?')}
              </p>
              <p className="mt-0.5 text-fg-muted">{errorMessage(settings.error)}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                void settings.refetch();
                void repos.refetch();
              }}
              className="flex items-center gap-1 rounded px-1.5 py-0.5 text-2xs hover:bg-danger/15"
            >
              <RefreshCw className="h-3 w-3" /> {t('common.retry', 'Retry')}
            </button>
          </div>
        ) : null}

        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-fg shadow-panel">
                <GitBranch className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-xl font-semibold tracking-tight text-fg">
                  {t('repo.welcomeTitle', 'Your Git workbench')}
                </h1>
                <p className="truncate text-xs text-fg-muted">
                  {t('app.tagline', 'Web Git GUI · graph, worktrees & full Git operations')}
                </p>
              </div>
            </div>
            <p className="mt-4 max-w-xl text-sm leading-6 text-fg-secondary">
              {t(
                'repo.welcomeSubtitle',
                'Visualize history, review diffs, stage changes and run every day Git operations — in the browser, on Windows and Linux.',
              )}
            </p>

            <div className="mt-6 rounded-lg border border-border bg-surface p-4 shadow-panel">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-fg-muted">
                <FolderOpen className="h-3.5 w-3.5" />
                {t('repo.openTitle', 'Open a repository')}
              </div>
              <p className="mt-1 text-xs text-fg-muted">
                {t(
                  'repo.openSubtitle',
                  'Point GitDeck at a local Git repository or scan a folder to discover repositories and worktrees.',
                )}
              </p>

              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Field className="min-w-0 flex-1">
                  <div className="relative">
                    <FolderGit2 className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-muted" />
                    <Input
                      value={path}
                      onChange={(event) => setPath(event.target.value)}
                      placeholder={t('repo.pathPlaceholder', 'D:\\projects\\my-repo or /home/me/my-repo')}
                      className="h-9 bg-canvas pl-8 font-mono text-xs"
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') openPath(path);
                      }}
                      aria-label={t('repo.pathLabel', 'Repository path')}
                    />
                  </div>
                </Field>
                <Button
                  variant="primary"
                  loading={openRepo.isPending}
                  disabled={!path.trim()}
                  onClick={() => openPath(path)}
                  className="h-9"
                >
                  <FolderOpen className="h-4 w-4" />
                  {t('repo.openButton', 'Open repository')}
                </Button>
                <Button variant="secondary" loading={scan.isPending} onClick={startScan} className="h-9">
                  <FolderSearch className="h-4 w-4" />
                  {t('repo.scan', 'Scan for repositories')}
                </Button>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border-subtle pt-2.5 text-2xs text-fg-muted">
                <span className="font-medium">{t('repo.autoScanWorktrees', 'Auto-scan worktrees')}</span>
                {settings.isLoading ? (
                  <Spinner size={11} />
                ) : scanRoots.length > 0 ? (
                  scanRoots.slice(0, 4).map((root) => (
                    <span
                      key={root}
                      className="max-w-[220px] truncate rounded bg-elevated px-1.5 py-0.5 font-mono"
                      title={root}
                    >
                      {root}
                    </span>
                  ))
                ) : (
                  <span>{t('repo.scanRoots', 'Folders to scan')}: —</span>
                )}
                <button
                  type="button"
                  onClick={() => openDialog('settings')}
                  className="ml-auto flex items-center gap-1 rounded px-1 py-0.5 text-fg-secondary hover:bg-hover hover:text-fg"
                >
                  <Settings className="h-3 w-3" />
                  {t('settings.repositories', 'Repositories')}
                </button>
              </div>
            </div>

            {scan.data ? (
              <div className="mt-4 rounded-lg border border-border bg-surface">
                <div className="flex h-9 items-center gap-2 border-b border-border px-3">
                  <Search className="h-3.5 w-3.5 text-fg-muted" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-fg-muted">
                    {t('repo.foundRepos', 'Repositories found')}
                  </span>
                  <span className="rounded bg-elevated px-1.5 text-2xs text-fg-secondary">
                    {scan.data.found.length}
                  </span>
                  <span className="ml-auto text-2xs text-fg-muted">{scan.data.durationMs} ms</span>
                  <button
                    type="button"
                    onClick={() => scan.reset()}
                    className="flex h-5 w-5 items-center justify-center rounded text-fg-muted hover:bg-hover hover:text-fg"
                    aria-label={t('common.close', 'Close')}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
                {scan.data.found.length === 0 ? (
                  <EmptyState
                    compact
                    title={t('repo.scanEmpty', 'No repositories found in the selected folders.')}
                  />
                ) : (
                  <div className="max-h-[240px] overflow-y-auto scrollbar-thin p-1">
                    {scan.data.found.map((found) => (
                      <ScanResultRow
                        key={`${found.kind}-${found.path}`}
                        found={found}
                        onOpen={() => openPath(found.path)}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </div>

          <div className="w-full shrink-0 lg:w-[340px]">
            <div className="overflow-hidden rounded-lg border border-border bg-surface">
              <div className="flex h-9 items-center justify-between border-b border-border px-3">
                <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-fg-muted">
                  <History className="h-3.5 w-3.5" />
                  {t('repo.recent', 'Recent repositories')}
                </span>
                <span className="text-2xs text-fg-muted">{recentRepos.length}</span>
              </div>
              <div className="max-h-[340px] overflow-y-auto scrollbar-thin p-1">
                {repos.isLoading ? (
                  <div className="space-y-1.5 p-2">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <Skeleton key={index} className="h-9" />
                    ))}
                  </div>
                ) : recentRepos.length === 0 ? (
                  <EmptyState
                    compact
                    title={t('repo.recent', 'Recent repositories')}
                    description={t('repo.scanEmpty', 'No repositories found in the selected folders.')}
                  />
                ) : (
                  recentRepos.map((repo) => (
                    <div
                      key={repo.id}
                      className="group flex items-center gap-1 rounded-md px-1 py-0.5 hover:bg-hover"
                    >
                      <button
                        type="button"
                        onClick={() => setActiveRepo(repo.id)}
                        className="flex min-w-0 flex-1 items-center gap-2 rounded p-1 text-left"
                      >
                        <FolderGit2 className="h-3.5 w-3.5 shrink-0 text-fg-muted" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-medium text-fg">{repo.name}</span>
                          <span className="block truncate text-2xs text-fg-muted" title={repo.path}>
                            {repo.path}
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-1 text-2xs text-fg-muted">
                          {formatRelativeTime(repo.openedAt, locale)}
                          <ArrowRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => removeRecent(repo.id)}
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-fg-muted opacity-0 hover:bg-hover hover:text-danger group-hover:opacity-100"
                        title={t('repo.removeFromWorkspace', 'Remove from workspace')}
                        aria-label={t('repo.removeFromWorkspace', 'Remove from workspace')}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <Button
              variant="secondary"
              className="mt-2 w-full"
              icon={<FolderOpen className="h-4 w-4" />}
              onClick={() => openDialog('add-repo')}
            >
              {t('repo.openButton', 'Open repository')}
            </Button>
          </div>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {FEATURES.map((feature) => (
            <div
              key={feature.titleKey}
              className={cn(
                'rounded-lg border border-border bg-surface p-3.5 transition-colors hover:border-border-strong',
                'shadow-panel',
              )}
            >
              <div className="mb-2 flex h-7 w-7 items-center justify-center rounded-md bg-accent-soft text-accent">
                {feature.icon}
              </div>
              <p className="text-[13px] font-medium text-fg">{t(feature.titleKey, feature.titleFallback)}</p>
              <p className="mt-1 text-xs leading-5 text-fg-muted">
                {t(feature.descKey, feature.descFallback)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ScanResultRow({ found, onOpen }: { found: ScannedRepo; onOpen: () => void }): JSX.Element {
  const { t } = useI18n();
  const isWorktree = found.kind === 'worktree';
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-2 rounded px-2 py-1 text-left hover:bg-hover"
    >
      {isWorktree ? (
        <GitBranch className="h-3.5 w-3.5 shrink-0 text-info" />
      ) : (
        <FolderGit2 className="h-3.5 w-3.5 shrink-0 text-fg-muted" />
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs text-fg">{found.name}</span>
        <span className="block truncate text-2xs text-fg-muted" title={found.path}>
          {found.path}
        </span>
      </span>
      {isWorktree ? (
        <span className="shrink-0 rounded bg-info/15 px-1 text-2xs text-info">
          {t('nav.worktree', 'worktree')}
        </span>
      ) : null}
      {found.branch ? <span className="shrink-0 text-2xs text-fg-muted">{found.branch}</span> : null}
      <ArrowRight className="h-3 w-3 shrink-0 text-fg-muted" />
    </button>
  );
}

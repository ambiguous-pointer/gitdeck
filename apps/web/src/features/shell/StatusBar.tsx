import {
  ArrowDown,
  ArrowUp,
  Cloud,
  CloudOff,
  FolderGit2,
  GitBranch,
  GitMerge,
  GitCommitHorizontal,
  Archive,
  AlertTriangle,
} from 'lucide-react';
import { useRepoStatus, useRepoSummary } from '@/api/hooks';
import { Spinner } from '@/components/ui/spinner';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/cn';
import { useAppStore } from '@/stores/app-store';
import type { RepoOperationKind } from '@gitdeck/shared';

const OPERATION_LABEL: Record<RepoOperationKind, [string, string]> = {
  merging: ['status.merging', 'Merging'],
  rebasing: ['status.rebasing', 'Rebasing'],
  'cherry-picking': ['status.cherryPicking', 'Cherry-picking'],
  reverting: ['status.reverting', 'Reverting'],
  bisecting: ['status.bisecting', 'Bisecting'],
};

/** Bottom status bar: branch, upstream sync, operation state, counts and path. */
export function StatusBar(): JSX.Element {
  const { t } = useI18n();
  const activeRepoId = useAppStore((state) => state.activeRepoId);
  const summary = useRepoSummary(activeRepoId);
  const status = useRepoStatus(activeRepoId);
  // Gate on the active repo: keepPreviousData would otherwise show stale
  // counters from the previously opened repository on the welcome screen.
  const data = activeRepoId ? summary.data : undefined;
  const counts = activeRepoId ? status.data?.counts : undefined;
  const operation = status.data?.operation ?? data?.operation;
  const totalChanges = counts ? counts.staged + counts.unstaged + counts.untracked + counts.conflicted : 0;

  return (
    <footer className="flex h-6 shrink-0 items-center gap-2 overflow-hidden border-t border-border bg-surface px-2 text-2xs text-fg-muted">
      {data ? (
        <>
          <span className="flex min-w-0 items-center gap-1 text-fg-secondary" title={data.path}>
            <GitBranch className="h-3 w-3 shrink-0 text-accent" />
            <span className="max-w-[160px] truncate font-medium">
              {data.branch || t('status.detached', 'Detached HEAD')}
            </span>
          </span>
          {data.detached ? <span className="text-warning">{t('repo.detached', 'detached HEAD')}</span> : null}

          {data.upstream ? (
            <span className="flex min-w-0 items-center gap-1" title={data.upstream}>
              <Cloud className="h-3 w-3 shrink-0" />
              <span className="max-w-[180px] truncate">{data.upstream}</span>
              {data.behind > 0 ? (
                <span className="flex shrink-0 items-center text-warning">
                  <ArrowDown className="h-3 w-3" />
                  {data.behind}
                </span>
              ) : null}
              {data.ahead > 0 ? (
                <span className="flex shrink-0 items-center text-accent">
                  <ArrowUp className="h-3 w-3" />
                  {data.ahead}
                </span>
              ) : null}
              {data.ahead === 0 && data.behind === 0 ? (
                <span className="shrink-0 text-success">{t('status.synced', 'Up to date')}</span>
              ) : null}
            </span>
          ) : (
            <span className="flex shrink-0 items-center gap-1">
              <CloudOff className="h-3 w-3" />
              {t('status.noUpstream', 'No upstream branch')}
            </span>
          )}

          {operation ? (
            <span
              className={cn(
                'flex shrink-0 items-center gap-1 rounded px-1 font-medium',
                operation.state === 'rebasing' ? 'bg-info/15 text-info' : 'bg-warning/15 text-warning',
              )}
              title={t('status.operationInProgress', 'Operation in progress: {operation}', {
                operation: t(...OPERATION_LABEL[operation.state]),
              })}
            >
              <GitMerge className="h-3 w-3" />
              {t(...OPERATION_LABEL[operation.state])}
              {operation.conflictCount ? (
                <span className="flex items-center gap-0.5 text-danger">
                  <AlertTriangle className="h-3 w-3" />
                  {t('status.conflicts', '{count} conflicts', { count: operation.conflictCount })}
                </span>
              ) : null}
            </span>
          ) : null}

          <span className="h-3 w-px shrink-0 bg-border" />

          {totalChanges === 0 ? (
            <span className="flex shrink-0 items-center gap-1">
              <GitCommitHorizontal className="h-3 w-3" />
              {t('status.clean', 'Clean working tree')}
            </span>
          ) : (
            <span className="flex shrink-0 items-center gap-2">
              {counts && counts.staged > 0 ? (
                <span className="text-success" title={t('changes.staged', 'Staged changes')}>
                  ● {counts.staged}
                </span>
              ) : null}
              {counts && counts.unstaged > 0 ? (
                <span className="text-warning" title={t('changes.unstaged', 'Changes')}>
                  ● {counts.unstaged}
                </span>
              ) : null}
              {counts && counts.untracked > 0 ? (
                <span className="text-info" title={t('changes.untracked', 'Untracked files')}>
                  ● {counts.untracked}
                </span>
              ) : null}
              {counts && counts.conflicted > 0 ? (
                <span className="text-danger" title={t('changes.conflicts', 'Merge conflicts')}>
                  ● {counts.conflicted}
                </span>
              ) : null}
              <span>{t('status.uncommitted', '{count} uncommitted changes', { count: totalChanges })}</span>
            </span>
          )}

          {data.stashCount > 0 ? (
            <span className="flex shrink-0 items-center gap-1" title={t('nav.stashes', 'Stashes')}>
              <Archive className="h-3 w-3" />
              {data.stashCount}
            </span>
          ) : null}
          {data.worktreeCount > 1 ? (
            <span className="flex shrink-0 items-center gap-1" title={t('nav.worktrees', 'Worktrees')}>
              <FolderGit2 className="h-3 w-3" />
              {t('status.worktrees', '{count} worktrees', { count: data.worktreeCount })}
            </span>
          ) : null}
        </>
      ) : (
        <span className="flex items-center gap-1.5">
          <GitBranch className="h-3 w-3" />
          {t('app.name', 'GitDeck')} ·{' '}
          {t('app.tagline', 'Web Git GUI · graph, worktrees & full Git operations')}
        </span>
      )}

      <span className="ml-auto flex min-w-0 shrink-0 items-center gap-2">
        {summary.isFetching ? <Spinner size={10} /> : null}
        {data ? (
          <span className="max-w-[38vw] truncate font-mono text-fg-muted" title={data.path}>
            {data.path}
          </span>
        ) : null}
      </span>
    </footer>
  );
}

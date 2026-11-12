/**
 * Working tree panel: conflicts / staged / unstaged / untracked groups with
 * per-file stage, unstage, discard and conflict resolution, plus bulk actions
 * and the commit composer.
 *
 * Clicking a row opens the diff overlay through `openDiff()`.
 */
import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  Minus,
  Plus,
  RefreshCw,
  Trash2,
  Undo2,
  Archive,
  GitMerge,
} from 'lucide-react';
import type { FileChange, FileTreeEntry } from '@gitdeck/shared';
import { errorMessage } from '@/api/client';
import { useDiscard, useRepoStatus, useResolveConflicts, useStage, useUnstage } from '@/api/hooks';
import { useToast } from '@/components/feedback/toast';
import { FileTree } from '@/components/file-tree';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonRows } from '@/components/ui/skeleton';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/cn';
import { fileStatusMeta } from '@/lib/palette';
import { notifyOperation } from '@/features/dialogs/helpers';
import { useAppStore } from '@/stores/app-store';
import { CommitComposer } from './CommitComposer';
import { OperationBanner } from './OperationBanner';

type GroupKey = 'conflicts' | 'staged' | 'unstaged' | 'untracked';

interface FileGroup {
  key: GroupKey;
  title: string;
  files: FileChange[];
  diffScope: 'worktree' | 'staged';
  untracked?: boolean;
}

export function WorkingTreePanel(): JSX.Element {
  const { t } = useI18n();
  const toast = useToast();
  const repoId = useAppStore((state) => state.activeRepoId);
  const openDiff = useAppStore((state) => state.openDiff);
  const openDialog = useAppStore((state) => state.openDialog);

  const status = useRepoStatus(repoId);
  const stage = useStage(repoId);
  const unstage = useUnstage(repoId);
  const discard = useDiscard(repoId);
  const resolve = useResolveConflicts(repoId);

  const [collapsed, setCollapsed] = useState<Partial<Record<GroupKey, boolean>>>({});

  const data = status.data;
  const counts = data?.counts;

  const groups: FileGroup[] = [
    {
      key: 'conflicts',
      title: t('changes.conflicts', 'Merge conflicts'),
      files: data?.conflicted ?? [],
      diffScope: 'worktree',
    },
    {
      key: 'staged',
      title: t('changes.staged', 'Staged changes'),
      files: data?.staged ?? [],
      diffScope: 'staged',
    },
    {
      key: 'unstaged',
      title: t('changes.unstaged', 'Changes'),
      files: data?.unstaged ?? [],
      diffScope: 'worktree',
    },
    {
      key: 'untracked',
      title: t('changes.untracked', 'Untracked files'),
      files: data?.untracked ?? [],
      diffScope: 'worktree',
      untracked: true,
    },
  ];

  const total = groups.reduce((sum, group) => sum + group.files.length, 0);
  const bulkPending = stage.isPending || unstage.isPending || discard.isPending || resolve.isPending;
  const onError = (error: unknown) => toast.error(t('toast.failed', 'Operation failed'), errorMessage(error));

  const stageAll = () => {
    const paths = [...(data?.unstaged ?? []), ...(data?.untracked ?? [])].map((file) => file.path);
    if (paths.length === 0) return;
    stage.mutate(
      { paths, all: false },
      {
        onSuccess: (result) => notifyOperation(toast, t, result, t('toast.staged', 'Changes staged')),
        onError,
      },
    );
  };

  const unstageAll = () => {
    const paths = (data?.staged ?? []).map((file) => file.path);
    if (paths.length === 0) return;
    unstage.mutate(
      { paths, all: false },
      {
        onSuccess: (result) => notifyOperation(toast, t, result, t('toast.unstaged', 'Changes unstaged')),
        onError,
      },
    );
  };

  const confirmDiscard = (paths: string[], untracked: boolean, title?: string) => {
    if (paths.length === 0) return;
    openDialog('confirm', {
      title: title ?? t('changes.discardConfirmTitle', 'Discard changes?'),
      description: t(
        'changes.discardConfirmMessage',
        'This permanently discards local changes for the selected files. This cannot be undone.',
      ),
      confirmLabel: t('changes.discard', 'Discard changes'),
      danger: true,
      onConfirm: async () => {
        const result = await discard.mutateAsync({ paths, untracked });
        notifyOperation(toast, t, result, t('toast.discarded', 'Changes discarded'));
      },
    });
  };

  const confirmDiscardAll = () => {
    const trackedPaths = (data?.unstaged ?? []).map((file) => file.path);
    const untrackedPaths = (data?.untracked ?? []).map((file) => file.path);
    if (trackedPaths.length === 0 && untrackedPaths.length === 0) return;
    openDialog('confirm', {
      title: t('changes.discardConfirmTitle', 'Discard changes?'),
      description: t(
        'changes.discardConfirmMessage',
        'This permanently discards local changes for the selected files. This cannot be undone.',
      ),
      confirmLabel: t('changes.discard', 'Discard changes'),
      danger: true,
      onConfirm: async () => {
        if (trackedPaths.length > 0) {
          const tracked = await discard.mutateAsync({ paths: trackedPaths, untracked: false });
          if (!notifyOperation(toast, t, tracked, t('toast.discarded', 'Changes discarded'))) return;
        }
        if (untrackedPaths.length > 0) {
          const untracked = await discard.mutateAsync({ paths: untrackedPaths, untracked: true });
          notifyOperation(toast, t, untracked, t('toast.discarded', 'Changes discarded'));
        }
      },
    });
  };

  const stageFile = (path: string) =>
    stage.mutate(
      { paths: [path] },
      {
        onSuccess: (result) => notifyOperation(toast, t, result, t('toast.staged', 'Changes staged')),
        onError,
      },
    );

  const unstageFile = (path: string) =>
    unstage.mutate(
      { paths: [path] },
      {
        onSuccess: (result) => notifyOperation(toast, t, result, t('toast.unstaged', 'Changes unstaged')),
        onError,
      },
    );

  const resolveConflict = async (path: string, side: 'ours' | 'theirs' | 'mark-resolved') => {
    try {
      const first = await resolve.mutateAsync({ paths: [path], resolution: side });
      if (!notifyOperation(toast, t, first, t('toast.resolved', 'Conflict resolved'))) return;
      if (side !== 'mark-resolved') {
        const staged = await resolve.mutateAsync({ paths: [path], resolution: 'mark-resolved' });
        if (!staged.result.ok) notifyOperation(toast, t, staged, t('toast.resolved', 'Conflict resolved'));
      }
    } catch (error) {
      onError(error);
    }
  };

  if (!repoId) {
    return (
      <EmptyState
        compact
        icon={<GitMerge className="h-7 w-7" />}
        title={t('repo.noRepo', 'No repository selected')}
        description={t('repo.openTitle', 'Open a repository')}
      />
    );
  }

  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-7 shrink-0 items-center gap-1 border-b border-border-subtle px-2">
          <span className="truncate text-2xs text-fg-muted">
            {t('changes.changesCount', '{count} changes', { count: total })}
            {data?.branch ? <span className="ml-1.5 font-mono text-fg-secondary">{data.branch}</span> : null}
          </span>
          <div className="ml-auto flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={stageAll}
              disabled={bulkPending || (data?.unstaged.length ?? 0) + (data?.untracked.length ?? 0) === 0}
              title={t('changes.stageAll', 'Stage all')}
              aria-label={t('changes.stageAll', 'Stage all')}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={unstageAll}
              disabled={bulkPending || (data?.staged.length ?? 0) === 0}
              title={t('changes.unstageAll', 'Unstage all')}
              aria-label={t('changes.unstageAll', 'Unstage all')}
            >
              <Minus className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-danger hover:bg-danger/10"
              onClick={confirmDiscardAll}
              disabled={bulkPending || (data?.unstaged.length ?? 0) + (data?.untracked.length ?? 0) === 0}
              title={t('changes.discardAll', 'Discard all')}
              aria-label={t('changes.discardAll', 'Discard all')}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
            <span className="mx-0.5 h-4 w-px bg-border" />
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => openDialog('stash-create')}
              disabled={total === 0}
              title={t('changes.stashAll', 'Stash all changes')}
              aria-label={t('changes.stashAll', 'Stash all changes')}
            >
              <Archive className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => void status.refetch()}
              title={t('common.refresh', 'Refresh')}
              aria-label={t('common.refresh', 'Refresh')}
            >
              <RefreshCw className={cn('h-3.5 w-3.5', status.isFetching && 'animate-spin')} />
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
          <OperationBanner operation={data?.operation} />

          {status.isPending && !data ? (
            <SkeletonRows rows={5} />
          ) : status.isError && !data ? (
            <div className="flex flex-col items-center gap-2 p-6 text-center">
              <AlertTriangle className="h-6 w-6 text-danger" />
              <p className="text-xs text-fg-secondary">{errorMessage(status.error)}</p>
              <Button variant="secondary" size="sm" onClick={() => void status.refetch()}>
                {t('common.retry', 'Retry')}
              </Button>
            </div>
          ) : total === 0 ? (
            <EmptyState
              compact
              icon={<CheckCircle2 className="h-7 w-7 text-success" />}
              title={t('changes.noChanges', 'Working tree clean')}
              description={t('changes.noChangesHint', 'You have no uncommitted changes. Nice work!')}
            />
          ) : (
            <div className="py-1">
              {groups.map((group) =>
                group.files.length === 0 ? null : (
                  <FileGroupView
                    key={group.key}
                    group={group}
                    collapsed={Boolean(collapsed[group.key])}
                    onToggle={() =>
                      setCollapsed((current) => ({ ...current, [group.key]: !current[group.key] }))
                    }
                    onOpenDiff={(path) =>
                      openDiff({
                        scope: group.diffScope,
                        path,
                        title: path,
                      })
                    }
                    onStage={stageFile}
                    onUnstage={unstageFile}
                    onDiscard={(path) =>
                      confirmDiscard(
                        [path],
                        group.untracked ?? false,
                        t('changes.discardFileTitle', 'Discard changes to {path}?', { path }),
                      )
                    }
                    onResolve={resolveConflict}
                    pending={bulkPending}
                  />
                ),
              )}
            </div>
          )}
        </div>
      </div>

      <CommitComposer status={data} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Group + rows                                                        */
/* ------------------------------------------------------------------ */

interface FileGroupViewProps {
  group: FileGroup;
  collapsed: boolean;
  onToggle: () => void;
  onOpenDiff: (path: string) => void;
  onStage: (path: string) => void;
  onUnstage: (path: string) => void;
  onDiscard: (path: string) => void;
  onResolve: (path: string, side: 'ours' | 'theirs' | 'mark-resolved') => void;
  pending: boolean;
}

function FileGroupView({
  group,
  collapsed,
  onToggle,
  onOpenDiff,
  onStage,
  onUnstage,
  onDiscard,
  onResolve,
  pending,
}: FileGroupViewProps): JSX.Element {
  const { t } = useI18n();
  const conflict = group.key === 'conflicts';

  return (
    <div>
      <div
        className={cn(
          'sticky top-0 z-10 flex h-6 items-center gap-1 bg-surface/95 px-2 backdrop-blur',
          conflict && 'bg-danger/10',
        )}
      >
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center gap-1 text-2xs font-semibold uppercase tracking-wide text-fg-muted transition-colors hover:text-fg"
        >
          {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          <span className={conflict ? 'text-danger' : undefined}>{group.title}</span>
          <span className="rounded bg-elevated px-1 font-normal tracking-normal text-fg-muted">
            {group.files.length}
          </span>
        </button>
        {conflict ? (
          <span className="ml-auto text-2xs text-danger/90">
            {t('changes.conflictResolveHint', 'Choose ours/theirs, then commit.')}
          </span>
        ) : null}
      </div>

      {collapsed ? null : (
        <FileTree
          entries={group.files}
          defaultExpanded
          onSelect={(entry) => onOpenDiff(entry.path)}
          renderLeaf={(entry) => <FileLeaf entry={entry} />}
          leafActions={(entry) => (
            <FileActions
              group={group.key}
              onStage={() => onStage(entry.path)}
              onUnstage={() => onUnstage(entry.path)}
              onDiscard={() => onDiscard(entry.path)}
              onResolve={(side) => onResolve(entry.path, side)}
              pending={pending}
            />
          )}
          className="pb-1"
        />
      )}
    </div>
  );
}

/** File row inside the collapsible tree: status letter + file name (the folders above it carry the path). */
function FileLeaf({ entry }: { entry: FileTreeEntry }): JSX.Element {
  const meta = fileStatusMeta(entry.status ?? 'modified');
  const path = entry.path.replace(/\\/g, '/');
  const name = path.slice(path.lastIndexOf('/') + 1);

  return (
    <>
      <span className={cn('w-3 shrink-0 text-center font-mono text-2xs font-semibold', meta.className)}>
        {meta.letter}
      </span>
      <span className="min-w-0 flex-1 truncate text-xs text-fg-secondary group-hover/tree-row:text-fg">{name}</span>
      {entry.oldPath && entry.oldPath !== entry.path ? (
        <span className="hidden shrink-0 truncate text-2xs text-fg-muted sm:inline">← {entry.oldPath}</span>
      ) : null}
    </>
  );
}

interface FileActionsProps {
  group: GroupKey;
  onStage: () => void;
  onUnstage: () => void;
  onDiscard: () => void;
  onResolve: (side: 'ours' | 'theirs' | 'mark-resolved') => void;
  pending: boolean;
}

/** Per-row controls rendered at the end of a tree leaf. */
function FileActions({
  group,
  onStage,
  onUnstage,
  onDiscard,
  onResolve,
  pending,
}: FileActionsProps): JSX.Element {
  const { t } = useI18n();

  if (group === 'conflicts') {
    return (
      <span className="flex shrink-0 items-center gap-0.5">
        <Button
          variant="ghost"
          size="xs"
          disabled={pending}
          onClick={() => onResolve('ours')}
          title={t('changes.resolveOurs', 'Keep ours')}
        >
          {t('changes.oursShort', 'Ours')}
        </Button>
        <Button
          variant="ghost"
          size="xs"
          disabled={pending}
          onClick={() => onResolve('theirs')}
          title={t('changes.resolveTheirs', 'Keep theirs')}
        >
          {t('changes.theirsShort', 'Theirs')}
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={pending}
          onClick={() => onResolve('mark-resolved')}
          title={t('changes.markResolved', 'Mark as resolved')}
          aria-label={t('changes.markResolved', 'Mark as resolved')}
        >
          <CircleCheck className="h-3.5 w-3.5 text-success" />
        </Button>
      </span>
    );
  }

  return (
    <span className="hidden shrink-0 items-center gap-0.5 group-hover/tree-row:flex group-focus-within/tree-row:flex">
      {group === 'staged' ? (
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={pending}
          onClick={onUnstage}
          title={t('changes.unstageFile', 'Unstage file')}
          aria-label={t('changes.unstageFile', 'Unstage file')}
        >
          <Minus className="h-3.5 w-3.5" />
        </Button>
      ) : (
        <>
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={pending}
            onClick={onStage}
            title={t('changes.stageFile', 'Stage file')}
            aria-label={t('changes.stageFile', 'Stage file')}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-danger hover:bg-danger/10"
            disabled={pending}
            onClick={onDiscard}
            title={t('changes.discardFile', 'Discard file changes')}
            aria-label={t('changes.discardFile', 'Discard file changes')}
          >
            <Undo2 className="h-3.5 w-3.5" />
          </Button>
        </>
      )}
    </span>
  );
}

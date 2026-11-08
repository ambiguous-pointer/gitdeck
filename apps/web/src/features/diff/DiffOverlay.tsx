/**
 * Full-screen diff overlay. Driven entirely by `useAppStore().diffTarget`;
 * any feature can call `openDiff({ scope, path, from, to, title })`.
 */
import { AlertTriangle, FileDiff as FileDiffIcon } from 'lucide-react';
import { errorMessage } from '@/api/client';
import { useDiff } from '@/api/hooks';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Modal } from '@/components/ui/modal';
import { Spinner } from '@/components/ui/spinner';
import { useI18n } from '@/i18n';
import { shortHash } from '@/lib/format';
import { useAppStore } from '@/stores/app-store';
import { countDiffStats, DiffFilesView, DiffStatsBadges } from './diff-view';

export function DiffOverlay(): JSX.Element | null {
  const { t } = useI18n();
  const repoId = useAppStore((state) => state.activeRepoId);
  const diffTarget = useAppStore((state) => state.diffTarget);
  const closeDiff = useAppStore((state) => state.closeDiff);

  const query = useDiff(
    repoId,
    diffTarget
      ? {
          scope: diffTarget.scope,
          path: diffTarget.path,
          from: diffTarget.from,
          to: diffTarget.to,
        }
      : null,
  );

  if (!diffTarget) return null;

  const files = query.data?.files ?? [];
  const stats = countDiffStats(files);
  const title = diffTarget.title ?? diffTarget.path ?? t('diff.title', 'Diff');

  const scopeLabel =
    diffTarget.scope === 'staged'
      ? t('diff.scopeStaged', 'Staged changes')
      : diffTarget.scope === 'commit'
        ? t('diff.scopeCommit', 'Commit {hash}', { hash: shortHash(diffTarget.from) || 'HEAD' })
        : diffTarget.scope === 'range'
          ? t('diff.scopeRange', '{from} → {to}', {
              from: shortHash(diffTarget.from) || 'HEAD',
              to: shortHash(diffTarget.to) || 'HEAD',
            })
          : t('diff.scopeWorktree', 'Working tree');

  return (
    <Modal
      open
      onClose={closeDiff}
      size="full"
      title={title}
      description={
        <span className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{scopeLabel}</Badge>
          {query.data ? <DiffStatsBadges stats={stats} /> : null}
        </span>
      }
    >
      <div className="flex h-full min-h-0 flex-col">
        {query.isLoading ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-xs text-fg-muted">
            <Spinner />
            {t('diff.loading', 'Loading diff…')}
          </div>
        ) : query.isError ? (
          <EmptyState
            icon={<AlertTriangle className="h-7 w-7 text-danger" />}
            title={t('error.generic', 'Something went wrong')}
            description={errorMessage(query.error)}
            action={
              <Button variant="secondary" size="sm" onClick={() => void query.refetch()}>
                {t('common.retry', 'Retry')}
              </Button>
            }
          />
        ) : files.length === 0 ? (
          <div className="flex flex-1 items-center justify-center">
            <EmptyState
              icon={<FileDiffIcon className="h-8 w-8" />}
              title={t('diff.noChanges', 'No changes to show.')}
              description={
                diffTarget.scope === 'staged'
                  ? t('diff.emptyStaged', 'Nothing is staged in the index yet.')
                  : t('diff.emptyWorktree', 'The working tree has no changes for this selection.')
              }
            />
          </div>
        ) : (
          <DiffFilesView files={files} initialPath={diffTarget.path} className="min-h-0 flex-1" />
        )}
      </div>
    </Modal>
  );
}

import { ArrowDown, ArrowUp, GitBranch, GitCommitHorizontal } from 'lucide-react';
import { useRepoStatus, useRepoSummary } from '@/api/hooks';
import { useI18n } from '@/i18n';
import { useAppStore } from '@/stores/app-store';

/** Bottom status bar: branch sync state, working tree counters, app info. */
export function StatusBar(): JSX.Element {
  const { t } = useI18n();
  const activeRepoId = useAppStore((state) => state.activeRepoId);
  const summary = useRepoSummary(activeRepoId);
  const status = useRepoStatus(activeRepoId);
  const counts = status.data?.counts;

  return (
    <footer className="flex h-6 shrink-0 items-center gap-3 border-t border-border bg-surface px-3 text-2xs text-fg-muted">
      {summary.data ? (
        <>
          <span className="flex items-center gap-1">
            <GitBranch className="h-3 w-3" />
            {summary.data.branch}
          </span>
          {summary.data.upstream ? (
            <span className="flex items-center gap-2">
              <span className="flex items-center gap-0.5">
                <ArrowDown className="h-3 w-3" /> {summary.data.behind}
              </span>
              <span className="flex items-center gap-0.5">
                <ArrowUp className="h-3 w-3" /> {summary.data.ahead}
              </span>
            </span>
          ) : (
            <span>{t('status.noUpstream', 'No upstream branch')}</span>
          )}
          {counts ? (
            <span className="flex items-center gap-1">
              <GitCommitHorizontal className="h-3 w-3" />
              {counts.staged + counts.unstaged + counts.untracked + counts.conflicted === 0
                ? t('status.clean', 'Clean working tree')
                : t('status.uncommitted', '{count} uncommitted changes', {
                    count: counts.staged + counts.unstaged + counts.untracked + counts.conflicted,
                  })}
            </span>
          ) : null}
        </>
      ) : (
        <span>GitDeck</span>
      )}
      <span className="ml-auto">{summary.data?.path}</span>
    </footer>
  );
}

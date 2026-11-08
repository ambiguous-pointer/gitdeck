import { GitCommitHorizontal, Mail } from 'lucide-react';
import { useCommitDetail } from '@/api/hooks';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { Spinner } from '@/components/ui/spinner';
import { useI18n } from '@/i18n';
import { formatDateTime, shortHash, truncate } from '@/lib/format';
import { useAppStore } from '@/stores/app-store';

/**
 * Right side panel with commit metadata and changed files.
 * STUB: replaced by the graph feature branch.
 */
export function CommitDetails(): JSX.Element {
  const { t, locale } = useI18n();
  const activeRepoId = useAppStore((state) => state.activeRepoId);
  const selectedCommitHash = useAppStore((state) => state.selectedCommitHash);
  const openDiff = useAppStore((state) => state.openDiff);
  const detail = useCommitDetail(activeRepoId, selectedCommitHash);

  return (
    <aside className="flex w-[380px] shrink-0 flex-col overflow-hidden border-l border-border bg-surface">
      <div className="flex h-9 shrink-0 items-center border-b border-border px-3 text-xs font-semibold uppercase tracking-wide text-fg-muted">
        {t('commit.title', 'Commit details')}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
        {!selectedCommitHash ? (
          <EmptyState
            icon={<GitCommitHorizontal className="h-8 w-8" />}
            title={t('commit.selectHint', 'Select a commit to inspect its details.')}
            compact
          />
        ) : detail.isLoading ? (
          <div className="flex justify-center p-8">
            <Spinner />
          </div>
        ) : detail.data ? (
          <div className="space-y-4 p-3">
            <div className="flex items-start gap-2.5">
              <Avatar name={detail.data.commit.author.name} email={detail.data.commit.author.email} size={36} />
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium">{detail.data.commit.author.name}</p>
                <p className="truncate text-2xs text-fg-muted">{detail.data.commit.author.email}</p>
                <p className="mt-0.5 text-2xs text-fg-muted">{formatDateTime(detail.data.commit.author.date, locale)}</p>
              </div>
            </div>
            <div>
              <p className="mb-1 text-2xs font-semibold uppercase tracking-wide text-fg-muted">
                {t('commit.message', 'Message')}
              </p>
              <pre className="whitespace-pre-wrap break-words rounded border border-border bg-canvas p-2 font-sans text-xs leading-5 text-fg-secondary">
                {detail.data.commit.subject}
                {detail.data.commit.body ? `\n\n${detail.data.commit.body}` : ''}
              </pre>
            </div>
            <div className="flex items-center justify-between rounded border border-border bg-canvas px-2 py-1.5">
              <span className="truncate font-mono text-2xs text-fg-muted">{shortHash(detail.data.commit.hash, 10)}</span>
              <span className="text-2xs text-fg-muted">
                {t('commit.stats', '{files} files · +{additions} −{deletions}', {
                  files: detail.data.stats.filesChanged,
                  additions: detail.data.stats.insertions,
                  deletions: detail.data.stats.deletions,
                })}
              </span>
            </div>
            <div>
              <p className="mb-1 text-2xs font-semibold uppercase tracking-wide text-fg-muted">
                {t('commit.changedFiles', 'Changed files')}
              </p>
              <div className="space-y-0.5">
                {detail.data.files.map((file) => (
                  <button
                    key={file.path}
                    type="button"
                    onClick={() => openDiff({ scope: 'commit', from: detail.data!.commit.hash, path: file.path })}
                    className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-left hover:bg-hover"
                  >
                    <span className="w-3 shrink-0 font-mono text-2xs text-fg-muted">{file.status.slice(0, 1).toUpperCase()}</span>
                    <span className="min-w-0 flex-1 truncate text-xs text-fg-secondary">{truncate(file.path, 48)}</span>
                    <span className="shrink-0 font-mono text-2xs text-success">+{file.insertions ?? 0}</span>
                    <span className="shrink-0 font-mono text-2xs text-danger">−{file.deletions ?? 0}</span>
                  </button>
                ))}
                {detail.data.files.length === 0 ? (
                  <p className="text-xs text-fg-muted">{t('commit.noFiles', 'No file changes recorded.')}</p>
                ) : null}
              </div>
            </div>
            <div className="flex items-center gap-1 text-2xs text-fg-muted">
              <Mail className="h-3 w-3" /> {detail.data.commit.committer.email}
            </div>
          </div>
        ) : (
          <EmptyState title={t('error.generic', 'Something went wrong')} compact />
        )}
      </div>
    </aside>
  );
}

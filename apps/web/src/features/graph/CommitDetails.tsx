import { Copy, ExternalLink, GitCommitHorizontal, Mail, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { FileChange } from '@gitdeck/shared';
import { useCommitDetail, useRepoSummary } from '@/api/hooks';
import { useToast } from '@/components/feedback/toast';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Tooltip } from '@/components/ui/tooltip';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/cn';
import { formatDateTime, formatRelativeTime, shortHash } from '@/lib/format';
import { fileStatusMeta } from '@/lib/palette';
import { useAppStore } from '@/stores/app-store';
import { copyText } from '@/features/shell/clipboard';
import { RefPill } from './RefPill';
import { commitWebUrl, pickRemoteUrl } from './remote-url';

const DEFAULT_DETAILS_WIDTH = 380;
const MIN_DETAILS_WIDTH = 300;
const MAX_DETAILS_WIDTH = 720;

function FilesSection({ files, commitHash }: { files: FileChange[]; commitHash: string }): JSX.Element {
  const { t } = useI18n();
  const openDiff = useAppStore((state) => state.openDiff);

  if (files.length === 0) {
    return (
      <p className="px-3 py-2 text-xs text-fg-muted">{t('commit.noFiles', 'No file changes recorded.')}</p>
    );
  }

  return (
    <div className="space-y-px px-1.5">
      {files.map((file) => {
        const meta = fileStatusMeta(file.status);
        return (
          <button
            key={`${file.oldPath ?? ''}-${file.path}`}
            type="button"
            onClick={() => openDiff({ scope: 'commit', from: commitHash, path: file.path, title: file.path })}
            title={file.oldPath ? `${file.oldPath} → ${file.path}` : file.path}
            className="group flex h-6 w-full min-w-0 items-center gap-1.5 rounded px-1.5 text-left transition-colors hover:bg-hover"
          >
            <span className={cn('w-3 shrink-0 font-mono text-2xs font-semibold', meta.className)}>
              {meta.letter}
            </span>
            <span className="min-w-0 flex-1 truncate text-xs text-fg-secondary group-hover:text-fg">
              {file.oldPath ? (
                <>
                  <span className="text-fg-muted">{file.oldPath}</span>
                  <span className="px-1 text-fg-muted">→</span>
                  {file.path}
                </>
              ) : (
                file.path
              )}
            </span>
            {file.binary ? (
              <span className="shrink-0 text-2xs text-fg-muted">{t('commit.binaryShort', 'bin')}</span>
            ) : (
              <>
                {file.insertions ? (
                  <span className="shrink-0 font-mono text-2xs text-success">+{file.insertions}</span>
                ) : null}
                {file.deletions ? (
                  <span className="shrink-0 font-mono text-2xs text-danger">−{file.deletions}</span>
                ) : null}
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Right sidebar with the selected commit: author, refs, message, stats and the
 * changed-file list (click a file to open its diff). The width is user
 * resizable and persisted in the app store.
 */
export function CommitDetails(): JSX.Element {
  const { t, locale } = useI18n();
  const toast = useToast();
  const activeRepoId = useAppStore((state) => state.activeRepoId);
  const selectedCommitHash = useAppStore((state) => state.selectedCommitHash);
  const selectCommit = useAppStore((state) => state.selectCommit);
  const detailsWidth = useAppStore((state) => state.detailsWidth);
  const setDetailsWidth = useAppStore((state) => state.setDetailsWidth);
  const detail = useCommitDetail(activeRepoId, selectedCommitHash);
  const summary = useRepoSummary(activeRepoId);

  const [resizing, setResizing] = useState(false);
  const resizeStart = useRef<{ x: number; width: number } | null>(null);

  useEffect(() => {
    if (!resizing) return;
    const onMove = (event: MouseEvent): void => {
      const start = resizeStart.current;
      if (!start) return;
      setDetailsWidth(start.width + (start.x - event.clientX));
    };
    const onUp = (): void => setResizing(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.classList.add('select-none');
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.classList.remove('select-none');
    };
  }, [resizing, setDetailsWidth]);

  const copy = (value: string, title: string) => {
    void copyText(value).then((ok) => {
      if (ok) toast.success(t('common.copied', 'Copied'), title);
      else toast.error(t('toast.failed', 'Operation failed'), value);
    });
  };

  const commit = detail.data?.commit;
  const stats = detail.data?.stats;
  const remoteUrl = pickRemoteUrl(summary.data?.remotes, summary.data?.upstream?.split('/')[0]);
  const webUrl = commit ? commitWebUrl(remoteUrl, commit.hash) : undefined;
  const insertions = stats?.insertions ?? 0;
  const deletions = stats?.deletions ?? 0;
  const totalLines = insertions + deletions;
  const addPercent = totalLines > 0 ? (insertions / totalLines) * 100 : 0;

  return (
    <aside
      className="relative flex shrink-0 flex-col overflow-hidden border-l border-border bg-surface"
      style={{ width: detailsWidth, minWidth: MIN_DETAILS_WIDTH, maxWidth: MAX_DETAILS_WIDTH }}
      aria-label={t('commit.title', 'Commit details')}
    >
      <div
        role="separator"
        aria-orientation="vertical"
        onMouseDown={(event) => {
          event.preventDefault();
          resizeStart.current = { x: event.clientX, width: detailsWidth };
          setResizing(true);
        }}
        onDoubleClick={() => setDetailsWidth(DEFAULT_DETAILS_WIDTH)}
        title={t('commit.title', 'Commit details')}
        className={cn(
          'absolute left-0 top-0 z-10 h-full w-1.5 cursor-col-resize transition-colors',
          resizing ? 'bg-accent/60' : 'hover:bg-accent/40',
        )}
      />

      <div className="flex h-9 shrink-0 items-center gap-1.5 border-b border-border px-2.5">
        <GitCommitHorizontal className="h-3.5 w-3.5 shrink-0 text-fg-muted" />
        <span className="truncate text-xs font-semibold uppercase tracking-wide text-fg-muted">
          {t('commit.title', 'Commit details')}
        </span>
        <span className="ml-auto truncate font-mono text-2xs text-fg-muted">{commit?.shortHash ?? ''}</span>
        {selectedCommitHash ? (
          <button
            type="button"
            onClick={() => selectCommit(null)}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-fg-muted transition-colors hover:bg-hover hover:text-fg"
            aria-label={t('common.close', 'Close')}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
        {!selectedCommitHash ? (
          <EmptyState
            icon={<GitCommitHorizontal className="h-8 w-8" />}
            title={t('commit.selectHint', 'Select a commit to inspect its details.')}
            compact
            className="pt-16"
          />
        ) : detail.isLoading && !commit ? (
          <div className="space-y-2 p-3">
            <div className="flex items-center gap-2.5">
              <Skeleton className="h-9 w-9 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-2.5 w-44" />
              </div>
            </div>
            <Skeleton className="h-20" />
            <Skeleton className="h-4 w-40" />
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-5" />
            ))}
          </div>
        ) : detail.isError && !commit ? (
          <EmptyState
            title={t('toast.failed', 'Operation failed')}
            action={
              <button
                type="button"
                onClick={() => void detail.refetch()}
                className="text-xs text-accent hover:underline"
              >
                {t('common.retry', 'Retry')}
              </button>
            }
            compact
          />
        ) : commit ? (
          <div className="pb-5">
            <div className="flex items-start gap-2.5 px-3 pt-3">
              <Avatar name={commit.author.name} email={commit.author.email} size={36} ring />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-fg">{commit.author.name}</p>
                <p
                  className="flex items-center gap-1 truncate text-2xs text-fg-muted"
                  title={commit.author.email}
                >
                  <Mail className="h-2.5 w-2.5 shrink-0" />
                  <span className="truncate">{commit.author.email}</span>
                </p>
                <p className="text-2xs text-fg-muted" title={formatDateTime(commit.author.date, locale)}>
                  {formatDateTime(commit.author.date, locale)} ·{' '}
                  {formatRelativeTime(commit.author.date, locale)}
                </p>
              </div>
            </div>

            {commit.refs.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1 px-3 pt-2.5">
                {commit.refs.map((ref) => (
                  <RefPill key={ref.refName} gitRef={ref} />
                ))}
              </div>
            ) : null}

            <div className="mx-3 mt-2.5 rounded-md border border-border bg-canvas px-2 py-1.5">
              <div className="flex items-center gap-1">
                <span
                  className="min-w-0 flex-1 truncate font-mono text-2xs text-fg-secondary"
                  title={commit.hash}
                >
                  {commit.hash}
                </span>
                <Tooltip label={t('commit.copyHash', 'Copy commit hash')}>
                  <button
                    type="button"
                    onClick={() => copy(commit.hash, commit.shortHash)}
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-fg-muted hover:bg-hover hover:text-fg"
                    aria-label={t('commit.copyHash', 'Copy commit hash')}
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                </Tooltip>
                {webUrl ? (
                  <Tooltip label={t('commit.viewOnGitHub', 'Open on remote host')}>
                    <a
                      href={webUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-fg-muted hover:bg-hover hover:text-accent"
                      aria-label={t('commit.viewOnGitHub', 'Open on remote host')}
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </Tooltip>
                ) : null}
              </div>
              {commit.parents.length > 0 ? (
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  <span className="text-2xs text-fg-muted">{t('commit.parents', 'Parents')}</span>
                  {commit.parents.map((parent, index) => (
                    <button
                      key={parent}
                      type="button"
                      onClick={() => selectCommit(parent)}
                      title={`${t('commit.parent', 'Parent')} ${index + 1}: ${parent}`}
                      className="rounded border border-border bg-elevated px-1 py-px font-mono text-2xs text-info transition-colors hover:border-info/40 hover:bg-info/10"
                    >
                      {shortHash(parent, 8)}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-2xs text-fg-muted">{t('commit.rootCommit', 'Root commit')}</p>
              )}
            </div>

            <div className="px-3 pt-3">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-2xs font-semibold uppercase tracking-wide text-fg-muted">
                  {t('commit.message', 'Message')}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    copy([commit.subject, commit.body].filter(Boolean).join('\n\n'), commit.shortHash)
                  }
                  className="flex h-5 w-5 items-center justify-center rounded text-fg-muted hover:bg-hover hover:text-fg"
                  aria-label={t('menu.copyCommitMessage', 'Copy commit message')}
                  title={t('menu.copyCommitMessage', 'Copy commit message')}
                >
                  <Copy className="h-3 w-3" />
                </button>
              </div>
              <pre className="max-h-56 overflow-y-auto scrollbar-thin whitespace-pre-wrap break-words rounded-md border border-border bg-canvas p-2.5 font-sans text-xs leading-5 text-fg-secondary">
                <span className="font-medium text-fg">{commit.subject}</span>
                {commit.body.trim() ? `\n\n${commit.body.trim()}` : ''}
              </pre>
            </div>

            <div className="px-3 pt-3">
              <div className="mb-1 flex items-center justify-between text-2xs text-fg-muted">
                <span className="font-semibold uppercase tracking-wide">
                  {t('commit.changedFiles', 'Changed files')}
                </span>
                <span>
                  {t('commit.stats', '{files} files · +{additions} −{deletions}', {
                    files: stats?.filesChanged ?? 0,
                    additions: insertions,
                    deletions,
                  })}
                </span>
              </div>
              <div className="flex h-1 overflow-hidden rounded-full bg-hover">
                {totalLines > 0 ? (
                  <>
                    <span className="h-full bg-success/80" style={{ width: `${addPercent}%` }} />
                    <span className="h-full bg-danger/80" style={{ width: `${100 - addPercent}%` }} />
                  </>
                ) : null}
              </div>
              <div className="mt-1 flex items-center gap-2 text-2xs">
                <span className="font-mono text-success">+{insertions}</span>
                <span className="font-mono text-danger">−{deletions}</span>
              </div>
            </div>
            <div className="pt-2">
              <FilesSection files={detail.data?.files ?? []} commitHash={commit.hash} />
            </div>

            {commit.committer.email !== commit.author.email ||
            commit.committer.name !== commit.author.name ? (
              <div className="mt-3 flex items-start gap-1.5 border-t border-border-subtle px-3 pt-2 text-2xs text-fg-muted">
                <Mail className="mt-0.5 h-2.5 w-2.5 shrink-0" />
                <span className="min-w-0">
                  {t('commit.committer', 'Committer')}: {commit.committer.name} &lt;{commit.committer.email}
                  &gt; · {formatDateTime(commit.committer.date, locale)}
                </span>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="flex justify-center p-8">
            <Spinner />
          </div>
        )}
      </div>
    </aside>
  );
}

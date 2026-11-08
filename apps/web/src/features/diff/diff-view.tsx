/**
 * Unified diff rendering shared by the diff overlay and the stash viewer.
 *
 * Everything here only uses the shared `FileDiff` model, so the same component
 * works for worktree, staged, commit, range and stash diffs.
 */
import { Check, Copy, FileQuestion, FileDiff as FileDiffIcon, Image as ImageIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { DiffLine, DiffStats, FileDiff } from '@gitdeck/shared';
import { useToast } from '@/components/feedback/toast';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/cn';
import { fileStatusMeta } from '@/lib/palette';
import { copyText } from '@/features/dialogs/helpers';

/* ------------------------------------------------------------------ */
/* Stats                                                               */
/* ------------------------------------------------------------------ */

interface LineStats {
  insertions: number;
  deletions: number;
}

export function fileLineStats(file: FileDiff): LineStats {
  let insertions = 0;
  let deletions = 0;
  for (const hunk of file.hunks) {
    for (const line of hunk.lines) {
      if (line.type === 'add') insertions += 1;
      else if (line.type === 'del') deletions += 1;
    }
  }
  return { insertions, deletions };
}

export function countDiffStats(files: FileDiff[]): DiffStats {
  return files.reduce<DiffStats>(
    (stats, file) => {
      const lineStats = fileLineStats(file);
      return {
        filesChanged: stats.filesChanged + 1,
        insertions: stats.insertions + lineStats.insertions,
        deletions: stats.deletions + lineStats.deletions,
      };
    },
    { filesChanged: 0, insertions: 0, deletions: 0 },
  );
}

export function DiffStatsBadges({ stats, className }: { stats: DiffStats; className?: string }): JSX.Element {
  const { t } = useI18n();
  return (
    <span className={cn('inline-flex items-center gap-2 font-mono text-2xs', className)}>
      <span className="text-success">+{stats.insertions}</span>
      <span className="text-danger">−{stats.deletions}</span>
      <span className="text-fg-muted">{t('diff.filesChanged', '{count} files', { count: stats.filesChanged })}</span>
    </span>
  );
}

/** Small `+3 −1` pair used inside the file list. */
function FileLineStats({ stats }: { stats: LineStats }): JSX.Element | null {
  if (stats.insertions === 0 && stats.deletions === 0) return null;
  return (
    <span className="shrink-0 font-mono text-2xs">
      {stats.insertions > 0 ? <span className="text-success">+{stats.insertions}</span> : null}
      {stats.deletions > 0 ? <span className="ml-1 text-danger">−{stats.deletions}</span> : null}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* File header + body                                                  */
/* ------------------------------------------------------------------ */

function FileStatusLetter({ status }: { status: FileDiff['status'] }): JSX.Element {
  const meta = fileStatusMeta(status);
  return (
    <span className={cn('w-3 shrink-0 text-center font-mono text-2xs font-semibold', meta.className)} title={meta.letter}>
      {meta.letter}
    </span>
  );
}

/** Strip a leading +/- marker when the backend kept it in `content`. */
function lineContent(line: DiffLine): string {
  if (line.type === 'add' && line.content.startsWith('+')) return line.content.slice(1);
  if (line.type === 'del' && line.content.startsWith('-')) return line.content.slice(1);
  return line.content;
}

function DiffLineRow({ line }: { line: DiffLine }): JSX.Element {
  const marker = line.type === 'add' ? '+' : line.type === 'del' ? '-' : ' ';
  return (
    <div
      className={cn(
        'flex w-max min-w-full',
        line.type === 'add' && 'bg-diff-add-bg',
        line.type === 'del' && 'bg-diff-del-bg',
      )}
    >
      <span className="w-10 shrink-0 select-none border-r border-border-subtle px-1 text-right text-2xs leading-5 text-fg-muted">
        {line.oldLine ?? ''}
      </span>
      <span className="w-10 shrink-0 select-none border-r border-border-subtle px-1 text-right text-2xs leading-5 text-fg-muted">
        {line.newLine ?? ''}
      </span>
      <span
        className={cn(
          'w-4 shrink-0 select-none text-center text-xs leading-5',
          line.type === 'add' ? 'text-diff-add' : line.type === 'del' ? 'text-diff-del' : 'text-fg-muted',
        )}
      >
        {marker}
      </span>
      <span className="min-w-0 whitespace-pre px-1 pr-3 text-xs leading-5 text-fg-secondary">
        {lineContent(line) || ' '}
      </span>
    </div>
  );
}

function HunkView({ header, lines }: { header: string; lines: DiffLine[] }): JSX.Element {
  return (
    <div>
      <div className="flex w-max min-w-full items-center gap-1.5 border-y border-border-subtle bg-accent-soft px-2 py-0.5 font-mono text-2xs text-accent">
        <span className="truncate">{header}</span>
      </div>
      {lines.map((line, index) => (
        <DiffLineRow key={index} line={line} />
      ))}
    </div>
  );
}

function ImagePreview({ src, label }: { src?: string; label: string }): JSX.Element {
  const { t } = useI18n();
  return (
    <figure className="flex min-w-0 flex-col overflow-hidden rounded border border-border bg-surface">
      <figcaption className="border-b border-border-subtle px-2 py-1 text-2xs font-medium text-fg-muted">{label}</figcaption>
      {src ? (
        <div className="flex items-center justify-center p-2" style={{ minHeight: 120 }}>
          <img src={src} alt={label} className="max-h-[40vh] max-w-full object-contain" />
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-1 p-4 text-center text-2xs text-fg-muted">
          <ImageIcon className="h-6 w-6 opacity-60" />
          {t('diff.imageUnavailable', 'Image preview is not available for this revision.')}
        </div>
      )}
    </figure>
  );
}

export function DiffFileView({ file }: { file: FileDiff }): JSX.Element {
  const { t } = useI18n();
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  const stats = fileLineStats(file);
  const hasImages = Boolean(file.imageBefore || file.imageAfter);
  const pathLabel = file.oldPath && file.oldPath !== file.path ? `${file.oldPath} → ${file.path}` : file.path;

  const copyPath = async () => {
    if (await copyText(file.path)) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_500);
    } else {
      toast.error(t('toast.failed', 'Operation failed'), t('error.generic', 'Something went wrong'));
    }
  };

  return (
    <div className="overflow-hidden rounded-md border border-border bg-canvas">
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-surface px-2.5 py-1.5">
        <FileStatusLetter status={file.status} />
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-fg-secondary" title={pathLabel}>
          {pathLabel}
        </span>
        <FileLineStats stats={stats} />
        <button
          type="button"
          onClick={copyPath}
          title={t('diff.copyPath', 'Copy file path')}
          className="flex shrink-0 items-center gap-1 rounded px-1 py-0.5 text-2xs text-fg-muted transition-colors hover:bg-hover hover:text-fg"
        >
          {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
        </button>
      </div>

      {file.binary && !hasImages ? (
        <EmptyState
          compact
          icon={<FileQuestion className="h-6 w-6" />}
          title={t('diff.binary', 'Binary file — diff not shown.')}
          description={file.path}
        />
      ) : hasImages ? (
        <div className="grid grid-cols-1 gap-2 p-2 sm:grid-cols-2">
          <ImagePreview src={file.imageBefore} label={t('diff.old', 'Original')} />
          <ImagePreview src={file.imageAfter} label={t('diff.new', 'Modified')} />
        </div>
      ) : file.hunks.length === 0 ? (
        <EmptyState
          compact
          icon={<FileDiffIcon className="h-6 w-6" />}
          title={t('diff.noChanges', 'No changes to show.')}
        />
      ) : (
        <div className="overflow-x-auto">
          <div className="font-mono">
            {file.hunks.map((hunk, index) => (
              <HunkView key={`${hunk.header}-${index}`} header={hunk.header} lines={hunk.lines} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Multi-file viewer                                                   */
/* ------------------------------------------------------------------ */

export interface DiffFilesViewProps {
  files: FileDiff[];
  /** Preselect a file (e.g. the path the user clicked). */
  initialPath?: string;
  emptyHint?: string;
  className?: string;
}

export function DiffFilesView({ files, initialPath, emptyHint, className }: DiffFilesViewProps): JSX.Element {
  const { t } = useI18n();
  const [selectedPath, setSelectedPath] = useState<string | null>(initialPath ?? files[0]?.path ?? null);

  useEffect(() => {
    setSelectedPath(initialPath ?? null);
  }, [initialPath]);

  const selectedFile =
    files.find((file) => file.path === selectedPath) ??
    files.find((file) => file.path === initialPath) ??
    files[0];

  if (files.length === 0) {
    return (
      <div className={cn('flex h-full items-center justify-center', className)}>
        <EmptyState
          compact
          icon={<FileDiffIcon className="h-7 w-7" />}
          title={emptyHint ?? t('diff.noChanges', 'No changes to show.')}
        />
      </div>
    );
  }

  const multiFile = files.length > 1;

  return (
    <div className={cn('flex h-full min-h-0', className)}>
      {multiFile ? (
        <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-surface">
          <div className="flex h-7 shrink-0 items-center gap-2 border-b border-border-subtle px-2 text-2xs font-medium uppercase tracking-wide text-fg-muted">
            <span className="truncate">{t('commit.changedFiles', 'Changed files')}</span>
            <Badge variant="accent">{files.length}</Badge>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin py-1">
            {files.map((file) => {
              const active = selectedFile?.path === file.path;
              return (
                <button
                  key={file.path}
                  type="button"
                  onClick={() => setSelectedPath(file.path)}
                  title={file.path}
                  className={cn(
                    'flex w-full items-center gap-1.5 px-2 py-1 text-left transition-colors',
                    active ? 'bg-accent-soft text-fg' : 'text-fg-secondary hover:bg-hover hover:text-fg',
                  )}
                >
                  <FileStatusLetter status={file.status} />
                  <span className="min-w-0 flex-1 truncate font-mono text-2xs">{file.path}</span>
                  <FileLineStats stats={fileLineStats(file)} />
                </button>
              );
            })}
          </div>
        </aside>
      ) : null}
      <div className="min-w-0 flex-1 overflow-auto scrollbar-thin p-2">
        {selectedFile ? <DiffFileView file={selectedFile} /> : null}
      </div>
    </div>
  );
}

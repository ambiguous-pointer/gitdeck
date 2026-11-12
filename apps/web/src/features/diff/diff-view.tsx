/**
 * Diff rendering shared by the diff overlay and the stash viewer.
 *
 * Two layouts share the same `FileDiff` model:
 *   - `unified` — one column with old/new line gutters (the raw hunk list).
 *   - `split`   — classic side-by-side columns (old left / new right) derived
 *                 from the same unified hunks by `splitFileHunks()`.
 *
 * The active layout lives in the UI store (`diffViewMode`), so switching is
 * instant and applies to every diff surface (overlay, stash view, …). The
 * multi-file list is a collapsible tree built by `@gitdeck/shared`.
 */
import {
  Check,
  Columns2,
  Copy,
  FileDiff as FileDiffIcon,
  FileQuestion,
  Image as ImageIcon,
  Rows3,
} from 'lucide-react';
import { Fragment, useEffect, useMemo, useState } from 'react';
import {
  diffLineContent,
  splitFileHunks,
  type DiffLine,
  type DiffStats,
  type DiffViewMode,
  type FileDiff,
  type FileStatus,
  type FileTreeEntry,
  type SplitCell,
  type SplitHunk,
} from '@gitdeck/shared';
import { FileTree } from '@/components/file-tree';
import { useToast } from '@/components/feedback/toast';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { SegmentedControl } from '@/components/ui/segmented';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/cn';
import { fileStatusMeta } from '@/lib/palette';
import { copyText } from '@/features/dialogs/helpers';
import { useAppStore } from '@/stores/app-store';

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
      <span className="text-fg-muted">
        {t('diff.filesChanged', '{count} files', { count: stats.filesChanged })}
      </span>
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
/* File header helpers                                                 */
/* ------------------------------------------------------------------ */

function FileStatusLetter({ status }: { status: FileStatus }): JSX.Element {
  const meta = fileStatusMeta(status);
  return (
    <span
      className={cn('w-3 shrink-0 text-center font-mono text-2xs font-semibold', meta.className)}
      title={meta.letter}
    >
      {meta.letter}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Unified layout (single column)                                      */
/* ------------------------------------------------------------------ */

function UnifiedLineRow({ line }: { line: DiffLine }): JSX.Element {
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
        {diffLineContent(line) || ' '}
      </span>
    </div>
  );
}

function UnifiedHunkView({ header, lines }: { header: string; lines: DiffLine[] }): JSX.Element {
  return (
    <div>
      <div className="flex w-max min-w-full items-center gap-1.5 border-y border-border-subtle bg-accent-soft px-2 py-0.5 font-mono text-2xs text-accent">
        <span className="truncate">{header}</span>
      </div>
      {lines.map((line, index) => (
        <UnifiedLineRow key={index} line={line} />
      ))}
    </div>
  );
}

function UnifiedDiffBody({ file }: { file: FileDiff }): JSX.Element {
  return (
    <div className="overflow-x-auto">
      <div className="font-mono">
        {file.hunks.map((hunk, index) => (
          <UnifiedHunkView key={`${hunk.header}-${index}`} header={hunk.header} lines={hunk.lines} />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Split layout (side by side)                                         */
/* ------------------------------------------------------------------ */

/** Characters wider than one monospace cell (CJK, full-width forms, emoji). */
const WIDE_CHAR =
  /[\u1100-\u115f\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe30-\ufe6f\uff00-\uff60\uffe0-\uffe6]|[\u{1f300}-\u{1faff}]/u;

/** Width of a plain text line in monospace character cells. */
function displayWidth(value: string): number {
  let width = 0;
  for (const char of value) {
    if (char === '\t') width += 4;
    else if (WIDE_CHAR.test(char)) width += 2;
    else width += 1;
  }
  return width;
}

/**
 * Minimum width of one split column, in characters.
 *
 * The grid is at least `2 × minColumn` wide so both sides stay readable on
 * narrow windows; wider panes simply stretch to 50 / 50. Long lines wrap
 * inside their column, so a diff never needs a horizontal scroll.
 */
function splitColumnChars(hunks: SplitHunk[]): number {
  let widest = 0;
  for (const hunk of hunks) {
    for (const row of hunk.rows) {
      for (const cell of [row.left, row.right]) {
        if (cell) widest = Math.max(widest, displayWidth(cell.content));
      }
    }
  }
  return Math.min(Math.max(widest + 2, 40), 60);
}

/**
 * One half of a split row: old (left) or new (right) line gutter, +/- marker
 * and the content cell. Add/del tinting covers the whole half, like a classic
 * side-by-side diff table.
 */
function SplitCellSide({
  cell,
  side,
}: {
  cell?: SplitCell;
  side: 'left' | 'right';
}): JSX.Element {
  const type = cell?.type ?? 'empty';
  const lineNumber = side === 'left' ? cell?.oldLine : cell?.newLine;
  const marker = type === 'del' ? '-' : type === 'add' ? '+' : ' ';

  return (
    <div
      className={cn(
        'flex min-w-0',
        type === 'add' && 'bg-diff-add-bg',
        type === 'del' && 'bg-diff-del-bg',
        side === 'right' && 'border-l border-border',
      )}
    >
      <span className="w-9 shrink-0 select-none border-r border-border-subtle px-1 text-right text-2xs leading-5 text-fg-muted">
        {lineNumber ?? ''}
      </span>
      <span
        className={cn(
          'w-4 shrink-0 select-none text-center text-xs leading-5',
          type === 'add' ? 'text-diff-add' : type === 'del' ? 'text-diff-del' : 'text-fg-muted',
        )}
      >
        {marker}
      </span>
      <span className="min-w-0 flex-1 whitespace-pre-wrap break-words px-1 pr-3 text-xs leading-5 text-fg-secondary">
        {cell && cell.type !== 'empty' && cell.content ? cell.content : ' '}
      </span>
    </div>
  );
}

function SplitHunkHeader({ header }: { header: string }): JSX.Element {
  return (
    <div className="col-span-2 flex items-center gap-1.5 border-y border-border-subtle bg-accent-soft px-2 py-0.5 font-mono text-2xs text-accent">
      <span className="truncate">{header}</span>
    </div>
  );
}

function SplitDiffBody({ file }: { file: FileDiff }): JSX.Element {
  const hunks = useMemo(() => splitFileHunks(file), [file]);
  const columnChars = useMemo(() => splitColumnChars(hunks), [hunks]);

  return (
    <div className="overflow-x-auto">
      <div
        className="grid grid-cols-2 font-mono"
        style={{ minWidth: `${columnChars * 2}ch` }}
      >
        {hunks.map((hunk, index) => (
          <Fragment key={`${hunk.header}-${index}`}>
            <SplitHunkHeader header={hunk.header} />
            {hunk.rows.map((row, rowIndex) => (
              <div key={rowIndex} className="contents">
                <SplitCellSide cell={row.left} side="left" />
                <SplitCellSide cell={row.right} side="right" />
              </div>
            ))}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Image diff                                                          */
/* ------------------------------------------------------------------ */

function ImagePreview({ src, label }: { src?: string; label: string }): JSX.Element {
  const { t } = useI18n();
  return (
    <figure className="flex min-w-0 flex-col overflow-hidden rounded border border-border bg-surface">
      <figcaption className="border-b border-border-subtle px-2 py-1 text-2xs font-medium text-fg-muted">
        {label}
      </figcaption>
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

/* ------------------------------------------------------------------ */
/* File body                                                           */
/* ------------------------------------------------------------------ */

export function DiffFileView({ file }: { file: FileDiff }): JSX.Element {
  const { t } = useI18n();
  const toast = useToast();
  const viewMode = useAppStore((state) => state.diffViewMode);
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
      ) : viewMode === 'split' ? (
        <SplitDiffBody file={file} />
      ) : (
        <UnifiedDiffBody file={file} />
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
  const viewMode = useAppStore((state) => state.diffViewMode);
  const setViewMode = useAppStore((state) => state.setDiffViewMode);
  const [selectedPath, setSelectedPath] = useState<string | null>(initialPath ?? files[0]?.path ?? null);

  useEffect(() => {
    setSelectedPath(initialPath ?? null);
  }, [initialPath]);

  // The tree wants line stats per file; `FileDiff` stores them per hunk.
  const treeEntries = useMemo<FileTreeEntry[]>(
    () =>
      files.map((file) => {
        const stats = fileLineStats(file);
        return {
          path: file.path,
          status: file.status,
          oldPath: file.oldPath,
          binary: file.binary,
          insertions: stats.insertions,
          deletions: stats.deletions,
        };
      }),
    [files],
  );

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
    <div className={cn('flex h-full min-h-0 flex-col', className)}>
      <div className="flex h-8 shrink-0 items-center gap-2 border-b border-border-subtle bg-surface px-2">
        <span className="min-w-0 flex-1 truncate font-mono text-2xs text-fg-muted" title={selectedFile?.path}>
          {selectedFile?.path ?? t('diff.title', 'Diff')}
        </span>
        <span className="hidden text-2xs font-medium uppercase tracking-wide text-fg-muted lg:inline">
          {t('diff.viewMode', 'Diff layout')}
        </span>
        <SegmentedControl<DiffViewMode>
          size="sm"
          value={viewMode}
          onChange={setViewMode}
          options={[
            {
              value: 'split',
              label: t('diff.modeSplit', 'Side by side'),
              icon: <Columns2 className="h-3 w-3" />,
            },
            {
              value: 'unified',
              label: t('diff.modeUnified', 'Unified'),
              icon: <Rows3 className="h-3 w-3" />,
            },
          ]}
        />
      </div>

      <div className="flex min-h-0 flex-1">
        {multiFile ? (
          <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-surface">
            <div className="flex h-7 shrink-0 items-center gap-2 border-b border-border-subtle px-2 text-2xs font-medium uppercase tracking-wide text-fg-muted">
              <span className="truncate">{t('commit.changedFiles', 'Changed files')}</span>
              <Badge variant="accent">{files.length}</Badge>
            </div>
            <FileTree
              entries={treeEntries}
              selectedPath={selectedFile?.path}
              onSelect={(entry) => setSelectedPath(entry.path)}
              defaultExpanded
              className="min-h-0 flex-1"
              renderLeaf={(entry) => (
                <>
                  <FileStatusLetter status={entry.status ?? 'modified'} />
                  <span className="min-w-0 flex-1 truncate font-mono text-2xs text-fg-secondary">
                    {entry.path.slice(entry.path.lastIndexOf('/') + 1)}
                  </span>
                  <FileLineStats
                    stats={{ insertions: entry.insertions ?? 0, deletions: entry.deletions ?? 0 }}
                  />
                </>
              )}
            />
          </aside>
        ) : null}
        <div className="min-w-0 flex-1 overflow-auto scrollbar-thin p-2">
          {selectedFile ? <DiffFileView file={selectedFile} /> : null}
        </div>
      </div>
    </div>
  );
}

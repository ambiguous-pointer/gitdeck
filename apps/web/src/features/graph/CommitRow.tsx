import { memo } from 'react';
import type { Commit, GitRef, GraphRow, Locale } from '@gitdeck/shared';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/cn';
import { formatCommitDate, formatDateTime, shortHash } from '@/lib/format';
import { GraphCell } from './GraphCell';
import { RefPill } from './RefPill';

export const COMMIT_ROW_HEIGHT = 30;
export const MAX_VISIBLE_REFS = 3;

export interface CommitRowProps {
  commit: Commit;
  row: GraphRow | undefined;
  graphWidth: number;
  selected: boolean;
  locale: Locale;
  onSelect: (hash: string) => void;
  onContextMenu: (event: React.MouseEvent, commit: Commit) => void;
  onRefContextMenu: (event: React.MouseEvent, ref: GitRef) => void;
}

/** Single commit row: graph lane slice, ref pills, description, date, author, hash. */
export const CommitRow = memo(function CommitRow({
  commit,
  row,
  graphWidth,
  selected,
  locale,
  onSelect,
  onContextMenu,
  onRefContextMenu,
}: CommitRowProps): JSX.Element {
  const { t } = useI18n();
  const hash = commit.shortHash || shortHash(commit.hash);
  const extraRefs = commit.refs.length - MAX_VISIBLE_REFS;

  return (
    <div
      role="row"
      aria-selected={selected}
      data-hash={commit.hash}
      onClick={() => onSelect(commit.hash)}
      onContextMenu={(event) => onContextMenu(event, commit)}
      className={cn(
        'grid cursor-default select-none items-center border-b border-border-subtle text-[13px] transition-colors',
        selected ? 'bg-accent-soft shadow-[inset_2px_0_0_0_var(--accent)]' : 'hover:bg-hover',
      )}
      style={{
        height: COMMIT_ROW_HEIGHT,
        gridTemplateColumns: `${graphWidth}px minmax(0,1fr) 108px 132px 84px`,
      }}
    >
      <div className="flex h-full min-w-0 items-center overflow-hidden">
        <GraphCell row={row} width={graphWidth} height={COMMIT_ROW_HEIGHT} />
      </div>

      <div className="flex min-w-0 items-center gap-1.5 pr-3">
        {commit.refs.slice(0, MAX_VISIBLE_REFS).map((ref) => (
          <RefPill
            key={ref.refName}
            gitRef={ref}
            onContextMenu={onRefContextMenu}
            className={selected ? 'ring-1 ring-accent/25' : undefined}
          />
        ))}
        {extraRefs > 0 ? (
          <span
            className="shrink-0 rounded-[3px] border border-border-strong bg-elevated px-1 text-2xs font-medium leading-[15px] text-fg-muted"
            title={commit.refs.map((ref) => ref.label).join(', ')}
          >
            +{extraRefs}
          </span>
        ) : null}
        <span
          className={cn('min-w-0 flex-1 truncate', selected ? 'text-fg' : 'text-fg')}
          title={commit.subject}
        >
          {commit.subject || t('commit.noMessage', '(no message)')}
        </span>
      </div>

      <div
        className="truncate pr-2 text-xs tabular-nums text-fg-muted"
        title={formatDateTime(commit.author.date, locale)}
      >
        {formatCommitDate(commit.author.date, locale)}
      </div>

      <div
        className="truncate pr-2 text-xs text-fg-secondary"
        title={`${commit.author.name} <${commit.author.email}>`}
      >
        {commit.author.name}
      </div>

      <div className="truncate pr-2 text-right font-mono text-xs text-fg-muted" title={commit.hash}>
        {hash}
      </div>
    </div>
  );
});

import { AlertTriangle, GitCommitHorizontal, GitBranch, SearchX } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { layoutGraph, type Commit, type GitRef, type GraphRow } from '@gitdeck/shared';
import { errorMessage } from '@/api/client';
import { useRepoLog } from '@/api/hooks';
import { qk } from '@/api/query-keys';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { useI18n } from '@/i18n';
import { useAppStore } from '@/stores/app-store';
import { ContextMenuHost, useContextMenuController } from '@/features/shell/context-menu';
import { COMMIT_ROW_HEIGHT, CommitRow } from './CommitRow';
import { graphWidthFor } from './GraphCell';
import { GraphToolbar } from './GraphToolbar';
import { buildCommitMenuItems, buildRefMenuItems, useGraphMenuActions } from './graph-menus';
import { useWindowedRows } from './use-windowed-rows';

const PAGE_SIZE = 500;
const MAX_LIMIT = 2000;

function matchesSearch(commit: Commit, query: string): boolean {
  return (
    commit.subject.toLowerCase().includes(query) ||
    commit.author.name.toLowerCase().includes(query) ||
    commit.author.email.toLowerCase().includes(query) ||
    commit.hash.startsWith(query) ||
    commit.refs.some((ref) => ref.label.toLowerCase().includes(query))
  );
}

/** Commit graph: continuous SVG lanes, ref pills, windowed rows, context menus. */
export function GraphView(): JSX.Element {
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();
  const activeRepoId = useAppStore((state) => state.activeRepoId);
  const filters = useAppStore((state) => state.filters);
  const setSearch = useAppStore((state) => state.setSearch);
  const setAllBranches = useAppStore((state) => state.setAllBranches);
  const selectedCommitHash = useAppStore((state) => state.selectedCommitHash);
  const selectCommit = useAppStore((state) => state.selectCommit);

  const [limit, setLimit] = useState(PAGE_SIZE);
  const log = useRepoLog(activeRepoId, { limit, all: filters.allBranches });
  const { menu, openMenu, closeMenu } = useContextMenuController();
  const { commitAction, refAction, refMenuOptions } = useGraphMenuActions(activeRepoId);
  const autoSelectedRepo = useRef<string | null>(null);

  const commits = useMemo(() => log.data?.commits ?? [], [log.data]);

  const filtered = useMemo(() => {
    const query = filters.search.trim().toLowerCase();
    if (!query) return commits;
    return commits.filter((commit) => matchesSearch(commit, query));
  }, [commits, filters.search]);

  const layout = useMemo(
    () => layoutGraph(filtered.map((commit) => ({ hash: commit.hash, parents: commit.parents }))),
    [filtered],
  );

  const rowByHash = useMemo(() => {
    const map = new Map<string, GraphRow>();
    for (const row of layout.rows) map.set(row.hash, row);
    return map;
  }, [layout]);

  const graphWidth = graphWidthFor(layout.laneCount);
  const windowed = useWindowedRows(filtered.length, COMMIT_ROW_HEIGHT);
  const scrollToIndex = windowed.scrollToIndex;

  const selectedIndex = useMemo(
    () => (selectedCommitHash ? filtered.findIndex((commit) => commit.hash === selectedCommitHash) : -1),
    [filtered, selectedCommitHash],
  );

  // Reset paging whenever the repository changes.
  useEffect(() => {
    setLimit(PAGE_SIZE);
  }, [activeRepoId]);

  // Select HEAD (first row) once per repository so the details panel is never empty.
  useEffect(() => {
    if (!activeRepoId || autoSelectedRepo.current === activeRepoId) return;
    if (filtered.length === 0) return;
    autoSelectedRepo.current = activeRepoId;
    if (!selectedCommitHash) selectCommit(filtered[0]!.hash);
  }, [activeRepoId, filtered, selectedCommitHash, selectCommit]);

  // Keep keyboard/selection changes visible in the virtualized list.
  useEffect(() => {
    if (selectedIndex >= 0) scrollToIndex(selectedIndex);
  }, [selectedIndex, scrollToIndex]);

  const handleSelect = useCallback((hash: string) => selectCommit(hash), [selectCommit]);

  const handleRefresh = useCallback(() => {
    if (activeRepoId) void queryClient.invalidateQueries({ queryKey: qk.repoAll(activeRepoId) });
  }, [activeRepoId, queryClient]);

  const handleRowContextMenu = useCallback(
    (event: React.MouseEvent, commit: Commit) => {
      openMenu(event, buildCommitMenuItems(t), (id) => commitAction(id, commit));
    },
    [openMenu, t, commitAction],
  );

  const handleRefContextMenu = useCallback(
    (event: React.MouseEvent, ref: GitRef) => {
      if (ref.type === 'head' || ref.type === 'stash') return;
      openMenu(event, buildRefMenuItems(t, ref, refMenuOptions(ref)), (id) => refAction(id, ref));
    },
    [openMenu, t, refMenuOptions, refAction],
  );

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (filtered.length === 0) return;
    const index = selectedIndex >= 0 ? selectedIndex : 0;
    let next: number;
    switch (event.key) {
      case 'ArrowDown':
        next = Math.min(filtered.length - 1, index + 1);
        break;
      case 'ArrowUp':
        next = Math.max(0, index - 1);
        break;
      case 'PageDown':
        next = Math.min(filtered.length - 1, index + 10);
        break;
      case 'PageUp':
        next = Math.max(0, index - 10);
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = filtered.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    const commit = filtered[next];
    if (!commit) return;
    selectCommit(commit.hash);
    scrollToIndex(next);
  };

  const initialLoading = log.isLoading && commits.length === 0;
  const initialError = log.isError && commits.length === 0;
  const noResults = filtered.length === 0;

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-surface">
      <GraphToolbar
        search={filters.search}
        onSearchChange={setSearch}
        allBranches={filters.allBranches}
        onToggleAllBranches={() => setAllBranches(!filters.allBranches)}
        onRefresh={handleRefresh}
        refreshing={log.isFetching}
        count={filtered.length}
        total={commits.length}
      />

      <div
        className="grid shrink-0 items-center border-b border-border bg-canvas text-2xs font-semibold uppercase tracking-wide text-fg-muted"
        style={{ gridTemplateColumns: `${graphWidth}px minmax(0,1fr) 108px 132px 84px`, height: 26 }}
      >
        <span className="truncate pl-2">{t('graph.graph', 'Graph')}</span>
        <span className="truncate pr-3">{t('graph.description', 'Description')}</span>
        <span className="truncate pr-2">{t('graph.date', 'Date')}</span>
        <span className="truncate pr-2">{t('graph.author', 'Author')}</span>
        <span className="truncate pr-2 text-right">{t('graph.commit', 'Commit')}</span>
      </div>

      <div
        ref={windowed.containerRef}
        tabIndex={0}
        onScroll={windowed.onScroll}
        onKeyDown={handleKeyDown}
        className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin outline-none"
        role="grid"
        aria-label={t('graph.description', 'Commits')}
        aria-rowcount={filtered.length}
      >
        {initialLoading ? (
          <div className="space-y-1 p-2">
            {Array.from({ length: 14 }).map((_, index) => (
              <Skeleton key={index} className="h-[26px]" />
            ))}
          </div>
        ) : initialError ? (
          <EmptyState
            icon={<AlertTriangle className="h-8 w-8 text-danger" />}
            title={t('toast.failed', 'Operation failed')}
            description={errorMessage(log.error)}
            action={
              <Button variant="secondary" size="sm" onClick={() => void log.refetch()}>
                {t('common.retry', 'Retry')}
              </Button>
            }
          />
        ) : noResults ? (
          <EmptyState
            icon={
              filters.search ? <SearchX className="h-8 w-8" /> : <GitCommitHorizontal className="h-8 w-8" />
            }
            title={
              filters.search
                ? t('graph.noMatches', 'No commits match the current filter.')
                : t('graph.empty', 'No commits yet')
            }
            description={
              filters.search
                ? t('graph.filterPlaceholder', 'Filter by message, author or hash…')
                : t('graph.emptyHint', 'Create your first commit from the changes panel.')
            }
            action={
              filters.search ? (
                <Button variant="secondary" size="sm" onClick={() => setSearch('')}>
                  {t('common.clear', 'Clear')}
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="relative" style={{ height: windowed.totalHeight }}>
            {filtered.slice(windowed.start, windowed.end).map((commit, offset) => (
              <div
                key={commit.hash}
                className="absolute left-0 right-0"
                style={{ top: (windowed.start + offset) * COMMIT_ROW_HEIGHT }}
              >
                <CommitRow
                  commit={commit}
                  row={rowByHash.get(commit.hash)}
                  graphWidth={graphWidth}
                  selected={commit.hash === selectedCommitHash}
                  locale={locale}
                  onSelect={handleSelect}
                  onContextMenu={handleRowContextMenu}
                  onRefContextMenu={handleRefContextMenu}
                />
              </div>
            ))}
          </div>
        )}

        {log.isFetching && !initialLoading ? (
          <div className="pointer-events-none sticky bottom-2 left-0 flex justify-center">
            <span className="flex items-center gap-1.5 rounded-full border border-border bg-overlay px-2.5 py-1 text-2xs text-fg-muted shadow-panel">
              <Spinner size={11} /> {t('graph.loading', 'Loading history…')}
            </span>
          </div>
        ) : null}
      </div>

      {log.data?.hasMore ? (
        <div className="flex h-8 shrink-0 items-center justify-center border-t border-border bg-surface">
          <Button
            variant="ghost"
            size="xs"
            loading={log.isFetching}
            disabled={limit >= MAX_LIMIT}
            onClick={() => setLimit((current) => Math.min(MAX_LIMIT, current + PAGE_SIZE))}
          >
            <GitBranch className="h-3 w-3" />
            {t('graph.loadMore', 'Load more commits')}
          </Button>
        </div>
      ) : null}

      <ContextMenuHost menu={menu} onClose={closeMenu} />
    </section>
  );
}

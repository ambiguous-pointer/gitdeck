import { GitBranch, Search } from 'lucide-react';
import { useMemo } from 'react';
import { layoutGraph } from '@gitdeck/shared';
import { useRepoLog, useRepoSummary } from '@/api/hooks';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useI18n } from '@/i18n';
import { formatCommitDate, shortHash } from '@/lib/format';
import { graphColorHex } from '@/lib/palette';
import { useAppStore } from '@/stores/app-store';
import { Tooltip } from '@/components/ui/tooltip';

/**
 * Commit graph + commit list. STUB: the graph feature branch replaces this
 * file with the full virtualized implementation (see docs/CONTRACTS.md).
 */
export function GraphView(): JSX.Element {
  const { t, locale } = useI18n();
  const activeRepoId = useAppStore((state) => state.activeRepoId);
  const filters = useAppStore((state) => state.filters);
  const setSearch = useAppStore((state) => state.setSearch);
  const setAllBranches = useAppStore((state) => state.setAllBranches);
  const selectedCommitHash = useAppStore((state) => state.selectedCommitHash);
  const selectCommit = useAppStore((state) => state.selectCommit);
  const summary = useRepoSummary(activeRepoId);
  const log = useRepoLog(activeRepoId, { limit: 150, all: filters.allBranches });
  const commits = log.data?.commits ?? [];

  const layout = useMemo(
    () => layoutGraph(commits.map((commit) => ({ hash: commit.hash, parents: commit.parents }))),
    [commits],
  );

  const filtered = useMemo(() => {
    const query = filters.search.trim().toLowerCase();
    if (!query) return commits;
    return commits.filter(
      (commit) =>
        commit.subject.toLowerCase().includes(query) ||
        commit.author.name.toLowerCase().includes(query) ||
        commit.hash.startsWith(query),
    );
  }, [commits, filters.search]);

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-surface">
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border px-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-muted" />
          <Input
            value={filters.search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('graph.searchPlaceholder', 'Search commits…')}
            className="h-7 w-64 pl-7 text-xs"
          />
        </div>
        <Button
          variant={filters.allBranches ? 'subtle' : 'ghost'}
          size="xs"
          icon={<GitBranch className="h-3 w-3" />}
          onClick={() => setAllBranches(!filters.allBranches)}
        >
          {filters.allBranches ? t('graph.allBranches', 'All branches') : t('graph.currentBranch', 'Current branch')}
        </Button>
        <span className="text-2xs text-fg-muted">
          {t('graph.showing', 'Showing {count} commits', { count: filtered.length })}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <Tooltip label={summary.data?.upstream ?? t('status.noUpstream', 'No upstream branch')}>
            <span className="text-2xs text-fg-muted">{summary.data?.branch}</span>
          </Tooltip>
        </div>
      </div>

      <div className="grid shrink-0 grid-cols-[88px_minmax(0,1fr)_120px_120px_84px] items-center gap-2 border-b border-border bg-canvas px-2 py-1 text-2xs font-semibold uppercase tracking-wide text-fg-muted">
        <span>{t('graph.graph', 'Graph')}</span>
        <span>{t('graph.description', 'Description')}</span>
        <span>{t('graph.date', 'Date')}</span>
        <span>{t('graph.author', 'Author')}</span>
        <span className="text-right">{t('graph.commit', 'Commit')}</span>
      </div>

      <div className="min-h-0 flex-1 overflow-auto scrollbar-thin">
        {log.isLoading ? (
          <div className="space-y-1 p-2">
            {Array.from({ length: 12 }).map((_, index) => (
              <Skeleton key={index} className="h-6" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<GitBranch className="h-8 w-8" />}
            title={log.data?.commits.length ? t('graph.noMatches', 'No commits match the current filter.') : t('graph.empty', 'No commits yet')}
            description={log.data?.commits.length ? undefined : t('graph.emptyHint', 'Create your first commit from the changes panel.')}
          />
        ) : (
          <div>
            {filtered.map((commit) => {
              const row = layout.rows.find((item) => item.hash === commit.hash);
              const selected = commit.hash === selectedCommitHash;
              return (
                <button
                  key={commit.hash}
                  type="button"
                  onClick={() => selectCommit(commit.hash)}
                  className={`grid w-full grid-cols-[88px_minmax(0,1fr)_120px_120px_84px] items-center gap-2 border-b border-border-subtle px-2 py-1 text-left transition-colors ${
                    selected ? 'bg-accent-soft' : 'hover:bg-hover'
                  }`}
                >
                  <span className="flex items-center gap-1">
                    {row ? (
                      <svg width={72} height={22} viewBox="0 0 72 22" aria-hidden>
                        {row.incoming.map((lane) =>
                          lane.fromTop ? (
                            <line
                              key={`in-${lane.lane}`}
                              x1={8 + lane.lane * 12}
                              y1={0}
                              x2={8 + lane.lane * 12}
                              y2={11}
                              stroke={graphColorHex(lane.color)}
                              strokeWidth={2}
                            />
                          ) : null,
                        )}
                        {row.converge.map((lane) => (
                          <line
                            key={`cv-${lane.fromLane}`}
                            x1={8 + lane.fromLane * 12}
                            y1={11}
                            x2={8 + row.lane * 12}
                            y2={11}
                            stroke={graphColorHex(lane.color)}
                            strokeWidth={2}
                          />
                        ))}
                        {row.outgoing.map((lane) => (
                          <line
                            key={`out-${lane.lane}`}
                            x1={8 + lane.lane * 12}
                            y1={11}
                            x2={8 + lane.lane * 12}
                            y2={22}
                            stroke={graphColorHex(lane.color)}
                            strokeWidth={2}
                          />
                        ))}
                        {row.mergeOut.map((lane) => (
                          <path
                            key={`merge-${lane.toLane}`}
                            d={`M ${8 + lane.fromLane * 12} 11 C ${8 + lane.fromLane * 12} 18, ${8 + lane.toLane * 12} 15, ${8 + lane.toLane * 12} 22`}
                            fill="none"
                            stroke={graphColorHex(lane.color)}
                            strokeWidth={2}
                          />
                        ))}
                        <circle
                          cx={8 + row.lane * 12}
                          cy={11}
                          r={4}
                          fill={graphColorHex(row.color)}
                          stroke="var(--bg-surface)"
                          strokeWidth={1.5}
                        />
                      </svg>
                    ) : null}
                  </span>
                  <span className="min-w-0">
                    <span className="flex min-w-0 items-center gap-1.5">
                      {commit.refs.slice(0, 2).map((ref) => (
                        <span
                          key={ref.refName}
                          className="max-w-[140px] truncate rounded px-1 text-2xs"
                          style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--fg-secondary)' }}
                        >
                          {ref.label}
                        </span>
                      ))}
                      <span className="truncate text-[13px] text-fg">{commit.subject}</span>
                    </span>
                  </span>
                  <span className="truncate text-xs text-fg-muted">{formatCommitDate(commit.author.date, locale)}</span>
                  <span className="truncate text-xs text-fg-secondary">{commit.author.name}</span>
                  <span className="text-right font-mono text-xs text-fg-muted">{shortHash(commit.hash)}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

import { GitBranch, RotateCw, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/cn';

export interface GraphToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  allBranches: boolean;
  onToggleAllBranches: () => void;
  onRefresh: () => void;
  refreshing: boolean;
  count: number;
  total: number;
}

/** Commit-graph toolbar: workspace search, all-branches toggle, refresh, count. */
export function GraphToolbar({
  search,
  onSearchChange,
  allBranches,
  onToggleAllBranches,
  onRefresh,
  refreshing,
  count,
  total,
}: GraphToolbarProps): JSX.Element {
  const { t } = useI18n();
  const searching = search.trim().length > 0;

  return (
    <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border bg-surface px-2">
      <div className="relative min-w-0 max-w-[340px] flex-1">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-muted" />
        <Input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={t('graph.searchPlaceholder', 'Search commits…')}
          className="h-7 bg-canvas pl-7 pr-7 text-xs"
          aria-label={t('graph.filterPlaceholder', 'Filter by message, author or hash…')}
        />
        {searching ? (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            className="absolute right-1.5 top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded text-fg-muted hover:bg-hover hover:text-fg"
            aria-label={t('common.clear', 'Clear')}
          >
            <X className="h-3 w-3" />
          </button>
        ) : null}
      </div>

      <Button
        variant={allBranches ? 'subtle' : 'ghost'}
        size="xs"
        icon={<GitBranch className="h-3 w-3" />}
        onClick={onToggleAllBranches}
        title={
          allBranches
            ? t('graph.toggleCurrentBranch', 'Show commits from the current branch')
            : t('graph.toggleAllBranches', 'Show commits from all branches')
        }
      >
        {allBranches ? t('graph.allBranches', 'All branches') : t('graph.currentBranch', 'Current branch')}
      </Button>

      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onRefresh}
        title={t('graph.refresh', 'Refresh history')}
        aria-label={t('graph.refresh', 'Refresh history')}
      >
        <RotateCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
      </Button>

      <span className="ml-auto shrink-0 pr-1 text-2xs tabular-nums text-fg-muted">
        {searching
          ? t('graph.showing', 'Showing {count} commits', { count })
          : t('graph.rows', '{count} rows', { count: total })}
      </span>
    </div>
  );
}

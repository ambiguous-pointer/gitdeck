import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  GitBranch,
  GitMerge,
  GitPullRequest,
  Plus,
  Search,
  ArrowUpFromLine,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useBranches, useRepoSummary } from '@/api/hooks';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/cn';
import { useAppStore } from '@/stores/app-store';
import { Popover, PopoverAction } from './popover';

/**
 * Current-branch selector. Lists local branches (checkout by clicking) and
 * exposes the branch-level actions in its footer.
 */
export function BranchSelector(): JSX.Element | null {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const activeRepoId = useAppStore((state) => state.activeRepoId);
  const openDialog = useAppStore((state) => state.openDialog);
  const branches = useBranches(activeRepoId);
  const summary = useRepoSummary(activeRepoId);

  const localBranches = useMemo(() => {
    const query = filter.trim().toLowerCase();
    return (branches.data?.branches ?? [])
      .filter((branch) => !branch.isRemote)
      .filter((branch) => !query || branch.name.toLowerCase().includes(query))
      .sort((a, b) => Number(b.current) - Number(a.current) || a.name.localeCompare(b.name));
  }, [branches.data, filter]);

  if (!activeRepoId) return null;

  const current = summary.data?.branch ?? localBranches.find((branch) => branch.current)?.name ?? '';
  const ahead = summary.data?.ahead ?? 0;
  const behind = summary.data?.behind ?? 0;
  const detached = summary.data?.detached ?? false;

  const pickBranch = (name: string, isCurrent: boolean) => {
    setOpen(false);
    if (isCurrent) return;
    openDialog('checkout', { target: name });
  };

  const triggerLabel = detached
    ? t('repo.detached', 'detached HEAD')
    : current || t('status.detached', 'Detached HEAD');

  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      align="start"
      panelClassName="w-[340px]"
      trigger={
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className={cn(
            'flex h-8 min-w-0 max-w-[260px] items-center gap-1.5 rounded-md border border-border bg-canvas px-2 transition-colors',
            'hover:border-border-strong hover:bg-hover',
            open && 'border-accent/60',
          )}
          aria-haspopup="dialog"
          aria-expanded={open}
          title={summary.data?.upstream ? `${current} → ${summary.data.upstream}` : triggerLabel}
        >
          <GitBranch className="h-3.5 w-3.5 shrink-0 text-accent" />
          <span className="min-w-0 truncate text-[13px] font-medium text-fg">{triggerLabel}</span>
          {!detached && (ahead > 0 || behind > 0) ? (
            <span className="flex shrink-0 items-center gap-1 text-2xs text-fg-muted">
              {behind > 0 ? (
                <span className="flex items-center">
                  <ArrowDown className="h-3 w-3" />
                  {behind}
                </span>
              ) : null}
              {ahead > 0 ? (
                <span className="flex items-center">
                  <ArrowUp className="h-3 w-3" />
                  {ahead}
                </span>
              ) : null}
            </span>
          ) : null}
          <ChevronDown
            className={cn('h-3.5 w-3.5 shrink-0 text-fg-muted transition-transform', open && 'rotate-180')}
          />
        </button>
      }
    >
      <div className="border-b border-border p-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-muted" />
          <Input
            autoFocus
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder={t('nav.searchPlaceholder', 'Filter branches…')}
            className="h-7 bg-canvas pl-7 text-xs"
          />
        </div>
      </div>

      <div className="max-h-[260px] overflow-y-auto scrollbar-thin py-1">
        {branches.isLoading ? (
          <div className="flex items-center gap-2 px-3 py-3 text-xs text-fg-muted">
            <Spinner size={13} /> {t('common.loading', 'Loading…')}
          </div>
        ) : localBranches.length === 0 ? (
          <p className="px-3 py-3 text-xs text-fg-muted">{t('nav.noItems', 'Nothing here yet')}</p>
        ) : (
          localBranches.map((branch) => (
            <button
              key={branch.name}
              type="button"
              onClick={() => pickBranch(branch.name, branch.current)}
              className={cn(
                'flex h-7 w-full items-center gap-2 px-2.5 text-left text-xs transition-colors',
                branch.current ? 'bg-accent-soft text-accent' : 'text-fg hover:bg-hover',
              )}
              title={branch.upstream ? `${branch.name} → ${branch.upstream}` : branch.name}
            >
              <GitBranch className="h-3 w-3 shrink-0 opacity-70" />
              <span className="min-w-0 flex-1 truncate">{branch.name}</span>
              {branch.ahead > 0 ? (
                <span className="flex shrink-0 items-center text-2xs text-success">
                  <ArrowUp className="h-3 w-3" />
                  {branch.ahead}
                </span>
              ) : null}
              {branch.behind > 0 ? (
                <span className="flex shrink-0 items-center text-2xs text-warning">
                  <ArrowDown className="h-3 w-3" />
                  {branch.behind}
                </span>
              ) : null}
              {branch.current ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
            </button>
          ))
        )}
      </div>

      <div className="border-t border-border py-1">
        <PopoverAction
          icon={<Plus className="h-3.5 w-3.5" />}
          label={t('menu.createBranch', 'Create branch…')}
          hint={current}
          onClick={() => {
            setOpen(false);
            openDialog('branch-create', current ? { startPoint: current } : undefined);
          }}
        />
        <PopoverAction
          icon={<GitBranch className="h-3.5 w-3.5" />}
          label={t('menu.checkoutBranch', 'Checkout branch…')}
          onClick={() => {
            setOpen(false);
            openDialog('checkout');
          }}
        />
        <PopoverAction
          icon={<GitMerge className="h-3.5 w-3.5" />}
          label={t('menu.mergeIntoCurrent', 'Merge into current branch…')}
          onClick={() => {
            setOpen(false);
            openDialog('merge');
          }}
        />
        <PopoverAction
          icon={<GitPullRequest className="h-3.5 w-3.5" />}
          label={t('menu.rebaseCurrentOnBranch', 'Rebase current branch on this branch…')}
          onClick={() => {
            setOpen(false);
            openDialog('rebase');
          }}
        />
        <PopoverAction
          icon={<ArrowUpFromLine className="h-3.5 w-3.5" />}
          label={t('menu.pushBranch', 'Push branch…')}
          onClick={() => {
            setOpen(false);
            openDialog('push', { branch: current });
          }}
        />
      </div>

      {detached ? (
        <div className="border-t border-border px-2.5 py-2">
          <Badge variant="warning">{t('repo.detached', 'detached HEAD')}</Badge>
        </div>
      ) : null}
    </Popover>
  );
}

import {
  ArrowDown,
  ArrowUp,
  ArrowUpFromLine,
  Cloud,
  Copy,
  FolderGit2,
  GitBranch,
  GitBranchPlus,
  GitMerge,
  GitPullRequest,
  Link2,
  Link2Off,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Branch } from '@gitdeck/shared';
import type { MenuItemSpec } from '@/components/ui/menu';
import { useBranches, useRemotes } from '@/api/hooks';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/cn';
import { useAppStore } from '@/stores/app-store';
import { ContextMenuHost, useContextMenuController } from '../context-menu';
import { SectionAction, SidebarSection, SidebarSubHeading, sidebarRowClass } from './sidebar-section';
import { useRepoCommands } from './use-repo-commands';

/** Branches section: local + remote tracking branches with full context menu. */
export function BranchesSection(): JSX.Element {
  const { t } = useI18n();
  const activeRepoId = useAppStore((state) => state.activeRepoId);
  const openDialog = useAppStore((state) => state.openDialog);
  const toggleSection = useAppStore((state) => state.toggleSidebarSection);
  const localOpen = useAppStore((state) => state.sidebarSections['branches-local'] ?? true);
  const remoteOpen = useAppStore((state) => state.sidebarSections['branches-remote'] ?? true);
  const branchesQuery = useBranches(activeRepoId);
  const remotesQuery = useRemotes(activeRepoId);
  const commands = useRepoCommands(activeRepoId);
  const { menu, openMenu, closeMenu } = useContextMenuController();
  const [filter, setFilter] = useState('');

  const branches = branchesQuery.data?.branches ?? [];
  const query = filter.trim().toLowerCase();

  const filterAndSort = (isRemote: boolean): Branch[] =>
    branches
      .filter((branch) => branch.isRemote === isRemote)
      .filter((branch) => !query || branch.name.toLowerCase().includes(query))
      .sort((a, b) => Number(b.current) - Number(a.current) || a.name.localeCompare(b.name));

  const localBranches = useMemo(() => filterAndSort(false), [branches, query]);
  const remoteBranches = useMemo(() => filterAndSort(true), [branches, query]);

  const localCount = branches.filter((branch) => !branch.isRemote).length;
  const remoteCount = branches.length - localCount;

  const upstreamCandidate = (branch: Branch): { remote: string; remoteBranch: string } | undefined => {
    for (const remote of remotesQuery.data?.remotes ?? []) {
      const tracker = branches.find(
        (candidate) =>
          candidate.isRemote &&
          candidate.remote === remote.name &&
          candidate.name === `${remote.name}/${branch.name}`,
      );
      if (tracker) return { remote: remote.name, remoteBranch: branch.name };
    }
    return undefined;
  };

  const menuItems = (branch: Branch): MenuItemSpec[] => {
    const candidate = !branch.isRemote ? upstreamCandidate(branch) : undefined;
    const items: MenuItemSpec[] = [
      {
        id: 'checkout',
        label: t('menu.checkoutBranch', 'Checkout branch'),
        icon: <GitBranch className="h-3.5 w-3.5" />,
        disabled: branch.current,
        shortcut: branch.current ? t('repo.active', 'Active') : undefined,
      },
      {
        id: 'create-branch',
        label: t('menu.createBranch', 'Create branch…'),
        icon: <GitBranchPlus className="h-3.5 w-3.5" />,
        separatorBefore: true,
      },
      {
        id: 'create-worktree',
        label: t('menu.createWorktree', 'Create worktree…'),
        icon: <FolderGit2 className="h-3.5 w-3.5" />,
      },
    ];
    if (!branch.isRemote) {
      items.push(
        {
          id: 'rename',
          label: t('menu.renameBranch', 'Rename branch…'),
          icon: <Pencil className="h-3.5 w-3.5" />,
          separatorBefore: true,
        },
        {
          id: 'delete',
          label: t('menu.deleteBranch', 'Delete branch…'),
          icon: <Trash2 className="h-3.5 w-3.5" />,
          danger: true,
        },
      );
    } else {
      items.push({
        id: 'delete-remote',
        label: t('menu.deleteBranch', 'Delete branch…'),
        icon: <Trash2 className="h-3.5 w-3.5" />,
        danger: true,
        separatorBefore: true,
      });
    }
    items.push(
      {
        id: 'merge',
        label: t('menu.mergeIntoCurrent', 'Merge into current branch…'),
        icon: <GitMerge className="h-3.5 w-3.5" />,
        separatorBefore: true,
      },
      {
        id: 'rebase',
        label: t('menu.rebaseCurrentOnBranch', 'Rebase current branch on this branch…'),
        icon: <GitPullRequest className="h-3.5 w-3.5" />,
      },
    );
    if (!branch.isRemote) {
      items.push({
        id: 'push',
        label: t('menu.pushBranch', 'Push branch…'),
        icon: <ArrowUpFromLine className="h-3.5 w-3.5" />,
        separatorBefore: true,
      });
      if (candidate) {
        items.push({
          id: 'set-upstream',
          label: t('menu.setUpstream', 'Set upstream branch…'),
          icon: <Link2 className="h-3.5 w-3.5" />,
        });
      }
      if (branch.upstream) {
        items.push({
          id: 'unset-upstream',
          label: t('menu.unsetUpstream', 'Unset upstream'),
          icon: <Link2Off className="h-3.5 w-3.5" />,
        });
      }
    }
    items.push(
      {
        id: 'copy-name',
        label: t('menu.copyBranchName', 'Copy branch name'),
        icon: <Copy className="h-3.5 w-3.5" />,
        separatorBefore: true,
      },
      {
        id: 'copy-upstream',
        label: t('menu.copyUpstream', 'Copy upstream name'),
        icon: <Copy className="h-3.5 w-3.5" />,
        disabled: !branch.upstream,
      },
    );
    return items;
  };

  const handleMenu = (id: string, branch: Branch) => {
    switch (id) {
      case 'checkout':
        openDialog('checkout', { target: branch.name, detach: branch.isRemote });
        break;
      case 'create-branch':
        openDialog('branch-create', { startPoint: branch.name, checkout: !branch.isRemote });
        break;
      case 'create-worktree':
        openDialog('worktree-add', branch.isRemote ? { startPoint: branch.name } : { branch: branch.name });
        break;
      case 'rename':
        openDialog('branch-rename', { name: branch.name });
        break;
      case 'delete':
        openDialog('branch-delete', { name: branch.name });
        break;
      case 'delete-remote':
        openDialog('branch-delete', { name: branch.name, remote: true });
        break;
      case 'merge':
        openDialog('merge', { branch: branch.name });
        break;
      case 'rebase':
        openDialog('rebase', { onto: branch.name });
        break;
      case 'push':
        openDialog('push', { branch: branch.name });
        break;
      case 'set-upstream': {
        const candidate = upstreamCandidate(branch);
        if (candidate) commands.setBranchUpstream(branch.name, candidate.remote, candidate.remoteBranch);
        break;
      }
      case 'unset-upstream':
        commands.unsetBranchUpstream(branch.name);
        break;
      case 'copy-name':
        commands.copy(branch.name);
        break;
      case 'copy-upstream':
        if (branch.upstream) commands.copy(branch.upstream);
        break;
      default:
        break;
    }
  };

  const renderRow = (branch: Branch) => (
    <button
      key={`${branch.isRemote ? 'r' : 'l'}-${branch.name}`}
      type="button"
      onClick={() => {
        if (!branch.current) openDialog('checkout', { target: branch.name, detach: branch.isRemote });
      }}
      onContextMenu={(event) => openMenu(event, menuItems(branch), (id) => handleMenu(id, branch))}
      title={branch.upstream ? `${branch.name} → ${branch.upstream}` : branch.name}
      className={cn(
        sidebarRowClass,
        branch.current ? 'bg-accent-soft text-accent' : 'text-fg-secondary hover:bg-hover hover:text-fg',
      )}
    >
      {branch.current ? (
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
      ) : branch.isRemote ? (
        <Cloud className="h-3 w-3 shrink-0 opacity-60" />
      ) : (
        <GitBranch className="h-3 w-3 shrink-0 opacity-60" />
      )}
      <span className={cn('min-w-0 flex-1 truncate', branch.current && 'font-medium')}>{branch.name}</span>
      {branch.ahead > 0 ? (
        <span className="flex shrink-0 items-center text-2xs text-success">
          <ArrowUp className="h-2.5 w-2.5" />
          {branch.ahead}
        </span>
      ) : null}
      {branch.behind > 0 ? (
        <span className="flex shrink-0 items-center text-2xs text-warning">
          <ArrowDown className="h-2.5 w-2.5" />
          {branch.behind}
        </span>
      ) : null}
    </button>
  );

  return (
    <SidebarSection
      sectionKey="branches"
      title={t('nav.branches', 'Branches')}
      icon={<GitBranch className="h-3 w-3" />}
      count={branches.length || undefined}
      action={
        <SectionAction
          icon={<Plus className="h-3.5 w-3.5" />}
          label={t('menu.createBranch', 'Create branch…')}
          onClick={() => openDialog('branch-create')}
        />
      }
    >
      <div className="px-1.5 pb-1">
        <div className="relative">
          <Search className="pointer-events-none absolute left-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-fg-muted" />
          <Input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder={t('nav.searchPlaceholder', 'Filter branches…')}
            className="h-6 bg-canvas pl-6 text-2xs"
            aria-label={t('nav.searchPlaceholder', 'Filter branches…')}
          />
        </div>
      </div>

      {branchesQuery.isLoading ? (
        <div className="flex items-center gap-1.5 px-2 py-1 text-2xs text-fg-muted">
          <Spinner size={11} /> {t('common.loading', 'Loading…')}
        </div>
      ) : branches.length === 0 ? (
        <p className="px-2 py-1 text-2xs text-fg-muted">{t('nav.noItems', 'Nothing here yet')}</p>
      ) : (
        <>
          <SidebarSubHeading
            open={localOpen}
            label={t('nav.local', 'Local')}
            count={localCount}
            onToggle={() => toggleSection('branches-local')}
          />
          {localOpen ? (
            localBranches.length > 0 ? (
              localBranches.map(renderRow)
            ) : (
              <p className="px-2 py-0.5 text-2xs text-fg-muted">{t('common.noResults', 'No results')}</p>
            )
          ) : null}
          <SidebarSubHeading
            open={remoteOpen}
            label={t('nav.remote', 'Remote')}
            count={remoteCount}
            onToggle={() => toggleSection('branches-remote')}
          />
          {remoteOpen ? (
            remoteBranches.length > 0 ? (
              remoteBranches.map(renderRow)
            ) : (
              <p className="px-2 py-0.5 text-2xs text-fg-muted">{t('nav.noItems', 'Nothing here yet')}</p>
            )
          ) : null}
        </>
      )}

      <ContextMenuHost menu={menu} onClose={closeMenu} />
    </SidebarSection>
  );
}

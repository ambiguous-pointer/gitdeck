import { Copy, FolderGit2, FolderOpen, GitBranch, Lock, Plus, Trash2, Unlock } from 'lucide-react';
import type { MenuItemSpec } from '@/components/ui/menu';
import { useRepoSummary, useWorktrees } from '@/api/hooks';
import { Spinner } from '@/components/ui/spinner';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/cn';
import { useAppStore } from '@/stores/app-store';
import { ContextMenuHost, useContextMenuController } from '../context-menu';
import { SectionAction, SidebarSection, sidebarRowClass } from './sidebar-section';
import { useRepoCommands } from './use-repo-commands';

/** Worktrees section: open in GitDeck, lock/unlock, remove. */
export function WorktreesSection(): JSX.Element {
  const { t } = useI18n();
  const activeRepoId = useAppStore((state) => state.activeRepoId);
  const openDialog = useAppStore((state) => state.openDialog);
  const worktreesQuery = useWorktrees(activeRepoId);
  const summary = useRepoSummary(activeRepoId);
  const commands = useRepoCommands(activeRepoId);
  const { menu, openMenu, closeMenu } = useContextMenuController();
  const worktrees = worktreesQuery.data?.worktrees ?? [];

  const menuItems = (path: string, locked: boolean): MenuItemSpec[] => [
    {
      id: 'open',
      label: t('menu.openWorktree', 'Open worktree in GitDeck'),
      icon: <FolderOpen className="h-3.5 w-3.5" />,
    },
    {
      id: locked ? 'unlock' : 'lock',
      label: locked ? t('menu.unlockWorktree', 'Unlock worktree') : t('menu.lockWorktree', 'Lock worktree'),
      icon: locked ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />,
    },
    { id: 'copy', label: t('common.copyPath', 'Copy path'), icon: <Copy className="h-3.5 w-3.5" /> },
    {
      id: 'remove',
      label: t('menu.removeWorktree', 'Remove worktree…'),
      icon: <Trash2 className="h-3.5 w-3.5" />,
      danger: true,
      separatorBefore: true,
    },
  ];

  const handleMenu = (id: string, path: string) => {
    switch (id) {
      case 'open':
        commands.openWorktree(path);
        break;
      case 'lock':
        commands.lockWorktree(path);
        break;
      case 'unlock':
        commands.unlockWorktree(path);
        break;
      case 'copy':
        commands.copy(path);
        break;
      case 'remove':
        openDialog('worktree-remove', { path });
        break;
      default:
        break;
    }
  };

  return (
    <SidebarSection
      sectionKey="worktrees"
      title={t('nav.worktrees', 'Worktrees')}
      icon={<FolderGit2 className="h-3 w-3" />}
      count={worktrees.length || undefined}
      action={
        <SectionAction
          icon={<Plus className="h-3.5 w-3.5" />}
          label={t('dialog.worktree.addTitle', 'Create worktree')}
          onClick={() => openDialog('worktree-add')}
        />
      }
    >
      {worktreesQuery.isLoading ? (
        <div className="flex items-center gap-1.5 px-2 py-1 text-2xs text-fg-muted">
          <Spinner size={11} /> {t('common.loading', 'Loading…')}
        </div>
      ) : worktrees.length === 0 ? (
        <p className="px-2 py-0.5 text-2xs text-fg-muted">{t('nav.noItems', 'Nothing here yet')}</p>
      ) : (
        worktrees.map((worktree) => {
          const active = summary.data?.path === worktree.path;
          return (
            <button
              key={worktree.path}
              type="button"
              onClick={() => commands.openWorktree(worktree.path)}
              onContextMenu={(event) =>
                openMenu(event, menuItems(worktree.path, Boolean(worktree.locked)), (id) =>
                  handleMenu(id, worktree.path),
                )
              }
              title={worktree.path}
              className={cn(
                sidebarRowClass,
                active ? 'bg-accent-soft text-accent' : 'text-fg-secondary hover:bg-hover hover:text-fg',
              )}
            >
              <FolderGit2 className={cn('h-3 w-3 shrink-0', active ? 'text-accent' : 'opacity-60')} />
              <span className="min-w-0 flex-1 truncate">{worktree.name}</span>
              {worktree.branch ? (
                <span className="flex shrink-0 items-center gap-0.5 text-2xs text-fg-muted">
                  <GitBranch className="h-2.5 w-2.5" />
                  {worktree.branch}
                </span>
              ) : worktree.detached ? (
                <span className="shrink-0 text-2xs text-warning">{t('repo.detached', 'detached HEAD')}</span>
              ) : null}
              {worktree.locked ? <Lock className="h-2.5 w-2.5 shrink-0 text-warning" /> : null}
            </button>
          );
        })
      )}
      <ContextMenuHost menu={menu} onClose={closeMenu} />
    </SidebarSection>
  );
}

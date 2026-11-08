import {
  Archive,
  FolderGit2,
  FolderOpen,
  FolderPlus,
  GitBranch,
  PanelLeftClose,
  PanelLeftOpen,
  Tag,
  Waypoints,
} from 'lucide-react';
import { useRepoSummary } from '@/api/hooks';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { useI18n } from '@/i18n';
import { useAppStore } from '@/stores/app-store';
import { BranchesSection } from './sidebar/BranchesSection';
import { RemotesSection } from './sidebar/RemotesSection';
import { StashesSection } from './sidebar/StashesSection';
import { TagsSection } from './sidebar/TagsSection';
import { WorktreesSection } from './sidebar/WorktreesSection';

/**
 * Left navigation: branches, remotes, tags, stashes and worktrees with their
 * full context menus. Collapses to a slim rail.
 */
export function Sidebar(): JSX.Element {
  const { t } = useI18n();
  const collapsed = useAppStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useAppStore((state) => state.toggleSidebar);
  const activeRepoId = useAppStore((state) => state.activeRepoId);
  const openDialog = useAppStore((state) => state.openDialog);
  const summary = useRepoSummary(activeRepoId);

  const railButton =
    'flex h-7 w-7 items-center justify-center rounded text-fg-muted transition-colors hover:bg-hover hover:text-fg';

  if (collapsed) {
    return (
      <aside className="flex w-9 shrink-0 flex-col items-center gap-0.5 border-r border-border bg-surface py-1.5">
        <Tooltip label={t('nav.repositories', 'Repositories')}>
          <button
            type="button"
            onClick={toggleSidebar}
            className={railButton}
            aria-label={t('nav.repositories', 'Repositories')}
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        </Tooltip>
        <span className="my-0.5 h-px w-5 bg-border" />
        {[
          { icon: <GitBranch className="h-4 w-4" />, label: t('nav.branches', 'Branches') },
          { icon: <Waypoints className="h-4 w-4" />, label: t('nav.remotes', 'Remotes') },
          { icon: <Tag className="h-4 w-4" />, label: t('nav.tags', 'Tags') },
          { icon: <Archive className="h-4 w-4" />, label: t('nav.stashes', 'Stashes') },
          { icon: <FolderGit2 className="h-4 w-4" />, label: t('nav.worktrees', 'Worktrees') },
        ].map((item) => (
          <Tooltip key={item.label} label={item.label}>
            <button
              type="button"
              onClick={toggleSidebar}
              className={railButton}
              aria-label={item.label}
              disabled={!activeRepoId}
            >
              {item.icon}
            </button>
          </Tooltip>
        ))}
      </aside>
    );
  }

  return (
    <aside className="flex w-60 shrink-0 flex-col overflow-hidden border-r border-border bg-surface">
      <div className="flex h-8 shrink-0 items-center gap-1.5 border-b border-border px-2">
        <FolderGit2 className="h-3.5 w-3.5 shrink-0 text-fg-muted" />
        <span
          className="min-w-0 flex-1 truncate text-xs font-semibold text-fg"
          title={activeRepoId ? summary.data?.path : undefined}
        >
          {(activeRepoId ? summary.data?.name : undefined) ?? t('nav.repositories', 'Repositories')}
        </span>
        {activeRepoId && summary.data?.isWorktree ? (
          <span className="shrink-0 rounded bg-info/15 px-1 text-2xs text-info">
            {t('repo.worktreeBadge', 'worktree')}
          </span>
        ) : null}
        <Tooltip label={t('repo.openButton', 'Open repository')}>
          <button
            type="button"
            onClick={() => openDialog('add-repo')}
            className="flex h-5 w-5 items-center justify-center rounded text-fg-muted transition-colors hover:bg-hover hover:text-fg"
            aria-label={t('repo.openButton', 'Open repository')}
          >
            <FolderPlus className="h-3.5 w-3.5" />
          </button>
        </Tooltip>
        <Tooltip label={t('common.close', 'Close')}>
          <button
            type="button"
            onClick={toggleSidebar}
            className="flex h-5 w-5 items-center justify-center rounded text-fg-muted transition-colors hover:bg-hover hover:text-fg"
            aria-label={t('common.close', 'Close')}
          >
            <PanelLeftClose className="h-3.5 w-3.5" />
          </button>
        </Tooltip>
      </div>

      {activeRepoId ? (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
            <BranchesSection />
            <RemotesSection />
            <TagsSection />
            <StashesSection />
            <WorktreesSection />
          </div>
          <div className="shrink-0 border-t border-border p-1.5">
            <Button
              variant="ghost"
              size="xs"
              className="w-full justify-start text-fg-muted"
              icon={<FolderOpen className="h-3.5 w-3.5" />}
              onClick={() => openDialog('add-repo')}
            >
              {t('repo.openButton', 'Open repository')}
            </Button>
          </div>
        </>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-4 text-center">
          <FolderGit2 className="h-8 w-8 text-fg-muted opacity-50" />
          <p className="text-xs text-fg-muted">{t('repo.noRepo', 'No repository selected')}</p>
          <Button
            variant="primary"
            size="sm"
            icon={<FolderOpen className="h-3.5 w-3.5" />}
            onClick={() => openDialog('add-repo')}
          >
            {t('repo.openButton', 'Open repository')}
          </Button>
        </div>
      )}
    </aside>
  );
}

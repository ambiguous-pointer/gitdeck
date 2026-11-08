import { Archive, ChevronDown, ChevronRight, FolderGit2, GitBranch, Tag, Waypoints } from 'lucide-react';
import type { ReactNode } from 'react';
import { useBranches, useRemotes, useStashes, useTags, useWorktrees } from '@/api/hooks';
import { Spinner } from '@/components/ui/spinner';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/cn';
import { useAppStore } from '@/stores/app-store';

function Section({
  sectionKey,
  title,
  icon,
  count,
  children,
}: {
  sectionKey: string;
  title: string;
  icon: ReactNode;
  count?: number;
  children: ReactNode;
}): JSX.Element {
  const open = useAppStore((state) => state.sidebarSections[sectionKey] ?? true);
  const toggle = useAppStore((state) => state.toggleSidebarSection);
  return (
    <div className="border-b border-border-subtle">
      <button
        type="button"
        onClick={() => toggle(sectionKey)}
        className="flex h-8 w-full items-center gap-1.5 px-2.5 text-2xs font-semibold uppercase tracking-wide text-fg-muted hover:text-fg"
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <span className="text-fg-muted">{icon}</span>
        <span className="flex-1 text-left">{title}</span>
        {count !== undefined ? <span className="text-2xs text-fg-muted">{count}</span> : null}
      </button>
      {open ? <div className="pb-1">{children}</div> : null}
    </div>
  );
}

/** Left navigation: branches, remotes, tags, stashes, worktrees. */
export function Sidebar(): JSX.Element {
  const { t } = useI18n();
  const collapsed = useAppStore((state) => state.sidebarCollapsed);
  const activeRepoId = useAppStore((state) => state.activeRepoId);
  const openDialog = useAppStore((state) => state.openDialog);
  const branches = useBranches(activeRepoId);
  const remotes = useRemotes(activeRepoId);
  const tags = useTags(activeRepoId);
  const stashes = useStashes(activeRepoId);
  const worktrees = useWorktrees(activeRepoId);

  if (collapsed) return <aside className="w-0 shrink-0 border-r border-border" />;

  return (
    <aside className="flex w-60 shrink-0 flex-col overflow-hidden border-r border-border bg-surface">
      <div className="flex h-8 items-center gap-1.5 border-b border-border px-2.5 text-2xs font-semibold uppercase tracking-wide text-fg-muted">
        <FolderGit2 className="h-3.5 w-3.5" />
        {t('nav.repositories', 'Repositories')}
      </div>
      <button
        type="button"
        onClick={() => openDialog('add-repo')}
        className="mx-2 mt-1.5 flex h-7 items-center justify-center gap-1 rounded border border-dashed border-border-strong text-xs text-fg-muted hover:border-accent hover:text-accent"
      >
        + {t('repo.openButton', 'Open repository')}
      </button>
      <div className="mt-1.5 flex min-h-0 flex-1 flex-col overflow-y-auto scrollbar-thin">
        <Section
          sectionKey="branches"
          title={t('nav.branches', 'Branches')}
          icon={<GitBranch className="h-3 w-3" />}
          count={branches.data?.branches.length}
        >
          {branches.isLoading ? (
            <div className="px-3 py-2">
              <Spinner size={12} />
            </div>
          ) : (
            (branches.data?.branches ?? []).slice(0, 60).map((branch) => (
              <button
                key={`${branch.isRemote ? 'r' : 'l'}-${branch.name}`}
                type="button"
                onClick={() => openDialog('checkout', { target: branch.name })}
                className={cn(
                  'flex h-6 w-full items-center gap-1.5 px-3 text-left text-xs',
                  branch.current ? 'bg-accent-soft text-accent' : 'text-fg-secondary hover:bg-hover',
                )}
              >
                <GitBranch className="h-3 w-3 shrink-0 opacity-60" />
                <span className="truncate">{branch.name}</span>
                {branch.isRemote ? <span className="ml-auto text-2xs text-fg-muted">remote</span> : null}
              </button>
            ))
          )}
        </Section>

        <Section sectionKey="remotes" title={t('nav.remotes', 'Remotes')} icon={<Waypoints className="h-3 w-3" />} count={remotes.data?.remotes.length}>
          {(remotes.data?.remotes ?? []).map((remote) => (
            <button
              key={remote.name}
              type="button"
              onClick={() => openDialog('remote-edit', { name: remote.name })}
              className="flex h-6 w-full items-center gap-1.5 px-3 text-left text-xs text-fg-secondary hover:bg-hover"
            >
              <span className="truncate">{remote.name}</span>
            </button>
          ))}
        </Section>

        <Section sectionKey="tags" title={t('nav.tags', 'Tags')} icon={<Tag className="h-3 w-3" />} count={tags.data?.tags.length}>
          {(tags.data?.tags ?? []).slice(0, 40).map((tag) => (
            <button
              key={tag.name}
              type="button"
              onClick={() => openDialog('tag-delete', { name: tag.name })}
              className="flex h-6 w-full items-center gap-1.5 px-3 text-left text-xs text-fg-secondary hover:bg-hover"
            >
              <Tag className="h-3 w-3 shrink-0 opacity-60" />
              <span className="truncate">{tag.name}</span>
            </button>
          ))}
        </Section>

        <Section sectionKey="stashes" title={t('nav.stashes', 'Stashes')} icon={<Archive className="h-3 w-3" />} count={stashes.data?.stashes.length}>
          {(stashes.data?.stashes ?? []).map((stash) => (
            <button
              key={stash.index}
              type="button"
              onClick={() => openDialog('stash-view', { index: stash.index })}
              className="flex h-6 w-full items-center gap-1.5 px-3 text-left text-xs text-fg-secondary hover:bg-hover"
            >
              <Archive className="h-3 w-3 shrink-0 opacity-60" />
              <span className="truncate">{stash.message}</span>
            </button>
          ))}
        </Section>

        <Section sectionKey="worktrees" title={t('nav.worktrees', 'Worktrees')} icon={<FolderGit2 className="h-3 w-3" />} count={worktrees.data?.worktrees.length}>
          {(worktrees.data?.worktrees ?? []).map((worktree) => (
            <div key={worktree.path} className="flex h-6 items-center gap-1.5 px-3 text-xs text-fg-secondary hover:bg-hover">
              <FolderGit2 className="h-3 w-3 shrink-0 opacity-60" />
              <span className="truncate">{worktree.name}</span>
            </div>
          ))}
        </Section>
      </div>
    </aside>
  );
}

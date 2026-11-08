import { ArrowDownToLine, Copy, Pencil, Plus, Scissors, Trash2, Waypoints } from 'lucide-react';
import type { MenuItemSpec } from '@/components/ui/menu';
import { useRemotes } from '@/api/hooks';
import { Spinner } from '@/components/ui/spinner';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/cn';
import { useAppStore } from '@/stores/app-store';
import { ContextMenuHost, useContextMenuController } from '../context-menu';
import { SectionAction, SidebarSection, sidebarRowClass } from './sidebar-section';
import { useRepoCommands } from './use-repo-commands';

/** Remotes section: fetch / prune / edit / remove context actions. */
export function RemotesSection(): JSX.Element {
  const { t } = useI18n();
  const activeRepoId = useAppStore((state) => state.activeRepoId);
  const openDialog = useAppStore((state) => state.openDialog);
  const remotesQuery = useRemotes(activeRepoId);
  const commands = useRepoCommands(activeRepoId);
  const { menu, openMenu, closeMenu } = useContextMenuController();
  const remotes = remotesQuery.data?.remotes ?? [];

  const menuItems = (name: string): MenuItemSpec[] => [
    {
      id: 'fetch',
      label: t('menu.fetchRemote', 'Fetch remote'),
      icon: <ArrowDownToLine className="h-3.5 w-3.5" />,
    },
    { id: 'prune', label: t('menu.pruneRemote', 'Prune remote'), icon: <Scissors className="h-3.5 w-3.5" /> },
    {
      id: 'edit',
      label: t('menu.editRemote', 'Edit remote…'),
      icon: <Pencil className="h-3.5 w-3.5" />,
      separatorBefore: true,
    },
    { id: 'copy-url', label: t('common.copyPath', 'Copy path'), icon: <Copy className="h-3.5 w-3.5" /> },
    {
      id: 'remove',
      label: t('menu.deleteRemote', 'Remove remote…'),
      icon: <Trash2 className="h-3.5 w-3.5" />,
      danger: true,
      separatorBefore: true,
    },
  ];

  const handleMenu = (id: string, name: string, url: string) => {
    switch (id) {
      case 'fetch':
        commands.fetchRemote(name);
        break;
      case 'prune':
        commands.fetchRemote(name, true);
        break;
      case 'edit':
        openDialog('remote-edit', { name });
        break;
      case 'copy-url':
        commands.copy(url, name);
        break;
      case 'remove':
        openDialog('remote-remove', { name });
        break;
      default:
        break;
    }
  };

  return (
    <SidebarSection
      sectionKey="remotes"
      title={t('nav.remotes', 'Remotes')}
      icon={<Waypoints className="h-3 w-3" />}
      count={remotes.length || undefined}
      action={
        <SectionAction
          icon={<Plus className="h-3.5 w-3.5" />}
          label={t('dialog.remote.addTitle', 'Add remote')}
          onClick={() => openDialog('remote-add')}
        />
      }
    >
      {remotesQuery.isLoading ? (
        <div className="flex items-center gap-1.5 px-2 py-1 text-2xs text-fg-muted">
          <Spinner size={11} /> {t('common.loading', 'Loading…')}
        </div>
      ) : remotes.length === 0 ? (
        <p className="px-2 py-0.5 text-2xs text-fg-muted">{t('nav.noItems', 'Nothing here yet')}</p>
      ) : (
        remotes.map((remote) => (
          <button
            key={remote.name}
            type="button"
            onClick={() => openDialog('remote-edit', { name: remote.name })}
            onContextMenu={(event) =>
              openMenu(event, menuItems(remote.name), (id) => handleMenu(id, remote.name, remote.fetchUrl))
            }
            title={`${remote.name}\n${remote.fetchUrl}`}
            className={cn(sidebarRowClass, 'text-fg-secondary hover:bg-hover hover:text-fg')}
          >
            <Waypoints className="h-3 w-3 shrink-0 opacity-60" />
            <span className="min-w-0 flex-1">
              <span className="block truncate">{remote.name}</span>
              <span className="block truncate text-2xs text-fg-muted">{remote.fetchUrl}</span>
            </span>
          </button>
        ))
      )}
      <ContextMenuHost menu={menu} onClose={closeMenu} />
    </SidebarSection>
  );
}

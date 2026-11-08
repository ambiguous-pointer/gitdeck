import { Archive, ArrowDownToLine, Copy, Eye, Plus, Trash2, Upload } from 'lucide-react';
import type { MenuItemSpec } from '@/components/ui/menu';
import { useStashes } from '@/api/hooks';
import { Spinner } from '@/components/ui/spinner';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/cn';
import { formatRelativeTime } from '@/lib/format';
import { useAppStore } from '@/stores/app-store';
import { ContextMenuHost, useContextMenuController } from '../context-menu';
import { SectionAction, SidebarSection, sidebarRowClass } from './sidebar-section';
import { useRepoCommands } from './use-repo-commands';

/** Stashes section: view / apply / pop / drop with a confirmation for drops. */
export function StashesSection(): JSX.Element {
  const { t, locale } = useI18n();
  const activeRepoId = useAppStore((state) => state.activeRepoId);
  const openDialog = useAppStore((state) => state.openDialog);
  const stashesQuery = useStashes(activeRepoId);
  const commands = useRepoCommands(activeRepoId);
  const { menu, openMenu, closeMenu } = useContextMenuController();
  const stashes = stashesQuery.data?.stashes ?? [];

  const menuItems = (): MenuItemSpec[] => [
    { id: 'view', label: t('menu.viewStash', 'View stash'), icon: <Eye className="h-3.5 w-3.5" /> },
    {
      id: 'apply',
      label: t('menu.applyStash', 'Apply stash'),
      icon: <ArrowDownToLine className="h-3.5 w-3.5" />,
    },
    { id: 'pop', label: t('menu.popStash', 'Pop stash'), icon: <Upload className="h-3.5 w-3.5" /> },
    { id: 'copy', label: t('common.copy', 'Copy'), icon: <Copy className="h-3.5 w-3.5" /> },
    {
      id: 'drop',
      label: t('menu.dropStash', 'Drop stash'),
      icon: <Trash2 className="h-3.5 w-3.5" />,
      danger: true,
      separatorBefore: true,
    },
  ];

  const handleMenu = (id: string, index: number) => {
    switch (id) {
      case 'view':
        openDialog('stash-view', { index });
        break;
      case 'apply':
        commands.stashApply(index);
        break;
      case 'pop':
        commands.stashPop(index);
        break;
      case 'copy': {
        const stash = stashes.find((item) => item.index === index);
        if (stash) commands.copy(stash.message, stash.name);
        break;
      }
      case 'drop':
        openDialog('confirm', {
          title: t('menu.dropStash', 'Drop stash'),
          description: t(
            'dialog.stash.dropMessage',
            'This permanently removes the stash entry. The stashed changes cannot be recovered.',
          ),
          confirmLabel: t('common.delete', 'Delete'),
          danger: true,
          onConfirm: () => commands.stashDrop(index),
        });
        break;
      default:
        break;
    }
  };

  return (
    <SidebarSection
      sectionKey="stashes"
      title={t('nav.stashes', 'Stashes')}
      icon={<Archive className="h-3 w-3" />}
      count={stashes.length || undefined}
      action={
        <SectionAction
          icon={<Plus className="h-3.5 w-3.5" />}
          label={t('dialog.stash.title', 'Stash changes')}
          onClick={() => openDialog('stash-create')}
        />
      }
    >
      {stashesQuery.isLoading ? (
        <div className="flex items-center gap-1.5 px-2 py-1 text-2xs text-fg-muted">
          <Spinner size={11} /> {t('common.loading', 'Loading…')}
        </div>
      ) : stashes.length === 0 ? (
        <p className="px-2 py-0.5 text-2xs text-fg-muted">{t('nav.noItems', 'Nothing here yet')}</p>
      ) : (
        stashes.map((stash) => (
          <button
            key={stash.index}
            type="button"
            onClick={() => openDialog('stash-view', { index: stash.index })}
            onContextMenu={(event) => openMenu(event, menuItems(), (id) => handleMenu(id, stash.index))}
            title={`${stash.name} · ${stash.branch ?? ''}`}
            className={cn(sidebarRowClass, 'text-fg-secondary hover:bg-hover hover:text-fg')}
          >
            <Archive className="h-3 w-3 shrink-0 opacity-60" />
            <span className="min-w-0 flex-1 truncate">{stash.message}</span>
            {stash.date ? (
              <span className="shrink-0 text-2xs text-fg-muted">
                {formatRelativeTime(stash.date, locale)}
              </span>
            ) : null}
          </button>
        ))
      )}
      <ContextMenuHost menu={menu} onClose={closeMenu} />
    </SidebarSection>
  );
}

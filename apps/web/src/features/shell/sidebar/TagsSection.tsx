import { Check, Copy, Tag, Trash2, Upload } from 'lucide-react';
import type { MenuItemSpec } from '@/components/ui/menu';
import { useTags } from '@/api/hooks';
import { Spinner } from '@/components/ui/spinner';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/cn';
import { formatRelativeTime } from '@/lib/format';
import { useAppStore } from '@/stores/app-store';
import { ContextMenuHost, useContextMenuController } from '../context-menu';
import { SectionAction, SidebarSection, sidebarRowClass } from './sidebar-section';
import { useRepoCommands } from './use-repo-commands';

/** Tags section: checkout / push / delete tag and copy its name. */
export function TagsSection(): JSX.Element {
  const { t, locale } = useI18n();
  const activeRepoId = useAppStore((state) => state.activeRepoId);
  const openDialog = useAppStore((state) => state.openDialog);
  const selectCommit = useAppStore((state) => state.selectCommit);
  const tagsQuery = useTags(activeRepoId);
  const commands = useRepoCommands(activeRepoId);
  const { menu, openMenu, closeMenu } = useContextMenuController();
  const tags = tagsQuery.data?.tags ?? [];

  const menuItems = (name: string): MenuItemSpec[] => [
    { id: 'checkout', label: t('menu.checkout', 'Checkout'), icon: <Tag className="h-3.5 w-3.5" /> },
    { id: 'push', label: t('menu.pushTag', 'Push tag'), icon: <Upload className="h-3.5 w-3.5" /> },
    { id: 'copy', label: t('menu.copyTagName', 'Copy tag name'), icon: <Copy className="h-3.5 w-3.5" /> },
    {
      id: 'delete',
      label: t('menu.deleteTag', 'Delete tag…'),
      icon: <Trash2 className="h-3.5 w-3.5" />,
      danger: true,
      separatorBefore: true,
    },
  ];

  const handleMenu = (id: string, name: string) => {
    switch (id) {
      case 'checkout':
        openDialog('checkout', { target: name, detach: true });
        break;
      case 'push':
        commands.pushTag(name);
        break;
      case 'copy':
        commands.copy(name);
        break;
      case 'delete':
        openDialog('tag-delete', { name });
        break;
      default:
        break;
    }
  };

  return (
    <SidebarSection
      sectionKey="tags"
      title={t('nav.tags', 'Tags')}
      icon={<Tag className="h-3 w-3" />}
      count={tags.length || undefined}
      action={
        <SectionAction
          icon={<Tag className="h-3.5 w-3.5" />}
          label={t('menu.addTag', 'Add tag…')}
          onClick={() => openDialog('tag-create')}
        />
      }
    >
      {tagsQuery.isLoading ? (
        <div className="flex items-center gap-1.5 px-2 py-1 text-2xs text-fg-muted">
          <Spinner size={11} /> {t('common.loading', 'Loading…')}
        </div>
      ) : tags.length === 0 ? (
        <p className="px-2 py-0.5 text-2xs text-fg-muted">{t('nav.noItems', 'Nothing here yet')}</p>
      ) : (
        tags.map((tag) => (
          <button
            key={tag.name}
            type="button"
            onClick={() => selectCommit(tag.hash)}
            onContextMenu={(event) => openMenu(event, menuItems(tag.name), (id) => handleMenu(id, tag.name))}
            title={`${tag.name}\n${tag.subject}`}
            className={cn(sidebarRowClass, 'text-fg-secondary hover:bg-hover hover:text-fg')}
          >
            <Tag className="h-3 w-3 shrink-0 text-warning opacity-80" />
            <span className="min-w-0 flex-1 truncate">{tag.name}</span>
            {tag.annotated ? <Check className="h-2.5 w-2.5 shrink-0 text-fg-muted" aria-hidden /> : null}
            {tag.date ? (
              <span className="shrink-0 text-2xs text-fg-muted">{formatRelativeTime(tag.date, locale)}</span>
            ) : null}
          </button>
        ))
      )}
      <ContextMenuHost menu={menu} onClose={closeMenu} />
    </SidebarSection>
  );
}

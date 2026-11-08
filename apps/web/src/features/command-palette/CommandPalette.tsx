import { Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { useI18n } from '@/i18n';
import { useAppStore, type DialogId } from '@/stores/app-store';
import { useTheme } from '@/theme/ThemeProvider';

interface PaletteCommand {
  id: string;
  title: string;
  hint?: string;
  run: () => void;
}

/** Ctrl/Cmd+K command palette. STUB: replaced by the shell feature branch. */
export function CommandPalette(): JSX.Element | null {
  const { t, toggleLocale } = useI18n();
  const { mode, setMode } = useTheme();
  const open = useAppStore((state) => state.commandPaletteOpen);
  const setOpen = useAppStore((state) => state.setCommandPaletteOpen);
  const openDialog = useAppStore((state) => state.openDialog);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const commands = useMemo<PaletteCommand[]>(() => {
    const dialogCommands: { id: DialogId; title: string }[] = [
      { id: 'merge', title: t('actions.merge', 'Merge…') },
      { id: 'rebase', title: t('actions.rebase', 'Rebase…') },
      { id: 'cherry-pick', title: t('actions.cherryPick', 'Cherry pick…') },
      { id: 'push', title: t('actions.push', 'Push') },
      { id: 'pull', title: t('actions.pull', 'Pull') },
      { id: 'fetch', title: t('actions.fetch', 'Fetch') },
      { id: 'stash-create', title: t('actions.stash', 'Stash') },
      { id: 'tag-create', title: t('actions.tag', 'Tag') },
      { id: 'branch-create', title: t('actions.branch', 'New branch') },
      { id: 'worktree-add', title: t('actions.worktree', 'Worktree') },
      { id: 'remote-add', title: t('actions.remote', 'Remote') },
      { id: 'settings', title: t('settings.title', 'Settings') },
    ];
    const list: PaletteCommand[] = dialogCommands.map((command) => ({
      id: command.id,
      title: command.title,
      hint: t('common.actions', 'Actions'),
      run: () => {
        setOpen(false);
        openDialog(command.id);
      },
    }));
    list.push({
      id: 'toggle-theme',
      title: t('shortcuts.theme', 'Toggle theme'),
      hint: mode === 'light' ? '→ dark' : '→ light',
      run: () => {
        setMode(mode === 'light' ? 'dark' : 'light');
        setOpen(false);
      },
    });
    list.push({
      id: 'toggle-language',
      title: t('common.language', 'Language'),
      hint: t('actions.openPalette', ''),
      run: () => {
        toggleLocale();
        setOpen(false);
      },
    });
    return list;
  }, [t, mode, setMode, openDialog, setOpen, toggleLocale]);

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return commands;
    return commands.filter((command) => command.title.toLowerCase().includes(value));
  }, [commands, query]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, setOpen]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-24" onMouseDown={() => setOpen(false)}>
      <div
        className="w-full max-w-lg overflow-hidden rounded-lg border border-border bg-elevated shadow-modal animate-scale-in"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="relative border-b border-border">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted" />
          <Input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('actions.openPalette', 'Command palette')}
            className="h-11 rounded-none border-0 bg-transparent pl-9 text-sm focus:ring-0"
          />
        </div>
        <div className="max-h-80 overflow-y-auto p-1">
          {filtered.map((command) => (
            <button
              key={command.id}
              type="button"
              onClick={command.run}
              className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-[13px] text-fg-secondary hover:bg-hover hover:text-fg"
            >
              <span className="flex-1 truncate">{command.title}</span>
              {command.hint ? <span className="text-2xs text-fg-muted">{command.hint}</span> : null}
            </button>
          ))}
          {filtered.length === 0 ? <p className="p-3 text-xs text-fg-muted">No commands</p> : null}
        </div>
      </div>
    </div>
  );
}

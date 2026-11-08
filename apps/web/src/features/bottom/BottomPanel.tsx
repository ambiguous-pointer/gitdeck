import { ChevronDown, ChevronUp, FileDiff, TerminalSquare } from 'lucide-react';
import { useRepoStatus } from '@/api/hooks';
import { Tabs } from '@/components/ui/tabs';
import { CommandLogPanel } from '@/features/console/CommandLogPanel';
import { WorkingTreePanel } from '@/features/changes/WorkingTreePanel';
import { useI18n } from '@/i18n';
import { useAppStore } from '@/stores/app-store';

/** Bottom dock with the working tree panel and the command console. */
export function BottomPanel(): JSX.Element {
  const { t } = useI18n();
  const activeRepoId = useAppStore((state) => state.activeRepoId);
  const open = useAppStore((state) => state.bottomPanelOpen);
  const tab = useAppStore((state) => state.bottomTab);
  const setTab = useAppStore((state) => state.setBottomTab);
  const toggle = useAppStore((state) => state.toggleBottomPanel);
  const status = useRepoStatus(activeRepoId);
  const counts = status.data?.counts;
  const changeCount = counts ? counts.staged + counts.unstaged + counts.untracked + counts.conflicted : 0;

  return (
    <section
      className="flex shrink-0 flex-col border-t border-border bg-surface"
      style={{ height: open ? 240 : 32 }}
      aria-label={t('changes.title', 'Changes')}
    >
      <div className="flex h-8 shrink-0 items-center gap-1 border-b border-border px-2">
        <Tabs
          size="sm"
          value={tab}
          onChange={(value) => setTab(value as 'changes' | 'console')}
          tabs={[
            {
              id: 'changes',
              label: t('actions.changes', 'Changes'),
              icon: <FileDiff className="h-3.5 w-3.5" />,
              badge: changeCount > 0 ? changeCount : undefined,
            },
            {
              id: 'console',
              label: t('actions.console', 'Console'),
              icon: <TerminalSquare className="h-3.5 w-3.5" />,
            },
          ]}
          className="border-b-0"
        />
        <button
          type="button"
          onClick={toggle}
          className="ml-auto rounded p-1 text-fg-muted hover:bg-hover hover:text-fg"
          aria-label={open ? 'Collapse panel' : 'Expand panel'}
        >
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </button>
      </div>
      {open ? (
        <div className="min-h-0 flex-1 overflow-hidden">
          {tab === 'changes' ? <WorkingTreePanel /> : <CommandLogPanel />}
        </div>
      ) : null}
    </section>
  );
}

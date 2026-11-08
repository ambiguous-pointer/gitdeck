/**
 * Bottom dock: Changes / Console tabs with a changes badge and a
 * collapse/expand control. Fixed height, dense desktop rhythm.
 */
import { ChevronDown, ChevronUp, FileDiff, TerminalSquare } from 'lucide-react';
import { useRepoStatus } from '@/api/hooks';
import { Tabs } from '@/components/ui/tabs';
import { CommandLogPanel } from '@/features/console/CommandLogPanel';
import { WorkingTreePanel } from '@/features/changes/WorkingTreePanel';
import { useI18n } from '@/i18n';
import { useAppStore } from '@/stores/app-store';

const OPEN_HEIGHT = 292;
const COLLAPSED_HEIGHT = 32;

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
      className="flex shrink-0 flex-col overflow-hidden border-t border-border bg-surface"
      style={{ height: open ? OPEN_HEIGHT : COLLAPSED_HEIGHT }}
      aria-label={t('changes.title', 'Changes')}
    >
      <div className="flex h-8 shrink-0 items-center gap-1 px-1.5">
        <Tabs
          size="sm"
          value={open ? tab : 'changes'}
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
          className="ml-auto rounded p-1 text-fg-muted transition-colors hover:bg-hover hover:text-fg"
          aria-label={open ? t('changes.collapsePanel', 'Collapse panel') : t('changes.expandPanel', 'Expand panel')}
          title={open ? t('changes.collapsePanel', 'Collapse panel') : t('changes.expandPanel', 'Expand panel')}
          aria-expanded={open}
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

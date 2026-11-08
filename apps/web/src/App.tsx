/**
 * Application shell layout.
 *
 * ┌─────────────────────────────────────────────┐
 * │ TopBar                                      │
 * ├────────┬────────────────────────────────────┤
 * │ Sidebar│ GraphView            │ CommitDetails│
 * │        ├──────────────────────┴──────────────┤
 * │        │ BottomPanel (Changes / Console)     │
 * ├────────┴────────────────────────────────────┤
 * │ StatusBar                                   │
 * └─────────────────────────────────────────────┘
 *
 * Feature components are self-contained (they read the store + hooks), so this
 * file stays stable while features evolve in parallel branches.
 */
import { useActiveRepoId } from '@/stores/app-store';
import { CommandPalette } from '@/features/command-palette/CommandPalette';
import { BottomPanel } from '@/features/bottom/BottomPanel';
import { DialogHost } from '@/features/dialogs/DialogHost';
import { DiffOverlay } from '@/features/diff/DiffOverlay';
import { CommitDetails } from '@/features/graph/CommitDetails';
import { GraphView } from '@/features/graph/GraphView';
import { SettingsDialog } from '@/features/settings/SettingsDialog';
import { Sidebar } from '@/features/shell/Sidebar';
import { StatusBar } from '@/features/shell/StatusBar';
import { TopBar } from '@/features/shell/TopBar';
import { WelcomeScreen } from '@/features/welcome/WelcomeScreen';

export default function App(): JSX.Element {
  const activeRepoId = useActiveRepoId();

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-canvas text-fg">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          {activeRepoId ? (
            <>
              <div className="flex min-h-0 flex-1">
                <GraphView />
                <CommitDetails />
              </div>
              <BottomPanel />
            </>
          ) : (
            <WelcomeScreen />
          )}
        </main>
      </div>
      <StatusBar />
      <SettingsDialog />
      <DialogHost />
      <DiffOverlay />
      <CommandPalette />
    </div>
  );
}

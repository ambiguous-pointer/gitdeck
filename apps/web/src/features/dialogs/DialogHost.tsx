/**
 * Single mount point for every GitDeck dialog. Renders exactly one modal,
 * chosen from `useAppStore().dialog`; returns `null` when no dialog is open so
 * nothing is mounted behind the scenes.
 *
 * `settings` is rendered by the design-system `SettingsDialog` and `commit` is
 * handled by the working-tree composer, so both are ignored here.
 */
import { useAppStore } from '@/stores/app-store';
import { AddRepoDialog } from './add-repo-dialog';
import { BranchCreateDialog, BranchDeleteDialog, BranchRenameDialog } from './branch-dialogs';
import { CheckoutDialog } from './checkout-dialog';
import { CommandRunDialog } from './command-run-dialog';
import { ConfigSetDialog } from './config-set-dialog';
import { ConfirmDialog } from './confirm-dialog';
import { CherryPickDialog, ResetDialog, RevertDialog } from './history-dialogs';
import { MergeDialog } from './merge-dialog';
import { RebaseDialog } from './rebase-dialog';
import { RemoteAddDialog, RemoteEditDialog, RemoteRemoveDialog } from './remote-dialogs';
import { StashCreateDialog, StashViewDialog } from './stash-dialogs';
import { FetchDialog, PullDialog, PushDialog } from './sync-dialogs';
import { TagCreateDialog, TagDeleteDialog } from './tag-dialogs';
import { WorktreeAddDialog, WorktreeRemoveDialog } from './worktree-dialogs';

export function DialogHost(): JSX.Element | null {
  const dialog = useAppStore((state) => state.dialog);

  if (!dialog) return null;

  switch (dialog.id) {
    case 'merge':
      return <MergeDialog />;
    case 'rebase':
      return <RebaseDialog />;
    case 'cherry-pick':
      return <CherryPickDialog />;
    case 'revert':
      return <RevertDialog />;
    case 'reset':
      return <ResetDialog />;
    case 'checkout':
      return <CheckoutDialog />;
    case 'branch-create':
      return <BranchCreateDialog />;
    case 'branch-delete':
      return <BranchDeleteDialog />;
    case 'branch-rename':
      return <BranchRenameDialog />;
    case 'tag-create':
      return <TagCreateDialog />;
    case 'tag-delete':
      return <TagDeleteDialog />;
    case 'push':
      return <PushDialog />;
    case 'pull':
      return <PullDialog />;
    case 'fetch':
      return <FetchDialog />;
    case 'stash-create':
      return <StashCreateDialog />;
    case 'stash-view':
      return <StashViewDialog />;
    case 'worktree-add':
      return <WorktreeAddDialog />;
    case 'worktree-remove':
      return <WorktreeRemoveDialog />;
    case 'remote-add':
      return <RemoteAddDialog />;
    case 'remote-edit':
      return <RemoteEditDialog />;
    case 'remote-remove':
      return <RemoteRemoveDialog />;
    case 'config-set':
      return <ConfigSetDialog />;
    case 'add-repo':
      return <AddRepoDialog />;
    case 'command-run':
      return <CommandRunDialog />;
    case 'confirm':
      return <ConfirmDialog />;
    case 'settings':
    case 'commit':
      return null;
    default:
      return null;
  }
}

import {
  ArrowUpFromLine,
  Copy,
  FolderGit2,
  GitBranch,
  GitBranchPlus,
  GitFork,
  GitMerge,
  GitPullRequest,
  Link2,
  Link2Off,
  RotateCcw,
  Tag,
  Trash2,
  Undo2,
} from 'lucide-react';
import type { Commit, GitRef } from '@gitdeck/shared';
import { errorMessage } from '@/api/client';
import { useBranches, useRemotes, useReset } from '@/api/hooks';
import { useToast } from '@/components/feedback/toast';
import type { MenuItemSpec } from '@/components/ui/menu';
import { useI18n, type Translator } from '@/i18n';
import { useAppStore } from '@/stores/app-store';
import { useRepoCommands } from '@/features/shell/sidebar/use-repo-commands';

const icon = {
  tag: <Tag className="h-3.5 w-3.5" />,
  branch: <GitBranch className="h-3.5 w-3.5" />,
  createBranch: <GitBranchPlus className="h-3.5 w-3.5" />,
  worktree: <FolderGit2 className="h-3.5 w-3.5" />,
  checkout: <GitBranch className="h-3.5 w-3.5" />,
  cherryPick: <GitFork className="h-3.5 w-3.5" />,
  revert: <Undo2 className="h-3.5 w-3.5" />,
  drop: <Trash2 className="h-3.5 w-3.5" />,
  merge: <GitMerge className="h-3.5 w-3.5" />,
  rebase: <GitPullRequest className="h-3.5 w-3.5" />,
  reset: <RotateCcw className="h-3.5 w-3.5" />,
  push: <ArrowUpFromLine className="h-3.5 w-3.5" />,
  copy: <Copy className="h-3.5 w-3.5" />,
  link: <Link2 className="h-3.5 w-3.5" />,
  unlink: <Link2Off className="h-3.5 w-3.5" />,
  delete: <Trash2 className="h-3.5 w-3.5" />,
};

/** Commit right-click menu — matches the reference GitKraken order. */
export function buildCommitMenuItems(t: Translator): MenuItemSpec[] {
  return [
    { id: 'tag', label: t('menu.addTag', 'Add tag…'), icon: icon.tag },
    { id: 'branch', label: t('menu.createBranch', 'Create branch…'), icon: icon.createBranch },
    { id: 'checkout', label: t('menu.checkout', 'Checkout'), icon: icon.checkout, separatorBefore: true },
    { id: 'cherry-pick', label: t('menu.cherryPick', 'Cherry pick…'), icon: icon.cherryPick },
    { id: 'revert', label: t('menu.revert', 'Revert commit…'), icon: icon.revert },
    {
      id: 'drop',
      label: t('menu.drop', 'Drop commit…'),
      icon: icon.drop,
      danger: true,
      separatorBefore: true,
    },
    {
      id: 'merge',
      label: t('menu.mergeIntoCurrentBranch', 'Merge into current branch…'),
      icon: icon.merge,
      separatorBefore: true,
    },
    {
      id: 'rebase',
      label: t('menu.rebaseCurrentOnCommit', 'Rebase current branch on this commit…'),
      icon: icon.rebase,
    },
    {
      id: 'reset',
      label: t('menu.resetCurrentBranch', 'Reset current branch to this commit…'),
      icon: icon.reset,
    },
    {
      id: 'copy-hash',
      label: t('menu.copyCommitHash', 'Copy commit hash'),
      icon: icon.copy,
      separatorBefore: true,
    },
    { id: 'copy-subject', label: t('menu.copyCommitSubject', 'Copy commit subject'), icon: icon.copy },
    { id: 'copy-message', label: t('menu.copyCommitMessage', 'Copy commit message'), icon: icon.copy },
  ];
}

export interface RefMenuOptions {
  hasUpstream: boolean;
  upstreamCandidate: boolean;
  isCurrent: boolean;
}

/** Branch / remote-branch / tag pill context menu. */
export function buildRefMenuItems(t: Translator, ref: GitRef, options: RefMenuOptions): MenuItemSpec[] {
  if (ref.type === 'tag') {
    return [
      { id: 'checkout', label: t('menu.checkout', 'Checkout'), icon: icon.tag },
      { id: 'push', label: t('menu.pushTag', 'Push tag'), icon: icon.push, separatorBefore: true },
      { id: 'delete', label: t('menu.deleteTag', 'Delete tag…'), icon: icon.delete, danger: true },
      {
        id: 'copy-name',
        label: t('menu.copyTagName', 'Copy tag name'),
        icon: icon.copy,
        separatorBefore: true,
      },
    ];
  }

  if (ref.type === 'remote') {
    return [
      { id: 'checkout', label: t('menu.checkoutBranch', 'Checkout branch'), icon: icon.checkout },
      { id: 'create-branch', label: t('menu.createBranch', 'Create branch…'), icon: icon.createBranch },
      { id: 'create-worktree', label: t('menu.createWorktree', 'Create worktree…'), icon: icon.worktree },
      {
        id: 'merge',
        label: t('menu.mergeIntoCurrent', 'Merge into current branch…'),
        icon: icon.merge,
        separatorBefore: true,
      },
      {
        id: 'rebase',
        label: t('menu.rebaseCurrentOnBranch', 'Rebase current branch on this branch…'),
        icon: icon.rebase,
      },
      {
        id: 'delete',
        label: t('menu.deleteBranch', 'Delete branch…'),
        icon: icon.delete,
        danger: true,
        separatorBefore: true,
      },
      {
        id: 'copy-name',
        label: t('menu.copyBranchName', 'Copy branch name'),
        icon: icon.copy,
        separatorBefore: true,
      },
    ];
  }

  const items: MenuItemSpec[] = [
    {
      id: 'checkout',
      label: t('menu.checkoutBranch', 'Checkout branch'),
      icon: icon.checkout,
      disabled: options.isCurrent,
    },
    { id: 'create-branch', label: t('menu.createBranch', 'Create branch…'), icon: icon.createBranch },
    { id: 'create-worktree', label: t('menu.createWorktree', 'Create worktree…'), icon: icon.worktree },
    {
      id: 'rename',
      label: t('menu.renameBranch', 'Rename branch…'),
      icon: icon.branch,
      separatorBefore: true,
    },
    { id: 'delete', label: t('menu.deleteBranch', 'Delete branch…'), icon: icon.delete, danger: true },
    {
      id: 'merge',
      label: t('menu.mergeIntoCurrent', 'Merge into current branch…'),
      icon: icon.merge,
      separatorBefore: true,
    },
    {
      id: 'rebase',
      label: t('menu.rebaseCurrentOnBranch', 'Rebase current branch on this branch…'),
      icon: icon.rebase,
    },
    { id: 'push', label: t('menu.pushBranch', 'Push branch…'), icon: icon.push, separatorBefore: true },
  ];
  if (options.upstreamCandidate) {
    items.push({ id: 'set-upstream', label: t('menu.setUpstream', 'Set upstream branch…'), icon: icon.link });
  }
  if (options.hasUpstream) {
    items.push({ id: 'unset-upstream', label: t('menu.unsetUpstream', 'Unset upstream'), icon: icon.unlink });
  }
  items.push(
    {
      id: 'copy-name',
      label: t('menu.copyBranchName', 'Copy branch name'),
      icon: icon.copy,
      separatorBefore: true,
    },
    {
      id: 'copy-upstream',
      label: t('menu.copyUpstream', 'Copy upstream name'),
      icon: icon.copy,
      disabled: !options.hasUpstream,
    },
  );
  return items;
}

/** Behaviour behind the commit + ref context menus (dialogs, copies, mutations). */
export function useGraphMenuActions(repoId: string | null): {
  commitAction: (id: string, commit: Commit) => void;
  refAction: (id: string, ref: GitRef) => void;
  refMenuOptions: (ref: GitRef) => RefMenuOptions;
} {
  const { t } = useI18n();
  const toast = useToast();
  const openDialog = useAppStore((state) => state.openDialog);
  const selectCommit = useAppStore((state) => state.selectCommit);
  const commands = useRepoCommands(repoId);
  const branchesQuery = useBranches(repoId);
  const remotesQuery = useRemotes(repoId);
  const reset = useReset(repoId);

  const branches = branchesQuery.data?.branches ?? [];

  const findUpstreamCandidate = (
    branchName: string,
  ): { remote: string; remoteBranch: string } | undefined => {
    for (const remote of remotesQuery.data?.remotes ?? []) {
      const tracker = branches.find(
        (candidate) =>
          candidate.isRemote &&
          candidate.remote === remote.name &&
          candidate.name === `${remote.name}/${branchName}`,
      );
      if (tracker) return { remote: remote.name, remoteBranch: branchName };
    }
    return undefined;
  };

  const localBranch = (name: string) => branches.find((branch) => !branch.isRemote && branch.name === name);

  const refMenuOptions = (ref: GitRef): RefMenuOptions => ({
    hasUpstream: Boolean(localBranch(ref.label)?.upstream),
    upstreamCandidate: ref.type === 'branch' && Boolean(findUpstreamCandidate(ref.label)),
    isCurrent: Boolean(ref.current),
  });

  const commitAction = (id: string, commit: Commit): void => {
    switch (id) {
      case 'tag':
        openDialog('tag-create', { target: commit.hash });
        break;
      case 'branch':
        openDialog('branch-create', { startPoint: commit.hash });
        break;
      case 'checkout':
        openDialog('checkout', { target: commit.hash, detach: true });
        break;
      case 'cherry-pick':
        openDialog('cherry-pick', { commits: [commit.hash] });
        break;
      case 'revert':
        openDialog('revert', { commits: [commit.hash] });
        break;
      case 'drop':
        openDialog('confirm', {
          title: t('menu.drop', 'Drop commit…'),
          description: t(
            'dialog.commit.dropMessage',
            'The current branch will be hard-reset to the parent of this commit. Uncommitted changes are discarded and this cannot be undone.',
          ),
          confirmLabel: t('common.delete', 'Delete'),
          danger: true,
          onConfirm: () =>
            reset.mutate(
              { target: `${commit.hash}^`, mode: 'hard' },
              {
                onSuccess: () => toast.success(t('toast.reset', 'Branch reset'), commit.shortHash),
                onError: (error) => toast.error(t('toast.failed', 'Operation failed'), errorMessage(error)),
              },
            ),
        });
        break;
      case 'merge':
        openDialog('merge', { branch: commit.hash });
        break;
      case 'rebase':
        openDialog('rebase', { onto: commit.hash });
        break;
      case 'reset':
        openDialog('reset', { target: commit.hash });
        break;
      case 'copy-hash':
        commands.copy(commit.hash, commit.shortHash);
        break;
      case 'copy-subject':
        commands.copy(commit.subject);
        break;
      case 'copy-message':
        commands.copy([commit.subject, commit.body].filter(Boolean).join('\n\n'), commit.shortHash);
        break;
      case 'details':
        selectCommit(commit.hash);
        break;
      default:
        break;
    }
  };

  const refAction = (id: string, ref: GitRef): void => {
    switch (id) {
      case 'checkout':
        openDialog('checkout', { target: ref.label, detach: ref.type !== 'branch' });
        break;
      case 'create-branch':
        openDialog('branch-create', { startPoint: ref.label });
        break;
      case 'create-worktree':
        openDialog('worktree-add', ref.type === 'branch' ? { branch: ref.label } : { startPoint: ref.label });
        break;
      case 'rename':
        openDialog('branch-rename', { name: ref.label });
        break;
      case 'delete':
        if (ref.type === 'tag') openDialog('tag-delete', { name: ref.label });
        else if (ref.type === 'remote') openDialog('branch-delete', { name: ref.label, remote: true });
        else openDialog('branch-delete', { name: ref.label });
        break;
      case 'merge':
        openDialog('merge', { branch: ref.label });
        break;
      case 'rebase':
        openDialog('rebase', { onto: ref.label });
        break;
      case 'push':
        if (ref.type === 'tag') commands.pushTag(ref.label);
        else openDialog('push', { branch: ref.label });
        break;
      case 'set-upstream': {
        const candidate = findUpstreamCandidate(ref.label);
        if (candidate) commands.setBranchUpstream(ref.label, candidate.remote, candidate.remoteBranch);
        break;
      }
      case 'unset-upstream':
        commands.unsetBranchUpstream(ref.label);
        break;
      case 'copy-name':
        commands.copy(ref.label);
        break;
      case 'copy-upstream': {
        const upstream = localBranch(ref.label)?.upstream;
        if (upstream) commands.copy(upstream);
        break;
      }
      default:
        break;
    }
  };

  return { commitAction, refAction, refMenuOptions };
}

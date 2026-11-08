import { useCallback } from 'react';
import type { UseMutationResult } from '@tanstack/react-query';
import type { OperationResult } from '@gitdeck/shared';
import { errorMessage } from '@/api/client';
import {
  useApplyStash,
  useDropStash,
  useExec,
  useFetch,
  useLockWorktree,
  useOpenRepo,
  usePopStash,
  useRemotes,
  useReposQuery,
  useSetUpstream,
} from '@/api/hooks';
import { useToast } from '@/components/feedback/toast';
import { useI18n } from '@/i18n';
import { useAppStore } from '@/stores/app-store';
import { copyText } from '../clipboard';

function samePath(a: string, b: string): boolean {
  const normalize = (value: string) => value.replace(/\//g, '\\').replace(/\\+$/, '').toLowerCase();
  return normalize(a) === normalize(b);
}

export interface RepoCommands {
  copy: (value: string, label?: string) => void;
  fetchRemote: (remote?: string, prune?: boolean) => void;
  pushTag: (tag: string) => void;
  stashApply: (index: number) => void;
  stashPop: (index: number) => void;
  stashDrop: (index: number) => void;
  lockWorktree: (path: string) => void;
  unlockWorktree: (path: string) => void;
  openWorktree: (path: string) => void;
  setBranchUpstream: (branch: string, remote: string, remoteBranch: string) => void;
  unsetBranchUpstream: (branch: string) => void;
}

/**
 * Thin wrappers around the shared mutation hooks that add toasts and error
 * reporting, used by the sidebar context menus and the graph ref menus.
 */
export function useRepoCommands(repoId: string | null): RepoCommands {
  const { t } = useI18n();
  const toast = useToast();
  const setActiveRepo = useAppStore((state) => state.setActiveRepo);
  const repos = useReposQuery();
  const remotes = useRemotes(repoId);
  const fetchMutation = useFetch(repoId);
  const upstreamMutation = useSetUpstream(repoId);
  const applyStash = useApplyStash(repoId);
  const popStash = usePopStash(repoId);
  const dropStash = useDropStash(repoId);
  const lockWorktree = useLockWorktree(repoId);
  const exec = useExec(repoId);
  const openRepo = useOpenRepo();

  const run = useCallback(
    function runMutation<TVariables>(
      mutation: UseMutationResult<OperationResult, Error, TVariables>,
      variables: TVariables,
      successTitle: string,
      description?: string,
    ): void {
      mutation.mutate(variables, {
        onSuccess: () => toast.success(successTitle, description),
        onError: (error) => toast.error(t('toast.failed', 'Operation failed'), errorMessage(error)),
      });
    },
    [toast, t],
  );

  const copy = useCallback(
    (value: string, label?: string) => {
      void copyText(value).then((ok) => {
        if (ok) toast.success(t('common.copied', 'Copied'), label ?? value);
        else toast.error(t('toast.failed', 'Operation failed'), value);
      });
    },
    [toast, t],
  );

  const fetchRemote = useCallback(
    (remote?: string, prune?: boolean) => {
      run(
        fetchMutation,
        { remote, prune },
        prune ? t('menu.pruneRemote', 'Prune remote') : t('toast.fetched', 'Fetch completed'),
        remote,
      );
    },
    [run, fetchMutation, t],
  );

  const pushTag = useCallback(
    (tag: string) => {
      const remoteName = remotes.data?.remotes[0]?.name ?? 'origin';
      exec.mutate(
        { args: ['push', remoteName, `refs/tags/${tag}`] },
        {
          onSuccess: () => toast.success(t('toast.pushed', 'Push completed'), tag),
          onError: (error) => toast.error(t('toast.failed', 'Operation failed'), errorMessage(error)),
        },
      );
    },
    [exec, remotes.data, toast, t],
  );

  const openWorktree = useCallback(
    (path: string) => {
      const existing = repos.data?.repos.find((repo) => samePath(repo.path, path));
      if (existing) {
        setActiveRepo(existing.id);
        return;
      }
      openRepo.mutate(
        { path },
        {
          onSuccess: (result) => {
            setActiveRepo(result.repo.id);
            toast.success(t('repo.openButton', 'Open repository'), result.repo.name);
          },
          onError: (error) => toast.error(t('toast.failed', 'Operation failed'), errorMessage(error)),
        },
      );
    },
    [repos.data, openRepo, setActiveRepo, toast, t],
  );

  return {
    copy,
    fetchRemote,
    pushTag,
    stashApply: (index) => run(applyStash, { index }, t('toast.stashApplied', 'Stash applied')),
    stashPop: (index) => run(popStash, { index }, t('toast.stashPopped', 'Stash popped')),
    stashDrop: (index) => run(dropStash, { index }, t('toast.stashDropped', 'Stash dropped')),
    lockWorktree: (path) => run(lockWorktree, { path, lock: true }, t('menu.lockWorktree', 'Lock worktree')),
    unlockWorktree: (path) =>
      run(lockWorktree, { path, lock: false }, t('menu.unlockWorktree', 'Unlock worktree')),
    openWorktree,
    setBranchUpstream: (branch, remote, remoteBranch) =>
      run(
        upstreamMutation,
        { branch, remote, remoteBranch },
        t('toast.upstreamSet', 'Upstream branch set'),
        `${branch} → ${remote}/${remoteBranch}`,
      ),
    unsetBranchUpstream: (branch) =>
      run(
        upstreamMutation,
        { branch, remote: null, remoteBranch: null },
        t('toast.upstreamUnset', 'Upstream branch unset'),
        branch,
      ),
  };
}

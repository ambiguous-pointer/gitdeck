/**
 * Central React Query hooks. Every feature component must use these instead of
 * calling `fetch` directly, so caching, polling and invalidation stay coherent.
 */
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query';
import {
  apiRoutes,
  type AppSettings,
  type Branch,
  type CommitDetail,
  type CommitLog,
  type ConfigEntry,
  type DiffQuery,
  type FileDiff,
  type HomeInfo,
  type LogParams,
  type OpenRepoInput,
  type OpenRepoResult,
  type OperationResult,
  type Remote,
  type RepoRecord,
  type RepoStatus,
  type RepoSummary,
  type ScanInput,
  type ScanResult,
  type SettingsPatchInput,
  type Stash,
  type Tag,
  type Worktree,
} from '@gitdeck/shared';
import { api, errorMessage } from './client';
import { qk } from './query-keys';
import { useAppStore } from '@/stores/app-store';

/* ------------------------------------------------------------------ */
/* Queries                                                             */
/* ------------------------------------------------------------------ */

export function useHomeQuery() {
  return useQuery({
    queryKey: qk.home,
    queryFn: () => api.get<HomeInfo>(apiRoutes.home()),
    staleTime: 60_000,
  });
}

export function useReposQuery() {
  return useQuery({
    queryKey: qk.repos,
    queryFn: () => api.get<{ repos: RepoRecord[] }>(apiRoutes.repos()),
    staleTime: 30_000,
  });
}

export function useRepoSummary(repoId: string | null) {
  return useQuery({
    queryKey: qk.summary(repoId ?? ''),
    queryFn: () => api.get<RepoSummary>(apiRoutes.repoSummary(repoId!)),
    enabled: Boolean(repoId),
    refetchInterval: 8_000,
    placeholderData: keepPreviousData,
  });
}

export function useRepoStatus(repoId: string | null, enabled = true) {
  return useQuery({
    queryKey: qk.status(repoId ?? ''),
    queryFn: () => api.get<RepoStatus>(apiRoutes.repoStatus(repoId!)),
    enabled: Boolean(repoId) && enabled,
    refetchInterval: 4_000,
    placeholderData: keepPreviousData,
  });
}

export function useRepoLog(repoId: string | null, params: LogParams = {}, enabled = true) {
  return useQuery({
    queryKey: qk.log(repoId ?? '', params),
    queryFn: () => api.get<CommitLog>(apiRoutes.repoLog(repoId!, params)),
    enabled: Boolean(repoId) && enabled,
    refetchInterval: 15_000,
    placeholderData: keepPreviousData,
  });
}

export function useBranches(repoId: string | null) {
  return useQuery({
    queryKey: qk.branches(repoId ?? ''),
    queryFn: () => api.get<{ branches: Branch[] }>(apiRoutes.repoBranches(repoId!)),
    enabled: Boolean(repoId),
    refetchInterval: 15_000,
    placeholderData: keepPreviousData,
  });
}

export function useRemotes(repoId: string | null) {
  return useQuery({
    queryKey: qk.remotes(repoId ?? ''),
    queryFn: () => api.get<{ remotes: Remote[] }>(apiRoutes.repoRemotes(repoId!)),
    enabled: Boolean(repoId),
    refetchInterval: 30_000,
    placeholderData: keepPreviousData,
  });
}

export function useTags(repoId: string | null) {
  return useQuery({
    queryKey: qk.tags(repoId ?? ''),
    queryFn: () => api.get<{ tags: Tag[] }>(apiRoutes.repoTags(repoId!)),
    enabled: Boolean(repoId),
    refetchInterval: 30_000,
    placeholderData: keepPreviousData,
  });
}

export function useStashes(repoId: string | null) {
  return useQuery({
    queryKey: qk.stashes(repoId ?? ''),
    queryFn: () => api.get<{ stashes: Stash[] }>(apiRoutes.repoStashes(repoId!)),
    enabled: Boolean(repoId),
    refetchInterval: 20_000,
    placeholderData: keepPreviousData,
  });
}

export function useWorktrees(repoId: string | null) {
  return useQuery({
    queryKey: qk.worktrees(repoId ?? ''),
    queryFn: () => api.get<{ worktrees: Worktree[] }>(apiRoutes.repoWorktrees(repoId!)),
    enabled: Boolean(repoId),
    refetchInterval: 20_000,
    placeholderData: keepPreviousData,
  });
}

export function useConfig(repoId: string | null, scope: 'all' | 'local' | 'global' = 'all') {
  return useQuery({
    queryKey: qk.config(repoId ?? '', scope),
    queryFn: () => api.get<{ entries: ConfigEntry[] }>(apiRoutes.repoConfig(repoId!, scope)),
    enabled: Boolean(repoId),
    placeholderData: keepPreviousData,
  });
}

export function useCommitDetail(repoId: string | null, hash: string | null) {
  return useQuery({
    queryKey: qk.commit(repoId ?? '', hash ?? ''),
    queryFn: () => api.get<CommitDetail>(apiRoutes.repoCommit(repoId!, hash!)),
    enabled: Boolean(repoId) && Boolean(hash),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
}

/** Diff for a commit, a range or the working tree / index. */
export function useDiff(repoId: string | null, query: DiffQuery | null) {
  return useQuery({
    queryKey: qk.diff(repoId ?? '', query ?? { scope: 'worktree' }),
    queryFn: () => api.get<{ files: FileDiff[] }>(apiRoutes.repoDiff(repoId!, query!)),
    enabled: Boolean(repoId) && Boolean(query),
    placeholderData: keepPreviousData,
  });
}

export function useStashShow(repoId: string | null, index: number | null) {
  return useQuery({
    queryKey: qk.stashShow(repoId ?? '', index ?? -1),
    queryFn: () => api.get<{ result: OperationResult['result']; diff: FileDiff[] }>(apiRoutes.stashShow(repoId!, index!)),
    enabled: Boolean(repoId) && index !== null,
  });
}

export function useServerSettings() {
  return useQuery({
    queryKey: qk.settings,
    queryFn: () => api.get<AppSettings>(apiRoutes.settings()),
    staleTime: 60_000,
  });
}

/* ------------------------------------------------------------------ */
/* Generic command mutations                                           */
/* ------------------------------------------------------------------ */

function useRepoAction<TResult extends OperationResult = OperationResult, TInput = unknown>(
  repoId: string | null,
  route: (id: string) => string,
): UseMutationResult<TResult, Error, TInput> {
  const queryClient = useQueryClient();
  const logCommand = useAppStore((state) => state.logCommand);

  return useMutation<TResult, Error, TInput>({
    mutationFn: (input) => api.post<TResult>(route(repoId!), (input ?? {}) as object),
    onSuccess: (data) => {
      if (data?.result) {
        logCommand({
          id: crypto.randomUUID(),
          repoId: repoId ?? undefined,
          command: data.result.command,
          output: [data.result.stdout, data.result.stderr].filter(Boolean).join('\n').trim(),
          ok: data.result.ok,
          exitCode: data.result.exitCode,
          durationMs: data.result.durationMs,
          timestamp: Date.now(),
        });
      }
      if (repoId) void queryClient.invalidateQueries({ queryKey: qk.repoAll(repoId) });
    },
    onError: (error) => {
      logCommand({
        id: crypto.randomUUID(),
        repoId: repoId ?? undefined,
        command: route(repoId!).replace('/api/repos/', ''),
        output: errorMessage(error),
        ok: false,
        exitCode: -1,
        durationMs: 0,
        timestamp: Date.now(),
      });
    },
  });
}

/* ------------------------------------------------------------------ */
/* Repository lifecycle                                                */
/* ------------------------------------------------------------------ */

export function useOpenRepo() {
  const queryClient = useQueryClient();
  return useMutation<OpenRepoResult, Error, OpenRepoInput>({
    mutationFn: (input) => api.post<OpenRepoResult>(apiRoutes.reposOpen(), input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.home });
      void queryClient.invalidateQueries({ queryKey: qk.repos });
    },
  });
}

export function useCloseRepo() {
  const queryClient = useQueryClient();
  return useMutation<{ ok: boolean }, Error, string>({
    mutationFn: (repoId) => api.delete<{ ok: boolean }>(apiRoutes.repo(repoId)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.home });
      void queryClient.invalidateQueries({ queryKey: qk.repos });
    },
  });
}

export function useScanRepos() {
  return useMutation<ScanResult, Error, ScanInput>({
    mutationFn: (input) => api.post<ScanResult>(apiRoutes.reposScan(), input ?? {}),
  });
}

/* ------------------------------------------------------------------ */
/* Staging / commit                                                    */
/* ------------------------------------------------------------------ */

export const useStage = (repoId: string | null) => useRepoAction(repoId, apiRoutes.stage);
export const useUnstage = (repoId: string | null) => useRepoAction(repoId, apiRoutes.unstage);
export const useDiscard = (repoId: string | null) => useRepoAction(repoId, apiRoutes.discard);
export const useCommit = (repoId: string | null) => useRepoAction(repoId, apiRoutes.commit);
export const useResolveConflicts = (repoId: string | null) => useRepoAction(repoId, apiRoutes.resolve);

/* ------------------------------------------------------------------ */
/* Branches and history operations                                     */
/* ------------------------------------------------------------------ */

export const useCheckout = (repoId: string | null) => useRepoAction(repoId, apiRoutes.checkout);
export const useCreateBranch = (repoId: string | null) => useRepoAction(repoId, apiRoutes.branchCreate);
export const useRenameBranch = (repoId: string | null) => useRepoAction(repoId, apiRoutes.branchRename);
export const useDeleteBranch = (repoId: string | null) => useRepoAction(repoId, apiRoutes.branchDelete);
export const useMerge = (repoId: string | null) => useRepoAction(repoId, apiRoutes.merge);
export const useRebase = (repoId: string | null) => useRepoAction(repoId, apiRoutes.rebase);
export const useCherryPick = (repoId: string | null) => useRepoAction(repoId, apiRoutes.cherryPick);
export const useRevert = (repoId: string | null) => useRepoAction(repoId, apiRoutes.revert);
export const useReset = (repoId: string | null) => useRepoAction(repoId, apiRoutes.reset);
export const useSetUpstream = (repoId: string | null) => useRepoAction(repoId, apiRoutes.upstream);

/* ------------------------------------------------------------------ */
/* Remotes and sync                                                    */
/* ------------------------------------------------------------------ */

export const useFetch = (repoId: string | null) => useRepoAction(repoId, apiRoutes.fetch);
export const usePull = (repoId: string | null) => useRepoAction(repoId, apiRoutes.pull);
export const usePush = (repoId: string | null) => useRepoAction(repoId, apiRoutes.push);

export const useAddRemote = (repoId: string | null) => useRepoAction(repoId, apiRoutes.remoteAdd);
export const useUpdateRemote = (repoId: string | null) => useRepoAction(repoId, apiRoutes.remoteUpdate);
export const useRemoveRemote = (repoId: string | null) => useRepoAction(repoId, apiRoutes.remoteRemove);

/* ------------------------------------------------------------------ */
/* Tags, stashes, worktrees                                            */
/* ------------------------------------------------------------------ */

export const useCreateTag = (repoId: string | null) => useRepoAction(repoId, apiRoutes.tagCreate);
export const useDeleteTag = (repoId: string | null) => useRepoAction(repoId, apiRoutes.tagDelete);

export const useCreateStash = (repoId: string | null) => useRepoAction(repoId, apiRoutes.stashCreate);
export const useApplyStash = (repoId: string | null) => useRepoAction(repoId, apiRoutes.stashApply);
export const usePopStash = (repoId: string | null) => useRepoAction(repoId, apiRoutes.stashPop);
export const useDropStash = (repoId: string | null) => useRepoAction(repoId, apiRoutes.stashDrop);

export const useAddWorktree = (repoId: string | null) => useRepoAction(repoId, apiRoutes.worktreeAdd);
export const useRemoveWorktree = (repoId: string | null) => useRepoAction(repoId, apiRoutes.worktreeRemove);
export const usePruneWorktrees = (repoId: string | null) => useRepoAction(repoId, apiRoutes.worktreePrune);
export const useLockWorktree = (repoId: string | null) => useRepoAction(repoId, apiRoutes.worktreeLock);

/* ------------------------------------------------------------------ */
/* Config / settings / raw command                                     */
/* ------------------------------------------------------------------ */

export const useConfigSet = (repoId: string | null) => useRepoAction(repoId, apiRoutes.configSet);
export const useConfigUnset = (repoId: string | null) => useRepoAction(repoId, apiRoutes.configUnset);

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation<AppSettings, Error, SettingsPatchInput>({
    mutationFn: (patch) => api.patch<AppSettings>(apiRoutes.settings(), patch),
    onSuccess: (settings) => {
      queryClient.setQueryData(qk.settings, settings);
      void queryClient.invalidateQueries({ queryKey: qk.home });
    },
  });
}

export function useExec(repoId: string | null) {
  const queryClient = useQueryClient();
  const logCommand = useAppStore((state) => state.logCommand);
  return useMutation<OperationResult, Error, { args: string[] }>({
    mutationFn: (input) => api.post<OperationResult>(apiRoutes.exec(repoId!), input),
    onSuccess: (data) => {
      logCommand({
        id: crypto.randomUUID(),
        repoId: repoId ?? undefined,
        command: data.result.command,
        output: [data.result.stdout, data.result.stderr].filter(Boolean).join('\n').trim(),
        ok: data.result.ok,
        exitCode: data.result.exitCode,
        durationMs: data.result.durationMs,
        timestamp: Date.now(),
      });
      if (repoId) void queryClient.invalidateQueries({ queryKey: qk.repoAll(repoId) });
    },
  });
}

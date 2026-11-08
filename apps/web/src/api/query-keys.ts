import type { DiffQuery, LogParams } from '@gitdeck/shared';

/**
 * Central React Query key factory. Invalidate `qk.repoAll(id)` after any
 * mutating Git operation to refresh history, status, branches and refs.
 */
export const qk = {
  home: ['home'] as const,
  settings: ['settings'] as const,
  repos: ['repos'] as const,
  repoAll: (repoId: string) => ['repo', repoId] as const,
  summary: (repoId: string) => ['repo', repoId, 'summary'] as const,
  status: (repoId: string) => ['repo', repoId, 'status'] as const,
  log: (repoId: string, params: LogParams) => ['repo', repoId, 'log', params] as const,
  branches: (repoId: string) => ['repo', repoId, 'branches'] as const,
  remotes: (repoId: string) => ['repo', repoId, 'remotes'] as const,
  tags: (repoId: string) => ['repo', repoId, 'tags'] as const,
  stashes: (repoId: string) => ['repo', repoId, 'stashes'] as const,
  worktrees: (repoId: string) => ['repo', repoId, 'worktrees'] as const,
  config: (repoId: string, scope: string) => ['repo', repoId, 'config', scope] as const,
  commit: (repoId: string, hash: string) => ['repo', repoId, 'commit', hash] as const,
  diff: (repoId: string, query: DiffQuery) => ['repo', repoId, 'diff', query] as const,
  stashShow: (repoId: string, index: number) => ['repo', repoId, 'stashShow', index] as const,
  reflog: (repoId: string) => ['repo', repoId, 'reflog'] as const,
};

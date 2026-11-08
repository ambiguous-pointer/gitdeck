/**
 * API route builders shared by the server (route registration) and the web app
 * (fetch client). Every endpoint lives under `/api` and speaks JSON.
 */
import type { DiffQuery } from './types.js';

const enc = (value: string): string => encodeURIComponent(value);

function qs(params: object): string {
  const parts: string[] = [];
  for (const [key, raw] of Object.entries(params as Record<string, unknown>)) {
    if (raw === undefined || raw === null || raw === '') continue;
    if (typeof raw !== 'string' && typeof raw !== 'number' && typeof raw !== 'boolean') continue;
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(raw))}`);
  }
  return parts.length > 0 ? `?${parts.join('&')}` : '';
}

export interface LogParams {
  limit?: number;
  skip?: number;
  all?: boolean;
  branch?: string;
  path?: string;
  search?: string;
}

export const apiRoutes = {
  health: () => '/api/health',
  home: () => '/api/home',
  settings: () => '/api/settings',

  repos: () => '/api/repos',
  reposOpen: () => '/api/repos/open',
  reposScan: () => '/api/repos/scan',
  repo: (id: string) => `/api/repos/${enc(id)}`,
  repoSummary: (id: string) => `/api/repos/${enc(id)}/summary`,
  repoStatus: (id: string) => `/api/repos/${enc(id)}/status`,
  repoLog: (id: string, params: LogParams = {}) => `/api/repos/${enc(id)}/log${qs(params)}`,
  repoReflog: (id: string, limit?: number) => `/api/repos/${enc(id)}/reflog${qs({ limit })}`,
  repoCommit: (id: string, hash: string) => `/api/repos/${enc(id)}/commits/${enc(hash)}`,
  repoCommitDiff: (id: string, hash: string, path?: string) =>
    `/api/repos/${enc(id)}/commits/${enc(hash)}/diff${qs({ path })}`,
  repoDiff: (id: string, query: DiffQuery) => `/api/repos/${enc(id)}/diff${qs({ ...query })}`,
  repoBranches: (id: string) => `/api/repos/${enc(id)}/branches`,
  repoRemotes: (id: string) => `/api/repos/${enc(id)}/remotes`,
  repoTags: (id: string) => `/api/repos/${enc(id)}/tags`,
  repoStashes: (id: string) => `/api/repos/${enc(id)}/stashes`,
  repoWorktrees: (id: string) => `/api/repos/${enc(id)}/worktrees`,
  repoConfig: (id: string, scope: string = 'all') => `/api/repos/${enc(id)}/config${qs({ scope })}`,

  stage: (id: string) => `/api/repos/${enc(id)}/stage`,
  unstage: (id: string) => `/api/repos/${enc(id)}/unstage`,
  discard: (id: string) => `/api/repos/${enc(id)}/discard`,
  commit: (id: string) => `/api/repos/${enc(id)}/commit`,
  resolve: (id: string) => `/api/repos/${enc(id)}/resolve`,

  checkout: (id: string) => `/api/repos/${enc(id)}/branch/checkout`,
  branchCreate: (id: string) => `/api/repos/${enc(id)}/branch/create`,
  branchRename: (id: string) => `/api/repos/${enc(id)}/branch/rename`,
  branchDelete: (id: string) => `/api/repos/${enc(id)}/branch/delete`,
  merge: (id: string) => `/api/repos/${enc(id)}/branch/merge`,
  rebase: (id: string) => `/api/repos/${enc(id)}/branch/rebase`,
  cherryPick: (id: string) => `/api/repos/${enc(id)}/branch/cherry-pick`,
  revert: (id: string) => `/api/repos/${enc(id)}/branch/revert`,
  reset: (id: string) => `/api/repos/${enc(id)}/branch/reset`,
  upstream: (id: string) => `/api/repos/${enc(id)}/branch/upstream`,

  fetch: (id: string) => `/api/repos/${enc(id)}/fetch`,
  pull: (id: string) => `/api/repos/${enc(id)}/pull`,
  push: (id: string) => `/api/repos/${enc(id)}/push`,

  remoteAdd: (id: string) => `/api/repos/${enc(id)}/remotes/add`,
  remoteUpdate: (id: string) => `/api/repos/${enc(id)}/remotes/update`,
  remoteRemove: (id: string) => `/api/repos/${enc(id)}/remotes/remove`,

  tagCreate: (id: string) => `/api/repos/${enc(id)}/tags`,
  tagDelete: (id: string) => `/api/repos/${enc(id)}/tags/delete`,

  stashCreate: (id: string) => `/api/repos/${enc(id)}/stashes`,
  stashApply: (id: string) => `/api/repos/${enc(id)}/stashes/apply`,
  stashPop: (id: string) => `/api/repos/${enc(id)}/stashes/pop`,
  stashDrop: (id: string) => `/api/repos/${enc(id)}/stashes/drop`,
  stashShow: (id: string, index: number) => `/api/repos/${enc(id)}/stashes/${index}/show`,

  worktreeAdd: (id: string) => `/api/repos/${enc(id)}/worktrees/add`,
  worktreeRemove: (id: string) => `/api/repos/${enc(id)}/worktrees/remove`,
  worktreePrune: (id: string) => `/api/repos/${enc(id)}/worktrees/prune`,
  worktreeLock: (id: string) => `/api/repos/${enc(id)}/worktrees/lock`,

  configSet: (id: string) => `/api/repos/${enc(id)}/config/set`,
  configUnset: (id: string) => `/api/repos/${enc(id)}/config/unset`,
  exec: (id: string) => `/api/repos/${enc(id)}/exec`,
} as const;

/** Endpoints that are allowed through the `exec` escape hatch. */
export const EXEC_ALLOWED_SUBCOMMANDS = [
  'status',
  'log',
  'show',
  'diff',
  'rev-parse',
  'ls-files',
  'for-each-ref',
  'cat-file',
  'reflog',
  'blame',
  'describe',
  'remote',
  'config',
  'tag',
  'branch',
  'worktree',
  'stash',
  'fetch',
  'pull',
  'push',
  'merge',
  'rebase',
  'cherry-pick',
  'revert',
  'reset',
  'restore',
  'add',
  'rm',
  'mv',
  'commit',
  'switch',
  'checkout',
  'submodule',
] as const;

export const WEB_DEV_PORTS = {
  server: 4319,
  web: 5188,
} as const;

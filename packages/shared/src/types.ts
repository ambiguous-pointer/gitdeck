/**
 * GitDeck shared domain model.
 *
 * This file is the single source of truth for the REST API contract between
 * `@gitdeck/server` and `@gitdeck/web`. Keep it stable: both applications are
 * developed against these types in parallel branches.
 */

export type Locale = 'zh' | 'en';
export type ThemeMode = 'dark' | 'light' | 'system';
export type GitScope = 'local' | 'global' | 'system';

/* ------------------------------------------------------------------ */
/* Git primitives                                                      */
/* ------------------------------------------------------------------ */

export interface GitAuthor {
  name: string;
  email: string;
  /** ISO-8601 date string (author date). */
  date: string;
}

export type RefType = 'branch' | 'remote' | 'tag' | 'head' | 'stash';

export interface GitRef {
  type: RefType;
  /** Full ref name, e.g. `refs/heads/main` or `refs/remotes/origin/main`. */
  refName: string;
  /** Human friendly name, e.g. `main`, `origin/main`. */
  name: string;
  /** Short label rendered in the commit graph (e.g. `main`, `origin/main`, `v1.2.0`). */
  label: string;
  current?: boolean;
}

export interface Commit {
  hash: string;
  shortHash: string;
  parents: string[];
  subject: string;
  body: string;
  author: GitAuthor;
  committer: GitAuthor;
  refs: GitRef[];
}

export type FileStatus =
  | 'added'
  | 'modified'
  | 'deleted'
  | 'renamed'
  | 'copied'
  | 'untracked'
  | 'conflicted'
  | 'typechange'
  | 'ignored';

export type ConflictSide =
  | 'both-modified'
  | 'added-by-us'
  | 'added-by-them'
  | 'both-added'
  | 'deleted-by-us'
  | 'deleted-by-them'
  | 'both-deleted';

export interface FileChange {
  path: string;
  oldPath?: string;
  status: FileStatus;
  /** Lines added (when known, e.g. commit or numstat context). */
  insertions?: number;
  /** Lines removed (when known). */
  deletions?: number;
  binary?: boolean;
  /** Conflict detail for unmerged files. */
  conflictType?: ConflictSide;
}

export interface DiffStats {
  filesChanged: number;
  insertions: number;
  deletions: number;
}

export interface DiffLine {
  type: 'context' | 'add' | 'del' | 'hunk';
  content: string;
  oldLine?: number;
  newLine?: number;
}

export interface DiffHunk {
  header: string;
  lines: DiffLine[];
}

export interface FileDiff {
  path: string;
  oldPath?: string;
  status: FileStatus;
  binary: boolean;
  hunks: DiffHunk[];
  /** Original text for image diffs (data URL) when applicable. */
  imageBefore?: string;
  imageAfter?: string;
}

export interface CommitDetail {
  commit: Commit;
  stats: DiffStats;
  files: FileChange[];
}

/* ------------------------------------------------------------------ */
/* Repository state                                                    */
/* ------------------------------------------------------------------ */

export interface Branch {
  name: string;
  isRemote: boolean;
  /** Remote name for remote-tracking branches. */
  remote?: string;
  current: boolean;
  ahead: number;
  behind: number;
  upstream?: string;
  tipHash: string;
  tipShortHash: string;
  tipSubject: string;
  tipAuthor: string;
  tipDate: string;
}

export interface Remote {
  name: string;
  fetchUrl: string;
  pushUrl: string;
}

export interface Tag {
  name: string;
  hash: string;
  shortHash: string;
  annotated: boolean;
  subject: string;
  tagger?: string;
  date?: string;
}

export interface Stash {
  index: number;
  hash: string;
  shortHash: string;
  name: string;
  message: string;
  date: string;
  branch?: string;
}

export interface Worktree {
  /** Absolute path of the worktree checkout. */
  path: string;
  /** Worktree display name (directory basename). */
  name: string;
  head?: string;
  branch?: string;
  bare: boolean;
  detached: boolean;
  isMain: boolean;
  locked?: string;
  prunable?: string;
}

export interface RepoRecord {
  id: string;
  name: string;
  path: string;
  openedAt: string;
}

export type RepoOperationKind = 'merging' | 'rebasing' | 'cherry-picking' | 'reverting' | 'bisecting';

export interface RepoOperation {
  state: RepoOperationKind;
  /** Branch being rebased/merged when known. */
  details?: string;
  /** Files with merge conflicts (also present in status.conflicted). */
  conflictCount?: number;
}

export interface StatusCounts {
  staged: number;
  unstaged: number;
  untracked: number;
  conflicted: number;
}

export interface RepoSummary {
  id: string;
  name: string;
  path: string;
  gitDir: string;
  commonDir: string;
  bare: boolean;
  isWorktree: boolean;
  branch: string;
  detached: boolean;
  unborn: boolean;
  upstream?: string;
  ahead: number;
  behind: number;
  defaultBranch?: string;
  remotes: Remote[];
  statusCounts: StatusCounts;
  operation?: RepoOperation;
  worktreeCount: number;
  stashCount: number;
  lastCommit?: {
    hash: string;
    shortHash: string;
    subject: string;
    author: string;
    date: string;
  };
}

export interface RepoStatus {
  branch: string;
  detached: boolean;
  unborn: boolean;
  upstream?: string;
  ahead: number;
  behind: number;
  staged: FileChange[];
  unstaged: FileChange[];
  untracked: FileChange[];
  conflicted: FileChange[];
  counts: StatusCounts;
  operation?: RepoOperation;
  stashCount: number;
  clean: boolean;
}

/* ------------------------------------------------------------------ */
/* Commands / operations                                               */
/* ------------------------------------------------------------------ */

export interface CommandResult {
  /** Human readable command line, shell-safe quoted. */
  command: string;
  cwd: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  ok: boolean;
}

export interface OperationResult {
  result: CommandResult;
  summary?: RepoSummary;
}

export interface CommitLog {
  commits: Commit[];
  head?: string;
  hasMore: boolean;
}

export interface ConfigEntry {
  key: string;
  value: string;
  scope: GitScope;
}

export interface UserIdentity {
  name?: string;
  email?: string;
}

/* ------------------------------------------------------------------ */
/* Application level                                                   */
/* ------------------------------------------------------------------ */

export interface AppSettings {
  /** Absolute directories that are scanned for git repositories and worktrees. */
  scanRoots: string[];
  gitPath: string;
  maxScanDepth: number;
  commandTimeoutMs: number;
  locale: Locale;
  theme: ThemeMode;
  accent: string;
  confirmDangerous: boolean;
}

export interface GitVersionInfo {
  appVersion: string;
  gitVersion: string;
  nodeVersion: string;
  platform: string;
  home: string;
  dataDir: string;
}

export interface HomeInfo {
  app: GitVersionInfo;
  settings: AppSettings;
  repos: RepoRecord[];
}

export type ScannedRepoKind = 'repository' | 'worktree';

export interface ScannedRepo {
  path: string;
  name: string;
  kind: ScannedRepoKind;
  branch?: string;
  head?: string;
  lastCommitDate?: string;
  /** For worktrees: path of the main worktree. */
  mainWorktreePath?: string;
}

export interface ScanResult {
  roots: string[];
  found: ScannedRepo[];
  skipped: string[];
  durationMs: number;
}

export interface OpenRepoResult {
  repo: RepoRecord;
  summary: RepoSummary;
}

export interface DiffQuery {
  scope: 'worktree' | 'staged' | 'commit' | 'range';
  path?: string;
  /** Commit hash for scope=commit, or left side for scope=range. */
  from?: string;
  /** Right side for scope=range. */
  to?: string;
  context?: number;
}

/* ------------------------------------------------------------------ */
/* Commit graph layout                                                 */
/* ------------------------------------------------------------------ */

export interface GraphInputCommit {
  hash: string;
  parents: string[];
}

export interface GraphRow {
  hash: string;
  /** Column of the commit node. */
  lane: number;
  /** Palette index used to color the node and its lane. */
  color: number;
  /** Lanes entering this row from above. */
  incoming: { lane: number; color: number; fromTop: boolean }[];
  /** Lanes that also expected this commit and converge into the node. */
  converge: { fromLane: number; color: number }[];
  /** Lanes leaving this row towards the next row. */
  outgoing: { lane: number; color: number }[];
  /** Curved links from the node to extra parents (merge commits). */
  mergeOut: { fromLane: number; toLane: number; color: number }[];
}

export interface GraphLayout {
  rows: GraphRow[];
  laneCount: number;
}

/* ------------------------------------------------------------------ */
/* Errors                                                              */
/* ------------------------------------------------------------------ */

export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'GIT_ERROR'
  | 'CONFLICT'
  | 'UNSAFE_PATH'
  | 'NOT_A_REPO'
  | 'TIMEOUT'
  | 'INTERNAL';

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: unknown;
  };
}

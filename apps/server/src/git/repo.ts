/**
 * Repository read model: resolves repository metadata and implements every
 * read-only operation exposed by the API (summary, status, log, commits, diffs,
 * branches, remotes, tags, stashes, worktrees, config, reflog).
 */
import fs from 'node:fs';
import path from 'node:path';
import type {
  Branch,
  CommandResult,
  Commit,
  CommitDetail,
  CommitLog,
  ConfigEntry,
  DiffQuery,
  FileDiff,
  GitRef,
  GitScope,
  LogQueryInput,
  OpenRepoResult,
  Remote,
  RepoOperation,
  RepoRecord,
  RepoStatus,
  RepoSummary,
  Stash,
  Tag,
  Worktree,
} from '@gitdeck/shared';
import { ApiError } from '../app';
import type { ServerContext } from '../context';
import {
  bufferToDataUrl,
  clampDiffContext,
  imageMimeForPath,
  limitDiffPayload,
  parseUnifiedDiff,
} from './diff';
import {
  BRANCH_FORMAT,
  COMMIT_PRETTY_FORMAT,
  REFLOG_PRETTY_FORMAT,
  STASH_FORMAT,
  TAG_FORMAT,
  attachRefs,
  diffStats,
  mergeFileStats,
  parseBranches,
  parseCommitRecords,
  parseConfigList,
  parseDefaultBranch,
  parseLog,
  parseNameStatus,
  parseNumstat,
  parseRefList,
  parseReflog,
  parseRemotes,
  parseStashes,
  parseStatus,
  parseTags,
  parseWorktrees,
} from './parsers';
import { canonicalPath, repoIdForPath, sameRepoPath } from '../store/registry';
import { commandDetails, runGit, runGitBuffer, stderrMessage, type GitOutcome } from './runner';

const REF_LIST_FORMAT = '%(objectname)%00%(refname)%00%(HEAD)';
const MAX_BLOB_BYTES = 6 * 1024 * 1024;

export interface RepoMeta {
  id: string;
  record?: RepoRecord;
  /** Worktree root (or bare repository directory). */
  root: string;
  /** Absolute `.git` directory of this worktree. */
  gitDir: string;
  /** Shared `.git` directory (equals `gitDir` for normal repositories). */
  commonDir: string;
  bare: boolean;
  isWorktree: boolean;
  name: string;
}

/* ------------------------------------------------------------------ */
/* Errors + command helpers                                            */
/* ------------------------------------------------------------------ */

function statusForCode(code: string): number {
  switch (code) {
    case 'VALIDATION_ERROR':
    case 'GIT_ERROR':
    case 'UNSAFE_PATH':
    case 'NOT_A_REPO':
      return 400;
    case 'NOT_FOUND':
      return 404;
    case 'CONFLICT':
      return 409;
    case 'TIMEOUT':
      return 504;
    default:
      return 500;
  }
}

/** Throw the standard API error envelope for a failed git command. */
export function failFromGit(
  outcome: GitOutcome,
  action: string,
  code: 'GIT_ERROR' | 'CONFLICT' | 'TIMEOUT' = 'GIT_ERROR',
  extra?: Record<string, unknown>,
): never {
  const effectiveCode = outcome.timedOut ? 'TIMEOUT' : code;
  const message = outcome.timedOut
    ? `${action} timed out after ${outcome.result.durationMs} ms`
    : stderrMessage(outcome, `${action} failed (exit code ${outcome.result.exitCode})`);
  throw new ApiError(statusForCode(effectiveCode), effectiveCode, message, commandDetails(outcome, extra));
}

export function assertSafeRevision(value: string, label = 'revision'): void {
  if (!value || value.startsWith('-') || /[\0\r\n]/.test(value)) {
    throw new ApiError(400, 'VALIDATION_ERROR', `Invalid ${label}: ${JSON.stringify(value)}`);
  }
}

export async function gitRun(
  ctx: ServerContext,
  cwd: string,
  args: string[],
  options?: { timeoutMs?: number; maxBytes?: number },
): Promise<GitOutcome> {
  return runGit({
    gitPath: ctx.gitPath,
    cwd,
    args,
    timeoutMs: options?.timeoutMs ?? ctx.commandTimeoutMs,
    maxBytes: options?.maxBytes ?? ctx.maxOutputBytes,
    env: ctx.gitEnv,
  });
}

/** Run git and throw `GIT_ERROR`/`TIMEOUT` when it fails. */
export async function gitOk(
  ctx: ServerContext,
  cwd: string,
  args: string[],
  action: string,
  options?: { timeoutMs?: number; maxBytes?: number },
): Promise<GitOutcome> {
  const outcome = await gitRun(ctx, cwd, args, options);
  if (outcome.timedOut) failFromGit(outcome, action, 'TIMEOUT');
  if (!outcome.result.ok) failFromGit(outcome, action);
  return outcome;
}

function commandNotOk(outcome: GitOutcome): boolean {
  return outcome.timedOut || !outcome.result.ok;
}

/* ------------------------------------------------------------------ */
/* Metadata                                                            */
/* ------------------------------------------------------------------ */

/** Resolve repository metadata by running `git rev-parse` in `inputPath`. */
export async function resolveRepoMeta(
  ctx: ServerContext,
  inputPath: string,
  record?: RepoRecord,
): Promise<RepoMeta> {
  const absolute = canonicalPath(inputPath);
  let stats: fs.Stats;
  try {
    stats = fs.statSync(absolute);
  } catch {
    throw new ApiError(404, 'NOT_FOUND', `Path does not exist: ${inputPath}`);
  }
  if (!stats.isDirectory()) {
    throw new ApiError(400, 'VALIDATION_ERROR', `Path is not a directory: ${inputPath}`);
  }

  const [gitDirOutcome, commonDirOutcome, bareOutcome, toplevelOutcome] = await Promise.all([
    gitRun(ctx, absolute, ['rev-parse', '--absolute-git-dir']),
    gitRun(ctx, absolute, ['rev-parse', '--git-common-dir']),
    gitRun(ctx, absolute, ['rev-parse', '--is-bare-repository']),
    gitRun(ctx, absolute, ['rev-parse', '--show-toplevel']),
  ]);

  if (commandNotOk(gitDirOutcome)) {
    const message = gitDirOutcome.result.stderr.trim() || 'Not a git repository';
    throw new ApiError(400, 'NOT_A_REPO', message, commandDetails(gitDirOutcome));
  }

  const gitDir = canonicalPath(path.resolve(absolute, gitDirOutcome.result.stdout.trim()));
  const commonCandidate = commonDirOutcome.result.ok ? commonDirOutcome.result.stdout.trim() : '';
  const commonDir = commonCandidate ? canonicalPath(path.resolve(absolute, commonCandidate)) : gitDir;
  const bare = bareOutcome.result.ok && bareOutcome.result.stdout.trim() === 'true';
  const root =
    !bare && toplevelOutcome.result.ok && toplevelOutcome.result.stdout.trim()
      ? canonicalPath(toplevelOutcome.result.stdout.trim())
      : absolute;
  const isWorktree = !bare && !sameRepoPath(gitDir, commonDir);

  return {
    id: record?.id ?? repoIdForPath(root),
    ...(record ? { record } : {}),
    root,
    gitDir,
    commonDir,
    bare,
    isWorktree,
    name: path.basename(root),
  };
}

/** Look up a registered repository (allow-list) and resolve its metadata. */
export async function getRepoMeta(ctx: ServerContext, id: string): Promise<RepoMeta> {
  const record = ctx.registry.get(id);
  if (!record) {
    throw new ApiError(404, 'NOT_FOUND', `Unknown repository id: ${id}`);
  }
  const cached = ctx.metaCache.get(id);
  if (cached && sameRepoPath(cached.root, record.path)) return cached;

  const resolved = await resolveRepoMeta(ctx, record.path, record);
  const meta: RepoMeta = {
    ...resolved,
    id,
    record,
    root: canonicalPath(resolved.root),
    name: path.basename(record.path) || resolved.name,
  };
  ctx.metaCache.set(id, meta);
  return meta;
}

/* ------------------------------------------------------------------ */
/* Operation state                                                     */
/* ------------------------------------------------------------------ */

function readFileIfExists(file: string): string | undefined {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return undefined;
  }
}

function exists(target: string): boolean {
  try {
    return fs.existsSync(target);
  } catch {
    return false;
  }
}

/** Detect in-progress merge/rebase/cherry-pick/revert/bisect from `.git` state. */
export function readOperation(gitDir: string): RepoOperation | undefined {
  const join = (...parts: string[]): string => path.join(gitDir, ...parts);

  if (exists(join('rebase-merge')) || exists(join('rebase-apply'))) {
    const headName =
      readFileIfExists(join('rebase-merge', 'head-name')) ??
      readFileIfExists(join('rebase-apply', 'head-name')) ??
      readFileIfExists(join('rebase-merge', 'onto'));
    const branch = headName?.trim().replace(/^refs\/heads\//, '');
    return { state: 'rebasing', ...(branch ? { details: branch } : {}) };
  }
  if (exists(join('MERGE_HEAD'))) {
    const message = readFileIfExists(join('MERGE_MSG'))?.split(/\r?\n/)[0]?.trim();
    return { state: 'merging', ...(message ? { details: message } : {}) };
  }
  if (exists(join('CHERRY_PICK_HEAD'))) {
    const picked = readFileIfExists(join('CHERRY_PICK_HEAD'))?.trim();
    return { state: 'cherry-picking', ...(picked ? { details: picked } : {}) };
  }
  if (exists(join('REVERT_HEAD'))) {
    const reverted = readFileIfExists(join('REVERT_HEAD'))?.trim();
    return { state: 'reverting', ...(reverted ? { details: reverted } : {}) };
  }
  if (exists(join('BISECT_LOG'))) {
    return { state: 'bisecting' };
  }
  return undefined;
}

/* ------------------------------------------------------------------ */
/* Repository open                                                     */
/* ------------------------------------------------------------------ */

export async function openRepository(ctx: ServerContext, inputPath: string): Promise<OpenRepoResult> {
  if (typeof inputPath !== 'string' || inputPath.trim() === '') {
    throw new ApiError(400, 'VALIDATION_ERROR', 'A repository path is required');
  }
  const meta = await resolveRepoMeta(ctx, path.resolve(inputPath));
  const record = ctx.registry.upsert(meta.root, meta.name);
  const resolved: RepoMeta = { ...meta, id: record.id, record, root: canonicalPath(meta.root) };
  ctx.metaCache.set(record.id, resolved);
  const summary = await computeSummary(ctx, resolved);
  return { repo: record, summary };
}

/* ------------------------------------------------------------------ */
/* Status + summary                                                    */
/* ------------------------------------------------------------------ */

const STATUS_ARGS = ['status', '--porcelain=v2', '--branch', '-z', '--untracked-files=all'];

interface StatusWithOperation {
  snapshot: ReturnType<typeof parseStatus>;
  operation?: RepoOperation;
  stashCount: number;
}

async function readStatus(ctx: ServerContext, meta: RepoMeta): Promise<StatusWithOperation> {
  const [statusOutcome, stashOutcome] = await Promise.all([
    gitRun(ctx, meta.root, STATUS_ARGS),
    gitRun(ctx, meta.root, ['stash', 'list']),
  ]);
  if (commandNotOk(statusOutcome)) failFromGit(statusOutcome, 'git status');
  const snapshot = parseStatus(statusOutcome.result.stdout);
  const stashCount = stashOutcome.result.ok
    ? stashOutcome.result.stdout.split(/\r?\n/).filter((line) => line.trim().length > 0).length
    : 0;
  const operation = readOperation(meta.gitDir);
  if (operation) operation.conflictCount = snapshot.counts.conflicted;
  return { snapshot, ...(operation ? { operation } : {}), stashCount };
}

export async function computeStatus(ctx: ServerContext, meta: RepoMeta): Promise<RepoStatus> {
  const { snapshot, operation, stashCount } = await readStatus(ctx, meta);
  const noChanges =
    snapshot.counts.staged +
      snapshot.counts.unstaged +
      snapshot.counts.untracked +
      snapshot.counts.conflicted ===
    0;
  return {
    branch: snapshot.branch,
    detached: snapshot.detached,
    unborn: snapshot.unborn,
    ...(snapshot.upstream ? { upstream: snapshot.upstream } : {}),
    ahead: snapshot.ahead,
    behind: snapshot.behind,
    staged: snapshot.staged,
    unstaged: snapshot.unstaged,
    untracked: snapshot.untracked,
    conflicted: snapshot.conflicted,
    counts: snapshot.counts,
    ...(operation ? { operation } : {}),
    stashCount,
    clean: noChanges,
  };
}

function firstLine(text: string): string {
  return (
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)[0] ?? ''
  );
}

export async function computeSummary(ctx: ServerContext, meta: RepoMeta): Promise<RepoSummary> {
  const [
    statusOutcome,
    remotesOutcome,
    worktreesOutcome,
    stashOutcome,
    lastCommitOutcome,
    symbolicOutcome,
    initBranchOutcome,
  ] = await Promise.all([
    gitRun(ctx, meta.root, STATUS_ARGS),
    gitRun(ctx, meta.root, ['remote', '-v']),
    gitRun(ctx, meta.root, ['worktree', 'list', '--porcelain']),
    gitRun(ctx, meta.root, ['stash', 'list']),
    gitRun(ctx, meta.root, [
      'log',
      '-1',
      '--date=iso-strict',
      '--pretty=format:%H%x00%h%x00%s%x00%an%x00%aI',
    ]),
    gitRun(ctx, meta.root, ['symbolic-ref', '--short', '-q', 'refs/remotes/origin/HEAD']),
    gitRun(ctx, meta.root, ['config', '--get', 'init.defaultBranch']),
  ]);

  if (commandNotOk(statusOutcome)) failFromGit(statusOutcome, 'git status');
  const snapshot = parseStatus(statusOutcome.result.stdout);
  const operation = readOperation(meta.gitDir);
  if (operation) operation.conflictCount = snapshot.counts.conflicted;

  const remotes = remotesOutcome.result.ok ? parseRemotes(remotesOutcome.result.stdout) : [];
  const worktreeCount = worktreesOutcome.result.ok
    ? parseWorktrees(worktreesOutcome.result.stdout).length
    : 0;
  const stashCount = stashOutcome.result.ok
    ? stashOutcome.result.stdout.split(/\r?\n/).filter((line) => line.trim().length > 0).length
    : 0;

  let lastCommit: RepoSummary['lastCommit'];
  if (lastCommitOutcome.result.ok) {
    const fields = lastCommitOutcome.result.stdout.split('\0');
    if (fields[0]) {
      lastCommit = {
        hash: fields[0],
        shortHash: fields[1] ?? '',
        subject: fields[2] ?? '',
        author: fields[3] ?? '',
        date: fields[4] ?? '',
      };
    }
  }

  let defaultBranch: string | undefined;
  if (symbolicOutcome.result.ok) {
    defaultBranch = parseDefaultBranch(symbolicOutcome.result.stdout);
  }
  if (!defaultBranch && initBranchOutcome.result.ok) {
    const value = initBranchOutcome.result.stdout.trim();
    if (value) defaultBranch = value;
  }

  return {
    id: meta.id,
    name: meta.name,
    path: meta.root,
    gitDir: meta.gitDir,
    commonDir: meta.commonDir,
    bare: meta.bare,
    isWorktree: meta.isWorktree,
    branch: snapshot.branch,
    detached: snapshot.detached,
    unborn: snapshot.unborn,
    ...(snapshot.upstream ? { upstream: snapshot.upstream } : {}),
    ahead: snapshot.ahead,
    behind: snapshot.behind,
    ...(defaultBranch ? { defaultBranch } : {}),
    remotes,
    statusCounts: snapshot.counts,
    ...(operation ? { operation } : {}),
    worktreeCount,
    stashCount,
    ...(lastCommit ? { lastCommit } : {}),
  };
}

/* ------------------------------------------------------------------ */
/* refs                                                                */
/* ------------------------------------------------------------------ */

interface RefData {
  byHash: Map<string, GitRef[]>;
  head?: string;
}

async function readRefData(ctx: ServerContext, meta: RepoMeta): Promise<RefData> {
  const [refsOutcome, headOutcome] = await Promise.all([
    gitRun(ctx, meta.root, [
      'for-each-ref',
      `--format=${REF_LIST_FORMAT}`,
      'refs/heads',
      'refs/remotes',
      'refs/tags',
    ]),
    gitRun(ctx, meta.root, ['rev-parse', '--verify', 'HEAD']),
  ]);
  const byHash = refsOutcome.result.ok
    ? parseRefList(refsOutcome.result.stdout)
    : new Map<string, GitRef[]>();
  const head = headOutcome.result.ok ? headOutcome.result.stdout.trim() : undefined;
  return { byHash, ...(head ? { head } : {}) };
}

function isUnbornError(outcome: GitOutcome): boolean {
  return /does not have any commits yet|your current branch .* does not have any commits|ambiguous argument 'HEAD'|unknown revision/i.test(
    outcome.result.stderr,
  );
}

/* ------------------------------------------------------------------ */
/* Log + reflog                                                        */
/* ------------------------------------------------------------------ */

export async function readLog(ctx: ServerContext, meta: RepoMeta, query: LogQueryInput): Promise<CommitLog> {
  const limit = query.limit ?? 100;
  const skip = query.skip ?? 0;
  const args = [
    'log',
    `--max-count=${limit + 1}`,
    '--date=iso-strict',
    `--pretty=format:${COMMIT_PRETTY_FORMAT}`,
  ];
  if (skip > 0) args.push(`--skip=${skip}`);
  if (query.all) {
    args.push('--all');
  } else if (query.branch) {
    assertSafeRevision(query.branch, 'branch');
    args.push(query.branch);
  }
  if (query.search) {
    args.push('--regexp-ignore-case', '--fixed-strings', `--grep=${query.search}`);
  }
  if (query.path) args.push('--', query.path);

  const [logOutcome, refData] = await Promise.all([gitRun(ctx, meta.root, args), readRefData(ctx, meta)]);
  if (commandNotOk(logOutcome) && !isUnbornError(logOutcome)) {
    failFromGit(logOutcome, 'git log');
  }
  const commits = logOutcome.result.ok ? parseLog(logOutcome.result.stdout) : [];
  const hasMore = commits.length > limit;
  attachRefs(commits, refData.byHash, refData.head);
  return {
    commits: hasMore ? commits.slice(0, limit) : commits,
    ...(refData.head ? { head: refData.head } : {}),
    hasMore,
  };
}

export async function readReflog(
  ctx: ServerContext,
  meta: RepoMeta,
  limit: number,
): Promise<{ result: CommandResult; commits: Commit[] }> {
  const outcome = await gitRun(ctx, meta.root, [
    'reflog',
    `--max-count=${limit}`,
    '--date=iso-strict',
    `--format=${REFLOG_PRETTY_FORMAT}`,
  ]);
  if (commandNotOk(outcome) && !isUnbornError(outcome)) failFromGit(outcome, 'git reflog');
  const commits = outcome.result.ok ? parseReflog(outcome.result.stdout) : [];
  return { result: outcome.result, commits };
}

/* ------------------------------------------------------------------ */
/* Commits + diffs                                                     */
/* ------------------------------------------------------------------ */

async function readCommitsOnly(
  ctx: ServerContext,
  meta: RepoMeta,
  revision: string,
): Promise<{ commit: Commit; outcome: GitOutcome }> {
  assertSafeRevision(revision, 'commit');
  const outcome = await gitRun(ctx, meta.root, [
    'show',
    '-s',
    '--date=iso-strict',
    `--format=${COMMIT_PRETTY_FORMAT}`,
    revision,
  ]);
  if (commandNotOk(outcome)) failFromGit(outcome, 'git show');
  const record = parseCommitRecords(outcome.result.stdout)[0];
  if (!record) {
    throw new ApiError(400, 'GIT_ERROR', `Commit not found: ${revision}`, commandDetails(outcome));
  }
  return { commit: { ...record, refs: [] }, outcome };
}

/** First parent of a commit (undefined for root commits). */
async function firstParent(ctx: ServerContext, meta: RepoMeta, hash: string): Promise<string | undefined> {
  const outcome = await gitRun(ctx, meta.root, ['rev-parse', '--verify', '--quiet', `${hash}^`]);
  if (commandNotOk(outcome)) return undefined;
  const parent = outcome.result.stdout.trim();
  return parent || undefined;
}

function commitDiffTreeArgs(hash: string, parent: string | undefined, extra: string[]): string[] {
  const base = ['diff-tree', '--no-commit-id', '-r', '-M', ...extra];
  return parent ? [...base, parent, hash] : [...base, '--root', hash];
}

export async function readCommitDetail(
  ctx: ServerContext,
  meta: RepoMeta,
  hash: string,
): Promise<CommitDetail> {
  const [{ commit }, refData] = await Promise.all([readCommitsOnly(ctx, meta, hash), readRefData(ctx, meta)]);
  attachRefs([commit], refData.byHash, refData.head);
  const parent = commit.parents[0];

  const [nameStatusOutcome, numstatOutcome] = await Promise.all([
    gitRun(ctx, meta.root, commitDiffTreeArgs(commit.hash, parent, ['--name-status'])),
    gitRun(ctx, meta.root, commitDiffTreeArgs(commit.hash, parent, ['--numstat'])),
  ]);
  if (commandNotOk(nameStatusOutcome)) failFromGit(nameStatusOutcome, 'git diff-tree');
  const files = mergeFileStats(
    parseNameStatus(nameStatusOutcome.result.stdout),
    parseNumstat(numstatOutcome.result.ok ? numstatOutcome.result.stdout : ''),
  );
  return { commit, stats: diffStats(files), files };
}

function patchArgs(
  hash: string,
  parent: string | undefined,
  filterPath?: string,
  context?: number,
): string[] {
  const contextArg = `-U${context ?? 3}`;
  if (parent) {
    const args = ['diff', '--no-color', '--patch', contextArg, '-M', parent, hash];
    if (filterPath) args.push('--', filterPath);
    return args;
  }
  const args = ['diff-tree', '--no-commit-id', '-p', '--no-color', contextArg, '--root', '-M', hash];
  if (filterPath) args.push('--', filterPath);
  return args;
}

interface ImageSpec {
  before?: string;
  after?: string;
  beforeWorktree?: string;
  afterWorktree?: string;
}

async function loadBlob(
  ctx: ServerContext,
  meta: RepoMeta,
  revisionPath: string,
): Promise<Buffer | undefined> {
  const outcome = await runGitBuffer({
    gitPath: ctx.gitPath,
    cwd: meta.root,
    args: ['cat-file', 'blob', revisionPath],
    timeoutMs: ctx.commandTimeoutMs,
    maxBytes: MAX_BLOB_BYTES,
    env: ctx.gitEnv,
  });
  if (outcome.exitCode !== 0 || outcome.timedOut || outcome.truncated) return undefined;
  return outcome.stdout;
}

function loadWorktreeFile(absolutePath: string): Buffer | undefined {
  try {
    const stats = fs.statSync(absolutePath);
    if (!stats.isFile() || stats.size > MAX_BLOB_BYTES) return undefined;
    return fs.readFileSync(absolutePath);
  } catch {
    return undefined;
  }
}

/** Attach base64 data URLs for binary image diffs (best effort, bounded size). */
async function enrichImages(
  ctx: ServerContext,
  meta: RepoMeta,
  files: FileDiff[],
  specs: (file: FileDiff) => ImageSpec,
): Promise<void> {
  await Promise.all(
    files.map(async (file) => {
      if (!file.binary) return;
      const mime = imageMimeForPath(file.path);
      if (!mime) return;
      const spec = specs(file);
      try {
        const [before, after] = await Promise.all([
          spec.before
            ? loadBlob(ctx, meta, spec.before)
            : spec.beforeWorktree
              ? loadWorktreeFile(spec.beforeWorktree)
              : undefined,
          spec.after
            ? loadBlob(ctx, meta, spec.after)
            : spec.afterWorktree
              ? loadWorktreeFile(spec.afterWorktree)
              : undefined,
        ]);
        if (before) file.imageBefore = bufferToDataUrl(mime, before);
        if (after) file.imageAfter = bufferToDataUrl(mime, after);
      } catch {
        // Image preview is optional; never fail the diff request because of it.
      }
    }),
  );
}

/** Throw `UNSAFE_PATH` when `relative` escapes the worktree root. */
export function safePathWithin(root: string, relative: string): string {
  const normalizedRoot = path.resolve(root);
  const resolved = path.resolve(normalizedRoot, relative);
  const caseInsensitive = process.platform === 'win32';
  const cmpRoot = caseInsensitive ? normalizedRoot.toLowerCase() : normalizedRoot;
  const cmpResolved = caseInsensitive ? resolved.toLowerCase() : resolved;
  const inside = cmpResolved === cmpRoot || cmpResolved.startsWith(`${cmpRoot}${path.sep}`);
  if (!inside) {
    throw new ApiError(400, 'UNSAFE_PATH', `Path escapes the repository: ${relative}`);
  }
  const relativeSegments = path.relative(normalizedRoot, resolved).split(/[\\/]/);
  if (relativeSegments.includes('.git')) {
    throw new ApiError(400, 'UNSAFE_PATH', `Path is inside .git: ${relative}`);
  }
  return resolved;
}

/** Build a `FileDiff` for an untracked (or otherwise un-diffable) text file. */
function synthesizeFileDiff(
  absolutePath: string,
  relativePath: string,
  status: FileDiff['status'],
): FileDiff {
  const buffer = loadWorktreeFile(absolutePath);
  if (!buffer) {
    return { path: relativePath, status, binary: true, hunks: [] };
  }
  const binary = buffer.subarray(0, 8000).includes(0);
  if (binary) {
    return { path: relativePath, status, binary: true, hunks: [] };
  }
  const text = buffer.toString('utf8').replace(/\r\n/g, '\n');
  const lines = text.split('\n');
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return {
    path: relativePath,
    status,
    binary: false,
    hunks: [
      {
        header: `@@ -0,0 +1,${lines.length} @@`,
        lines: lines.map((line, index) => ({ type: 'add', content: line, newLine: index + 1 })),
      },
    ],
  };
}

export async function readCommitDiff(
  ctx: ServerContext,
  meta: RepoMeta,
  hash: string,
  filterPath?: string,
  context?: number,
): Promise<FileDiff[]> {
  assertSafeRevision(hash, 'commit');
  const parent = await firstParent(ctx, meta, hash);
  const outcome = await gitRun(
    ctx,
    meta.root,
    patchArgs(hash, parent, filterPath, clampDiffContext(context)),
  );
  if (commandNotOk(outcome)) failFromGit(outcome, 'git diff');
  const files = parseUnifiedDiff(outcome.result.stdout);
  await enrichImages(ctx, meta, files, (file) => ({
    ...(parent ? { before: `${parent}:${file.oldPath ?? file.path}` } : {}),
    after: `${hash}:${file.path}`,
  }));
  return limitDiffPayload(files);
}

export async function readDiff(ctx: ServerContext, meta: RepoMeta, query: DiffQuery): Promise<FileDiff[]> {
  const context = clampDiffContext(query.context);
  let outcome: GitOutcome;
  let files: FileDiff[];
  switch (query.scope) {
    case 'worktree': {
      const args = ['diff', '--no-color', '--patch', `-U${context}`, '-M'];
      if (query.path) args.push('--', query.path);
      outcome = await gitRun(ctx, meta.root, args);
      if (commandNotOk(outcome)) failFromGit(outcome, 'git diff');
      files = parseUnifiedDiff(outcome.result.stdout);
      if (query.path && files.length === 0) {
        // New/untracked file: git diff has nothing to show, synthesize its content.
        const absolute = safePathWithin(meta.root, query.path);
        if (fs.existsSync(absolute) && fs.statSync(absolute).isFile()) {
          const tracked = await gitRun(ctx, meta.root, ['ls-files', '--error-unmatch', '--', query.path]);
          if (commandNotOk(tracked)) {
            files = [synthesizeFileDiff(absolute, query.path, 'untracked')];
          }
        }
      }
      await enrichImages(ctx, meta, files, (file) => ({
        before: `:${file.oldPath ?? file.path}`,
        afterWorktree: safePathWithin(meta.root, file.path),
      }));
      return limitDiffPayload(files);
    }
    case 'staged': {
      const args = ['diff', '--cached', '--no-color', '--patch', `-U${context}`, '-M'];
      if (query.path) args.push('--', query.path);
      outcome = await gitRun(ctx, meta.root, args);
      if (commandNotOk(outcome)) failFromGit(outcome, 'git diff --cached');
      files = parseUnifiedDiff(outcome.result.stdout);
      await enrichImages(ctx, meta, files, (file) => ({
        before: `HEAD:${file.oldPath ?? file.path}`,
        after: `:${file.path}`,
      }));
      return limitDiffPayload(files);
    }
    case 'commit': {
      if (!query.from) throw new ApiError(400, 'VALIDATION_ERROR', 'scope=commit requires the `from` commit');
      assertSafeRevision(query.from, 'from');
      return readCommitDiff(ctx, meta, query.from, query.path, context);
    }
    case 'range': {
      if (!query.from) throw new ApiError(400, 'VALIDATION_ERROR', 'scope=range requires `from`');
      const to = query.to ?? 'HEAD';
      assertSafeRevision(query.from, 'from');
      assertSafeRevision(to, 'to');
      const args = ['diff', '--no-color', '--patch', `-U${context}`, '-M', query.from, to];
      if (query.path) args.push('--', query.path);
      outcome = await gitRun(ctx, meta.root, args);
      if (commandNotOk(outcome)) failFromGit(outcome, 'git diff');
      files = parseUnifiedDiff(outcome.result.stdout);
      await enrichImages(ctx, meta, files, (file) => ({
        before: `${query.from}:${file.oldPath ?? file.path}`,
        after: `${to}:${file.path}`,
      }));
      return limitDiffPayload(files);
    }
    default:
      throw new ApiError(400, 'VALIDATION_ERROR', `Unsupported diff scope: ${String(query.scope)}`);
  }
}

export async function readStashShow(
  ctx: ServerContext,
  meta: RepoMeta,
  index: number,
): Promise<{ result: CommandResult; files: FileDiff[] }> {
  const outcome = await gitRun(ctx, meta.root, [
    'stash',
    'show',
    '--patch',
    '--no-color',
    `stash@{${index}}`,
  ]);
  if (commandNotOk(outcome)) failFromGit(outcome, `git stash show stash@{${index}}`);
  return { result: outcome.result, files: limitDiffPayload(parseUnifiedDiff(outcome.result.stdout)) };
}

/* ------------------------------------------------------------------ */
/* Branch / remote / tag / stash / worktree / config listings           */
/* ------------------------------------------------------------------ */

export async function readBranches(ctx: ServerContext, meta: RepoMeta): Promise<Branch[]> {
  const outcome = await gitRun(ctx, meta.root, [
    'for-each-ref',
    `--format=${BRANCH_FORMAT}`,
    'refs/heads',
    'refs/remotes',
  ]);
  if (commandNotOk(outcome)) failFromGit(outcome, 'git for-each-ref');
  return parseBranches(outcome.result.stdout);
}

export async function readRemotes(ctx: ServerContext, meta: RepoMeta): Promise<Remote[]> {
  const outcome = await gitRun(ctx, meta.root, ['remote', '-v']);
  if (commandNotOk(outcome)) failFromGit(outcome, 'git remote');
  return parseRemotes(outcome.result.stdout);
}

export async function readTags(ctx: ServerContext, meta: RepoMeta): Promise<Tag[]> {
  const outcome = await gitRun(ctx, meta.root, ['for-each-ref', `--format=${TAG_FORMAT}`, 'refs/tags']);
  if (commandNotOk(outcome)) failFromGit(outcome, 'git for-each-ref refs/tags');
  return parseTags(outcome.result.stdout);
}

export async function readStashes(ctx: ServerContext, meta: RepoMeta): Promise<Stash[]> {
  const outcome = await gitRun(ctx, meta.root, ['stash', 'list', `--format=${STASH_FORMAT}`]);
  if (commandNotOk(outcome)) failFromGit(outcome, 'git stash list');
  return parseStashes(outcome.result.stdout);
}

export async function readWorktrees(ctx: ServerContext, meta: RepoMeta): Promise<Worktree[]> {
  const outcome = await gitRun(ctx, meta.root, ['worktree', 'list', '--porcelain']);
  if (commandNotOk(outcome)) failFromGit(outcome, 'git worktree list');
  return parseWorktrees(outcome.result.stdout);
}

export async function readConfig(
  ctx: ServerContext,
  meta: RepoMeta,
  scope: 'all' | 'local' | 'global',
): Promise<ConfigEntry[]> {
  const wantLocal = scope === 'all' || scope === 'local';
  const wantGlobal = scope === 'all' || scope === 'global';
  const [localOutcome, globalOutcome] = await Promise.all([
    wantLocal
      ? gitRun(ctx, meta.root, ['config', '--local', '--list', '--null'])
      : Promise.resolve(undefined),
    wantGlobal
      ? gitRun(ctx, meta.root, ['config', '--global', '--list', '--null'])
      : Promise.resolve(undefined),
  ]);

  if (
    localOutcome &&
    commandNotOk(localOutcome) &&
    !/unable to read config file/i.test(localOutcome.result.stderr)
  ) {
    failFromGit(localOutcome, 'git config --local');
  }
  if (
    globalOutcome &&
    commandNotOk(globalOutcome) &&
    !/unable to read config file/i.test(globalOutcome.result.stderr)
  ) {
    failFromGit(globalOutcome, 'git config --global');
  }
  const entries: ConfigEntry[] = [];
  if (localOutcome?.result.ok)
    entries.push(...parseConfigList(localOutcome.result.stdout, 'local' as GitScope));
  if (globalOutcome?.result.ok)
    entries.push(...parseConfigList(globalOutcome.result.stdout, 'global' as GitScope));
  return entries;
}

/**
 * Recursive repository discovery.
 *
 * Detects both normal repositories (`.git` directory) and linked worktrees
 * (`.git` file) while skipping heavy/hidden directories, bounded by a maximum
 * depth. Used by the welcome screen and the settings "scan" action.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { ScanResult, ScannedRepo } from '@gitdeck/shared';
import type { ServerContext } from './context';
import { canonicalPath, sameRepoPath } from './store/registry';
import { gitRun } from './git/repo';

const SKIP_DIRECTORIES = new Set(['node_modules', 'dist', '.git']);
const MAX_FOUND = 2000;

interface ScanState {
  found: ScannedRepo[];
  skipped: string[];
  seen: Set<string>;
}

function skipDirectory(name: string): boolean {
  return name.startsWith('.') || SKIP_DIRECTORIES.has(name);
}

async function inspectCandidate(ctx: ServerContext, directory: string): Promise<ScannedRepo | undefined> {
  const [revOutcome, branchOutcome, logOutcome] = await Promise.all([
    gitRun(ctx, directory, ['rev-parse', '--absolute-git-dir', '--git-common-dir', '--is-bare-repository']),
    gitRun(ctx, directory, ['rev-parse', '--abbrev-ref', 'HEAD']),
    gitRun(ctx, directory, ['log', '-1', '--format=%h%x00%cI']),
  ]);
  if (revOutcome.timedOut || !revOutcome.result.ok) return undefined;
  const lines = revOutcome.result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const gitDirRaw = lines[0];
  if (!gitDirRaw) return undefined;
  const gitDir = canonicalPath(path.resolve(directory, gitDirRaw));
  const commonDirRaw = lines[1];
  const commonDir = commonDirRaw ? canonicalPath(path.resolve(directory, commonDirRaw)) : gitDir;
  const bare = lines[2] === 'true';
  const isWorktree = !bare && !sameRepoPath(gitDir, commonDir);
  // Bare repositories are not useful to open in the UI; skip them.
  if (bare) return undefined;

  const branchRaw = branchOutcome.result.ok ? branchOutcome.result.stdout.trim() : '';
  const branch = branchRaw && branchRaw !== 'HEAD' ? branchRaw : undefined;

  let head: string | undefined;
  let lastCommitDate: string | undefined;
  if (logOutcome.result.ok) {
    const [shortHash, date] = logOutcome.result.stdout.trim().split('\0');
    head = shortHash || undefined;
    lastCommitDate = date || undefined;
  }

  const root = canonicalPath(directory);
  let mainWorktreePath: string | undefined;
  if (isWorktree) {
    mainWorktreePath = path.basename(commonDir) === '.git' ? path.dirname(commonDir) : commonDir;
  }

  return {
    path: root,
    name: path.basename(root),
    kind: isWorktree ? 'worktree' : 'repository',
    ...(branch ? { branch } : {}),
    ...(head ? { head } : {}),
    ...(lastCommitDate ? { lastCommitDate } : {}),
    ...(mainWorktreePath ? { mainWorktreePath } : {}),
  };
}

async function walk(
  ctx: ServerContext,
  directory: string,
  depth: number,
  maxDepth: number,
  state: ScanState,
): Promise<void> {
  if (state.found.length >= MAX_FOUND) return;
  const absolute = path.resolve(directory);

  let entries: fs.Dirent[];
  try {
    entries = await fs.promises.readdir(absolute, { withFileTypes: true });
  } catch {
    state.skipped.push(absolute);
    return;
  }

  const hasGitEntry = entries.some((entry) => entry.name === '.git');
  if (hasGitEntry) {
    const key = process.platform === 'win32' ? absolute.toLowerCase() : absolute;
    if (!state.seen.has(key)) {
      const candidate = await inspectCandidate(ctx, absolute);
      if (candidate) {
        state.seen.add(key);
        state.found.push(candidate);
      } else {
        state.skipped.push(absolute);
      }
    }
    return; // never recurse inside a repository
  }

  if (depth >= maxDepth) return;
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
    if (skipDirectory(entry.name)) continue;
    await walk(ctx, path.join(absolute, entry.name), depth + 1, maxDepth, state);
  }
}

/** Scan the given roots (or configured defaults) for repositories and worktrees. */
export async function scanRepos(
  ctx: ServerContext,
  input: { roots?: string[]; maxDepth?: number },
): Promise<ScanResult> {
  const started = Date.now();
  const settings = ctx.settingsStore.get();
  const roots = (input.roots && input.roots.length > 0 ? input.roots : settings.scanRoots)
    .map((root) => path.resolve(root))
    .filter(Boolean);
  const maxDepth = Math.min(Math.max(input.maxDepth ?? settings.maxScanDepth, 1), 8);
  const state: ScanState = { found: [], skipped: [], seen: new Set<string>() };
  const uniqueRoots: string[] = [];
  const rootKeys = new Set<string>();
  for (const root of roots) {
    const key = process.platform === 'win32' ? root.toLowerCase() : root;
    if (rootKeys.has(key)) continue;
    rootKeys.add(key);
    uniqueRoots.push(root);
    try {
      const stats = await fs.promises.stat(root);
      if (!stats.isDirectory()) {
        state.skipped.push(root);
        continue;
      }
    } catch {
      state.skipped.push(root);
      continue;
    }
    await walk(ctx, root, 0, maxDepth, state);
  }

  state.found.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return {
    roots: uniqueRoots,
    found: state.found,
    skipped: state.skipped,
    durationMs: Date.now() - started,
  };
}

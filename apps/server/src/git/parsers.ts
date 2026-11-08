/**
 * Pure parsers for the git outputs the API depends on.
 *
 * Every function here is side-effect free and operates on captured stdout, so
 * the parsing logic can be unit tested without spawning git.
 */
import type {
  Branch,
  Commit,
  ConfigEntry,
  ConflictSide,
  DiffStats,
  FileChange,
  FileStatus,
  GitAuthor,
  GitRef,
  GitScope,
  Remote,
  Stash,
  StatusCounts,
  Tag,
  Worktree,
} from '@gitdeck/shared';

/* ------------------------------------------------------------------ */
/* Shared helpers                                                      */
/* ------------------------------------------------------------------ */

const FIELD = '\0';

export function splitFields(line: string): string[] {
  return line.split(FIELD);
}

function shortOf(hash: string): string {
  return hash.slice(0, 7);
}

/** Parse `%(upstream:track)` like `[ahead 1, behind 2]`, `[gone]` or ``. */
export function parseTrack(track: string): { ahead: number; behind: number } {
  const ahead = /ahead (\d+)/.exec(track);
  const behind = /behind (\d+)/.exec(track);
  return {
    ahead: ahead ? Number.parseInt(ahead[1] ?? '0', 10) : 0,
    behind: behind ? Number.parseInt(behind[1] ?? '0', 10) : 0,
  };
}

function author(name: string, email: string, date: string): GitAuthor {
  return { name: name ?? '', email: email ?? '', date: date ?? '' };
}

/* ------------------------------------------------------------------ */
/* status --porcelain=v2 --branch -z                                  */
/* ------------------------------------------------------------------ */

export interface StatusSnapshot {
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
  headOid?: string;
}

function mapStatusCode(code: string): FileStatus {
  switch (code) {
    case 'M':
      return 'modified';
    case 'A':
      return 'added';
    case 'D':
      return 'deleted';
    case 'R':
      return 'renamed';
    case 'C':
      return 'copied';
    case 'T':
      return 'typechange';
    case 'U':
      return 'conflicted';
    case '?':
      return 'untracked';
    case '!':
      return 'ignored';
    default:
      return 'modified';
  }
}

function mapUnmerged(xy: string): ConflictSide {
  switch (xy) {
    case 'DD':
      return 'both-deleted';
    case 'AU':
      return 'added-by-us';
    case 'UD':
      return 'deleted-by-them';
    case 'UA':
      return 'added-by-them';
    case 'DU':
      return 'deleted-by-us';
    case 'AA':
      return 'both-added';
    case 'UU':
    default:
      return 'both-modified';
  }
}

/** Parse `git status --porcelain=v2 --branch -z --untracked-files=all`. */
export function parseStatus(raw: string): StatusSnapshot {
  const snapshot: StatusSnapshot = {
    branch: '',
    detached: false,
    unborn: false,
    ahead: 0,
    behind: 0,
    staged: [],
    unstaged: [],
    untracked: [],
    conflicted: [],
    counts: { staged: 0, unstaged: 0, untracked: 0, conflicted: 0 },
  };
  let branchName = '';

  const tokens = raw.split(FIELD);
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index] ?? '';
    if (token.length === 0) continue;

    if (token.startsWith('# ')) {
      const header = token.slice(2);
      if (header.startsWith('branch.oid ')) {
        const oid = header.slice('branch.oid '.length).trim();
        if (oid && oid !== '(initial)') snapshot.headOid = oid;
        else snapshot.unborn = true;
      } else if (header.startsWith('branch.head ')) {
        const head = header.slice('branch.head '.length).trim();
        if (head === '(detached)') {
          snapshot.detached = true;
        } else {
          branchName = head;
        }
      } else if (header.startsWith('branch.upstream ')) {
        const upstream = header.slice('branch.upstream '.length).trim();
        if (upstream) snapshot.upstream = upstream;
      } else if (header.startsWith('branch.ab ')) {
        const match = /\+(-?\d+)\s+-(-?\d+)/.exec(header);
        if (match) {
          snapshot.ahead = Number.parseInt(match[1] ?? '0', 10);
          snapshot.behind = Number.parseInt(match[2] ?? '0', 10);
        }
      }
      continue;
    }

    const kind = token[0];
    if (kind === '?') {
      const filePath = token.slice(2);
      if (filePath) snapshot.untracked.push({ path: filePath, status: 'untracked' });
      continue;
    }
    if (kind === '!') continue;

    if (kind === '1' || kind === '2') {
      const fields = token.split(' ');
      const xy = fields[1] ?? '..';
      const x = xy[0] ?? '.';
      const y = xy[1] ?? '.';
      const renameAware = kind === '2';
      const pathFieldIndex = renameAware ? 9 : 8;
      const filePath = fields.slice(pathFieldIndex).join(' ');
      let oldPath: string | undefined;
      if (renameAware) {
        oldPath = tokens[index + 1] ?? undefined;
        index += 1;
      }
      if (x !== '.' && filePath) {
        snapshot.staged.push({
          path: filePath,
          status: mapStatusCode(x),
          ...(oldPath ? { oldPath } : {}),
        });
      }
      if (y !== '.' && filePath) {
        snapshot.unstaged.push({ path: filePath, status: mapStatusCode(y) });
      }
      continue;
    }

    if (kind === 'u') {
      const fields = token.split(' ');
      const xy = fields[1] ?? 'UU';
      const filePath = fields.slice(10).join(' ');
      if (filePath) {
        snapshot.conflicted.push({
          path: filePath,
          status: 'conflicted',
          conflictType: mapUnmerged(xy),
        });
      }
      continue;
    }
  }

  snapshot.counts = {
    staged: snapshot.staged.length,
    unstaged: snapshot.unstaged.length,
    untracked: snapshot.untracked.length,
    conflicted: snapshot.conflicted.length,
  };

  if (snapshot.detached) {
    snapshot.branch = snapshot.headOid ? shortOf(snapshot.headOid) : 'HEAD';
  } else {
    snapshot.branch = branchName;
  }
  if (!snapshot.branch) snapshot.branch = snapshot.headOid ? shortOf(snapshot.headOid) : 'HEAD';
  return snapshot;
}

/* ------------------------------------------------------------------ */
/* log / show --pretty with %x00 fields and %x1e records               */
/* ------------------------------------------------------------------ */

export const COMMIT_PRETTY_FORMAT =
  '%H%x00%h%x00%P%x00%an%x00%ae%x00%aI%x00%cn%x00%ce%x00%cI%x00%s%x00%b%x1e';

export const REFLOG_PRETTY_FORMAT =
  '%H%x00%h%x00%P%x00%an%x00%ae%x00%aI%x00%cn%x00%ce%x00%cI%x00%gs%x00%gd%x1e';

interface CommitFields {
  hash: string;
  shortHash: string;
  parents: string[];
  author: GitAuthor;
  committer: GitAuthor;
  subject: string;
  body: string;
}

/** Parse the `%x00` separated commit fields shared by log/show/reflog. */
export function parseCommitRecords(raw: string): CommitFields[] {
  const records: CommitFields[] = [];
  for (const chunk of raw.split('\x1e')) {
    const trimmed = chunk.replace(/^\r?\n/, '');
    if (!trimmed.trim()) continue;
    const fields = trimmed.split(FIELD);
    if (fields.length < 10) continue;
    const parentsRaw = fields[2] ?? '';
    records.push({
      hash: fields[0] ?? '',
      shortHash: fields[1] ?? '',
      parents: parentsRaw.trim() ? parentsRaw.trim().split(' ') : [],
      author: author(fields[3] ?? '', fields[4] ?? '', fields[5] ?? ''),
      committer: author(fields[6] ?? '', fields[7] ?? '', fields[8] ?? ''),
      subject: fields[9] ?? '',
      body: (fields[10] ?? '').replace(/\r?\n+$/, ''),
    });
  }
  return records;
}

/** Parse `git log` output into commits (refs are attached separately). */
export function parseLog(raw: string): Commit[] {
  return parseCommitRecords(raw).map((record) => ({ ...record, refs: [] }));
}

/** Parse `git reflog` output into commits. */
export function parseReflog(raw: string): Commit[] {
  return parseCommitRecords(raw).map((record) => ({
    hash: record.hash,
    shortHash: record.shortHash,
    parents: record.parents,
    subject: record.subject,
    body: '',
    author: record.author,
    committer: record.committer,
    refs: [],
  }));
}

/* ------------------------------------------------------------------ */
/* for-each-ref refs (log decoration)                                  */
/* ------------------------------------------------------------------ */

/** Format: %(objectname)%00%(refname)%00%(HEAD) */
export function parseRefList(raw: string): Map<string, GitRef[]> {
  const map = new Map<string, GitRef[]>();
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const [hash, refName, head] = line.split(FIELD);
    if (!hash || !refName) continue;
    const ref = toGitRef(refName, (head ?? '').trim() === '*');
    if (!ref) continue;
    const list = map.get(hash) ?? [];
    list.push(ref);
    map.set(hash, list);
  }
  return map;
}

function toGitRef(refName: string, current: boolean): GitRef | undefined {
  if (refName.startsWith('refs/heads/')) {
    const name = refName.slice('refs/heads/'.length);
    return { type: 'branch', refName, name, label: name, current };
  }
  if (refName.startsWith('refs/remotes/')) {
    const name = refName.slice('refs/remotes/'.length);
    if (name.endsWith('/HEAD')) return undefined;
    return { type: 'remote', refName, name, label: name };
  }
  if (refName.startsWith('refs/tags/')) {
    const name = refName.slice('refs/tags/'.length);
    return { type: 'tag', refName, name, label: name };
  }
  return undefined;
}

/** Attach ref pills (and HEAD) to commits. */
export function attachRefs(commits: Commit[], refsByHash: Map<string, GitRef[]>, headOid?: string): void {
  for (const commit of commits) {
    const refs = (refsByHash.get(commit.hash) ?? []).slice();
    refs.sort((a, b) => refSortRank(a) - refSortRank(b) || a.label.localeCompare(b.label));
    if (headOid && headOid === commit.hash) {
      refs.unshift({ type: 'head', refName: 'HEAD', name: 'HEAD', label: 'HEAD', current: true });
    }
    commit.refs = refs;
  }
}

function refSortRank(ref: GitRef): number {
  if (ref.type === 'head') return 0;
  if (ref.type === 'branch') return ref.current ? 1 : 2;
  if (ref.type === 'tag') return 3;
  return 4;
}

/* ------------------------------------------------------------------ */
/* branches                                                            */
/* ------------------------------------------------------------------ */

export const BRANCH_FORMAT =
  '%(refname)%00%(objectname)%00%(objectname:short)%00%(HEAD)%00%(upstream:short)%00%(upstream:track)%00%(subject)%00%(authorname)%00%(authordate:iso-strict)';

export function parseBranches(raw: string): Branch[] {
  const branches: Branch[] = [];
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const fields = line.split(FIELD);
    const refName = fields[0] ?? '';
    if (!refName) continue;
    const hash = fields[1] ?? '';
    const shortHash = fields[2] || shortOf(hash);
    const headMarker = (fields[3] ?? '').trim();
    const upstream = (fields[4] ?? '').trim();
    const track = (fields[5] ?? '').trim();
    const subject = fields[6] ?? '';
    const tipAuthor = fields[7] ?? '';
    const tipDate = fields[8] ?? '';
    const { ahead, behind } = parseTrack(track);

    if (refName.startsWith('refs/heads/')) {
      const name = refName.slice('refs/heads/'.length);
      branches.push({
        name,
        isRemote: false,
        current: headMarker === '*',
        ahead,
        behind,
        ...(upstream ? { upstream } : {}),
        tipHash: hash,
        tipShortHash: shortHash,
        tipSubject: subject,
        tipAuthor,
        tipDate,
      });
      continue;
    }
    if (refName.startsWith('refs/remotes/')) {
      const name = refName.slice('refs/remotes/'.length);
      if (name.endsWith('/HEAD')) continue;
      const remote = name.split('/')[0] ?? '';
      branches.push({
        name,
        isRemote: true,
        remote,
        current: false,
        ahead: 0,
        behind: 0,
        tipHash: hash,
        tipShortHash: shortHash,
        tipSubject: subject,
        tipAuthor,
        tipDate,
      });
    }
  }
  branches.sort(compareBranches);
  return branches;
}

function compareBranches(a: Branch, b: Branch): number {
  if (a.current !== b.current) return a.current ? -1 : 1;
  if (a.isRemote !== b.isRemote) return a.isRemote ? 1 : -1;
  return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
}

/* ------------------------------------------------------------------ */
/* remotes                                                             */
/* ------------------------------------------------------------------ */

/** Parse `git remote -v`. */
export function parseRemotes(raw: string): Remote[] {
  const byName = new Map<string, Remote>();
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const match = /^(\S+)\t(.+?)\s+\((fetch|push)\)$/.exec(line);
    if (!match) continue;
    const name = match[1] ?? '';
    const url = match[2] ?? '';
    const kind = match[3];
    const existing = byName.get(name) ?? { name, fetchUrl: '', pushUrl: '' };
    if (kind === 'fetch') {
      existing.fetchUrl = url;
      if (!existing.pushUrl) existing.pushUrl = url;
    } else {
      existing.pushUrl = url;
    }
    byName.set(name, existing);
  }
  return [...byName.values()].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

/* ------------------------------------------------------------------ */
/* tags                                                                */
/* ------------------------------------------------------------------ */

export const TAG_FORMAT =
  '%(refname)%00%(objectname)%00%(*objectname)%00%(*objectname:short)%00%(objecttype)%00%(taggername)%00%(taggerdate:iso-strict)%00%(subject)%00%(creatordate:iso-strict)';

/** Parse `git for-each-ref refs/tags`. */
export function parseTags(raw: string): Tag[] {
  const tags: Tag[] = [];
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const fields = line.split(FIELD);
    const refName = fields[0] ?? '';
    if (!refName.startsWith('refs/tags/')) continue;
    const objectName = fields[1] ?? '';
    const deref = fields[2] ?? '';
    const derefShort = fields[3] ?? '';
    const objectType = fields[4] ?? '';
    const tagger = fields[5] ?? '';
    const taggerDate = fields[6] ?? '';
    const subject = fields[7] ?? '';
    const creatorDate = fields[8] ?? '';
    const hash = deref || objectName;
    tags.push({
      name: refName.slice('refs/tags/'.length),
      hash,
      shortHash: deref ? derefShort || shortOf(deref) : shortOf(objectName),
      annotated: objectType === 'tag',
      subject,
      ...(tagger ? { tagger } : {}),
      ...(taggerDate || creatorDate ? { date: taggerDate || creatorDate } : {}),
    });
  }
  tags.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return tags;
}

/* ------------------------------------------------------------------ */
/* stashes                                                             */
/* ------------------------------------------------------------------ */

export const STASH_FORMAT = '%gd%x00%H%x00%h%x00%gs%x00%cI';

/** Parse `git stash list --format=...`. */
export function parseStashes(raw: string): Stash[] {
  const stashes: Stash[] = [];
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const fields = line.split(FIELD);
    const selector = fields[0] ?? '';
    const indexMatch = /stash@\{(\d+)\}/.exec(selector);
    if (!indexMatch) continue;
    const message = fields[3] ?? '';
    const branchMatch = /^(?:WIP on|On) ([^:]+):/.exec(message);
    stashes.push({
      index: Number.parseInt(indexMatch[1] ?? '0', 10),
      hash: fields[1] ?? '',
      shortHash: fields[2] ?? '',
      name: selector,
      message,
      date: fields[4] ?? '',
      ...(branchMatch?.[1] ? { branch: branchMatch[1] } : {}),
    });
  }
  stashes.sort((a, b) => a.index - b.index);
  return stashes;
}

/* ------------------------------------------------------------------ */
/* worktrees                                                           */
/* ------------------------------------------------------------------ */

/** Parse `git worktree list --porcelain`. */
export function parseWorktrees(raw: string): Worktree[] {
  const worktrees: Worktree[] = [];
  let current: Worktree | undefined;
  const finalize = (): void => {
    if (!current) return;
    current.isMain = worktrees.length === 0;
    worktrees.push(current);
    current = undefined;
  };
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) {
      finalize();
      continue;
    }
    if (line.startsWith('worktree ')) {
      finalize();
      const worktreePath = line.slice('worktree '.length).trim();
      current = {
        path: worktreePath,
        name: worktreePath.split(/[\\/]/).filter(Boolean).pop() ?? worktreePath,
        bare: false,
        detached: false,
        isMain: false,
      };
      continue;
    }
    if (!current) continue;
    if (line.startsWith('HEAD ')) {
      current.head = line.slice('HEAD '.length).trim();
    } else if (line.startsWith('branch ')) {
      const full = line.slice('branch '.length).trim();
      current.branch = full.startsWith('refs/heads/') ? full.slice('refs/heads/'.length) : full;
    } else if (line === 'bare' || line.startsWith('bare ')) {
      current.bare = true;
    } else if (line === 'detached') {
      current.detached = true;
    } else if (line === 'locked' || line.startsWith('locked ')) {
      current.locked = line.slice('locked '.length).trim();
    } else if (line === 'prunable' || line.startsWith('prunable ')) {
      current.prunable = line.slice('prunable '.length).trim();
    }
  }
  finalize();
  worktrees.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return worktrees;
}

/* ------------------------------------------------------------------ */
/* config                                                              */
/* ------------------------------------------------------------------ */

/** Parse `git config --list --null` (key, newline, value, NUL). */
export function parseConfigList(raw: string, scope: GitScope): ConfigEntry[] {
  const entries: ConfigEntry[] = [];
  for (const chunk of raw.split(FIELD)) {
    if (!chunk) continue;
    const newline = chunk.indexOf('\n');
    const key = newline === -1 ? chunk : chunk.slice(0, newline);
    const value = newline === -1 ? '' : chunk.slice(newline + 1);
    if (!key) continue;
    entries.push({ key, value, scope });
  }
  return entries;
}

/* ------------------------------------------------------------------ */
/* diff-tree                                                           */
/* ------------------------------------------------------------------ */

/** Parse `git diff-tree --numstat -r -M <range>` output. */
export function parseNumstat(
  raw: string,
): Map<string, { insertions: number; deletions: number; binary: boolean }> {
  const stats = new Map<string, { insertions: number; deletions: number; binary: boolean }>();
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const parts = line.split('\t');
    if (parts.length < 3) continue;
    const path = parts.slice(2).join('\t');
    const binary = parts[0] === '-' || parts[1] === '-';
    stats.set(path, {
      insertions: binary ? 0 : Number.parseInt(parts[0] ?? '0', 10),
      deletions: binary ? 0 : Number.parseInt(parts[1] ?? '0', 10),
      binary,
    });
  }
  return stats;
}

/** Parse `git diff-tree --name-status -r -M <range>` output. */
export function parseNameStatus(raw: string): FileChange[] {
  const files: FileChange[] = [];
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const parts = line.split('\t');
    const code = parts[0] ?? '';
    if (parts.length < 2) continue;
    const letter = code[0];
    if (letter === 'R' || letter === 'C') {
      files.push({
        path: parts[2] ?? parts[1] ?? '',
        oldPath: parts[1] ?? '',
        status: letter === 'R' ? 'renamed' : 'copied',
      });
      continue;
    }
    const status: FileStatus =
      letter === 'A'
        ? 'added'
        : letter === 'D'
          ? 'deleted'
          : letter === 'M'
            ? 'modified'
            : letter === 'T'
              ? 'typechange'
              : letter === 'U'
                ? 'conflicted'
                : 'modified';
    files.push({ path: parts[1] ?? '', status });
  }
  return files;
}

/** Merge numstat information into name-status file changes. */
export function mergeFileStats(files: FileChange[], numstat: ReturnType<typeof parseNumstat>): FileChange[] {
  return files.map((file) => {
    const stat = numstat.get(file.path) ?? (file.oldPath ? numstat.get(file.oldPath) : undefined);
    if (!stat) return file;
    return {
      ...file,
      insertions: stat.insertions,
      deletions: stat.deletions,
      ...(stat.binary ? { binary: true } : {}),
    };
  });
}

export function diffStats(files: FileChange[]): DiffStats {
  let insertions = 0;
  let deletions = 0;
  for (const file of files) {
    insertions += file.insertions ?? 0;
    deletions += file.deletions ?? 0;
  }
  return { filesChanged: files.length, insertions, deletions };
}

/* ------------------------------------------------------------------ */
/* misc                                                                */
/* ------------------------------------------------------------------ */

/** Parse `git symbolic-ref --short refs/remotes/<remote>/HEAD`, e.g. `origin/main`. */
export function parseDefaultBranch(symbolic: string, remote?: string): string | undefined {
  const value = symbolic.trim();
  if (!value) return undefined;
  const prefix = remote ? `${remote}/` : undefined;
  if (prefix && value.startsWith(prefix)) return value.slice(prefix.length);
  const slash = value.indexOf('/');
  return slash === -1 ? value : value.slice(slash + 1);
}

/**
 * Repository registry: the allow-list of repositories the server may touch.
 *
 * Ids are derived from the canonical repository path (`sha1` of the normalised
 * real path), so requests can never address arbitrary directories. The registry
 * is persisted in `<dataDir>/repos.json` and survives restarts.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { RepoRecord } from '@gitdeck/shared';

interface ReposFile {
  version: 1;
  repos: RepoRecord[];
}

const FILE_VERSION = 1;

/** Resolve symlinks when possible, otherwise normalise the absolute path. */
export function canonicalPath(input: string): string {
  const absolute = path.resolve(input);
  try {
    return fs.realpathSync.native(absolute);
  } catch {
    return absolute;
  }
}

function pathForId(canonical: string): string {
  const forwardSlashes = canonical.replace(/\\/g, '/').replace(/\/+$/, '');
  return process.platform === 'win32' ? forwardSlashes.toLowerCase() : forwardSlashes;
}

export function repoIdForPath(canonical: string): string {
  return createHash('sha1').update(pathForId(canonical), 'utf8').digest('hex');
}

export function sameRepoPath(a: string, b: string): boolean {
  return pathForId(canonicalPath(a)) === pathForId(canonicalPath(b));
}

function atomicWriteJson(file: string, value: unknown): void {
  const payload = `${JSON.stringify(value, null, 2)}\n`;
  const tmp = `${file}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(tmp, payload, 'utf8');
    fs.renameSync(tmp, file);
  } catch {
    try {
      fs.rmSync(tmp, { force: true });
    } catch {
      // ignore
    }
    fs.writeFileSync(file, payload, 'utf8');
  }
}

export class RepoRegistry {
  private readonly file: string;
  private repos: RepoRecord[] = [];

  constructor(dataDir: string) {
    this.file = path.join(dataDir, 'repos.json');
    this.load();
    this.pruneMissing();
  }

  private load(): void {
    try {
      const parsed = JSON.parse(fs.readFileSync(this.file, 'utf8')) as Partial<ReposFile>;
      if (Array.isArray(parsed.repos)) {
        this.repos = parsed.repos.filter(
          (repo): repo is RepoRecord =>
            typeof repo === 'object' &&
            repo !== null &&
            typeof (repo as RepoRecord).id === 'string' &&
            typeof (repo as RepoRecord).path === 'string' &&
            typeof (repo as RepoRecord).name === 'string',
        );
      }
    } catch {
      this.repos = [];
    }
  }

  /** Drop records whose directory disappeared (e.g. deleted worktree). */
  private pruneMissing(): void {
    const before = this.repos.length;
    this.repos = this.repos.filter((repo) => {
      try {
        return fs.statSync(repo.path).isDirectory();
      } catch {
        return false;
      }
    });
    if (this.repos.length !== before) this.persist();
  }

  list(): RepoRecord[] {
    return this.repos
      .slice()
      .sort((a, b) => (a.openedAt < b.openedAt ? 1 : a.openedAt > b.openedAt ? -1 : 0));
  }

  get(id: string): RepoRecord | undefined {
    return this.repos.find((repo) => repo.id === id);
  }

  findByPath(candidate: string): RepoRecord | undefined {
    const canonical = canonicalPath(candidate);
    return this.repos.find((repo) => pathForId(canonicalPath(repo.path)) === pathForId(canonical));
  }

  /** Insert or refresh a repository record; keeps the id stable for a path. */
  upsert(repoPath: string, name?: string): RepoRecord {
    const canonical = canonicalPath(repoPath);
    const id = repoIdForPath(canonical);
    const existing = this.repos.find((repo) => repo.id === id);
    const record: RepoRecord = {
      id,
      name: name ?? existing?.name ?? path.basename(canonical),
      path: canonical,
      openedAt: new Date().toISOString(),
    };
    if (existing) {
      Object.assign(existing, record);
    } else {
      this.repos.push(record);
    }
    this.persist();
    return record;
  }

  remove(id: string): boolean {
    const before = this.repos.length;
    this.repos = this.repos.filter((repo) => repo.id !== id);
    if (this.repos.length === before) return false;
    this.persist();
    return true;
  }

  private persist(): void {
    const payload: ReposFile = { version: FILE_VERSION, repos: this.repos };
    atomicWriteJson(this.file, payload);
  }
}

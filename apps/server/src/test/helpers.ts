/**
 * Test helpers: temporary real git repositories + an isolated server instance.
 *
 * Every test gets its own data dir / HOME so the suite never touches the real
 * user configuration, and all temp directories are cleaned up afterwards.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type express from 'express';
import { createApp } from '../app';

const tempDirs: string[] = [];

export async function mkTempDir(prefix: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), `gitdeck-${prefix}-`));
  tempDirs.push(dir);
  return dir;
}

export async function cleanupTemps(): Promise<void> {
  for (const dir of tempDirs.splice(0)) {
    try {
      await fs.rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    } catch {
      // best effort
    }
  }
}

export interface CliResult {
  stdout: string;
  stderr: string;
  code: number;
}

/** Run the real git binary (test fixtures only). */
export function cli(cwd: string, args: string[], env?: Record<string, string>): Promise<CliResult> {
  return new Promise((resolve, reject) => {
    const child = spawn('git', args, {
      cwd,
      env: { ...process.env, ...(env ?? {}), GIT_TERMINAL_PROMPT: '0' },
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    child.stdout.on('data', (chunk: Buffer) => out.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => err.push(chunk));
    child.on('error', reject);
    child.on('close', (code) => {
      resolve({
        stdout: Buffer.concat(out).toString('utf8'),
        stderr: Buffer.concat(err).toString('utf8'),
        code: code ?? 1,
      });
    });
  });
}

/** Run git and throw a useful error on failure. */
export async function git(cwd: string, args: string[], env?: Record<string, string>): Promise<string> {
  const result = await cli(cwd, args, env);
  if (result.code !== 0) {
    throw new Error(`git ${args.join(' ')} failed (${result.code}): ${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

export async function writeFile(repo: string, relative: string, content: string): Promise<void> {
  const target = path.join(repo, relative);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content, 'utf8');
}

export async function readFile(repo: string, relative: string): Promise<string> {
  return fs.readFile(path.join(repo, relative), 'utf8');
}

/** Create a repository with a deterministic identity and no autocrlf surprises. */
export async function initRepo(name = 'repo'): Promise<string> {
  const dir = path.join(await mkTempDir(name), name);
  await fs.mkdir(dir, { recursive: true });
  await git(dir, ['init', '-q', '-b', 'main']);
  await git(dir, ['config', 'user.name', 'GitDeck Tester']);
  await git(dir, ['config', 'user.email', 'tester@gitdeck.local']);
  await git(dir, ['config', 'core.autocrlf', 'false']);
  return dir;
}

export async function initBareRepo(name = 'remote.git'): Promise<string> {
  const dir = path.join(await mkTempDir(name), name);
  await fs.mkdir(dir, { recursive: true });
  await git(dir, ['init', '-q', '--bare', '-b', 'main']);
  return dir;
}

export async function commitAll(repo: string, message: string): Promise<string> {
  await git(repo, ['add', '-A']);
  await git(repo, ['commit', '-q', '-m', message]);
  return (await git(repo, ['rev-parse', 'HEAD'])).trim();
}

export interface TestServer {
  app: express.Express;
  dataDir: string;
  homeDir: string;
  gitEnv: Record<string, string>;
  cleanup(): Promise<void>;
}

/** Boot the Express app against isolated data dir / HOME. */
export async function createTestServer(): Promise<TestServer> {
  const dataDir = await mkTempDir('data');
  const homeDir = await mkTempDir('home');
  const gitEnv: Record<string, string> = {
    HOME: homeDir,
    USERPROFILE: homeDir,
    XDG_CONFIG_HOME: path.join(homeDir, '.config'),
    GIT_CONFIG_NOSYSTEM: '1',
  };
  await fs.mkdir(path.join(homeDir, '.config'), { recursive: true });
  const app = createApp({
    dataDir,
    demoRepoPath: null,
    gitEnv,
    settings: {
      scanRoots: [],
      gitPath: 'git',
    },
  });
  return {
    app,
    dataDir,
    homeDir,
    gitEnv,
    async cleanup(): Promise<void> {
      // Temp dirs are removed globally by cleanupTemps().
    },
  };
}

/** Typical fixture: two-line file, a feature branch with an extra file, tag? */
export async function createBasicRepo(): Promise<string> {
  const repo = await initRepo();
  await writeFile(repo, 'README.md', '# GitDeck\n');
  await writeFile(repo, 'src/app.txt', 'line1\nline2\n');
  await commitAll(repo, 'initial commit');
  await writeFile(repo, 'README.md', '# GitDeck\n\nupdated readme\n');
  await commitAll(repo, 'update readme');
  await git(repo, ['checkout', '-q', '-b', 'feature']);
  await writeFile(repo, 'feature.txt', 'feature work\n');
  await commitAll(repo, 'add feature');
  await git(repo, ['checkout', '-q', 'main']);
  return repo;
}

import fs from 'node:fs/promises';
import path from 'node:path';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import {
  cleanupTemps,
  commitAll,
  createTestServer,
  git,
  initBareRepo,
  initRepo,
  mkTempDir,
  readFile,
  writeFile,
  type TestServer,
} from './helpers';

let server: TestServer;

beforeEach(async () => {
  server = await createTestServer();
});

afterEach(async () => {
  await cleanupTemps();
});

async function openRepo(repo: string): Promise<string> {
  const response = await request(server.app).post('/api/repos/open').send({ path: repo });
  expect(response.status).toBe(200);
  return response.body.repo.id as string;
}

describe('merge, conflict resolution and operation state', () => {
  async function createConflictingRepo(): Promise<string> {
    const repo = await initRepo();
    await writeFile(repo, 'conflict.txt', 'base\n');
    await commitAll(repo, 'base commit');
    await git(repo, ['checkout', '-q', '-b', 'side']);
    await writeFile(repo, 'conflict.txt', 'side change\n');
    await commitAll(repo, 'side change');
    await git(repo, ['checkout', '-q', 'main']);
    await writeFile(repo, 'conflict.txt', 'main change\n');
    await commitAll(repo, 'main change');
    return repo;
  }

  it('reports conflicts as 409 and resolves them', async () => {
    const repo = await createConflictingRepo();
    const id = await openRepo(repo);

    let response = await request(server.app).post(`/api/repos/${id}/branch/merge`).send({ branch: 'side' });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('CONFLICT');
    expect(`${response.body.error.details.stdout}\n${response.body.error.details.stderr}`).toContain(
      'CONFLICT',
    );
    expect(response.body.error.details.operation.state).toBe('merging');
    expect(response.body.error.details.command).toContain('git merge');
    expect(response.body.error.details.command).toContain('side');

    response = await request(server.app).get(`/api/repos/${id}/status`);
    expect(response.body.operation.state).toBe('merging');
    expect(response.body.counts.conflicted).toBe(1);
    expect(response.body.conflicted[0]).toMatchObject({
      path: 'conflict.txt',
      status: 'conflicted',
      conflictType: 'both-modified',
    });

    response = await request(server.app)
      .post(`/api/repos/${id}/resolve`)
      .send({ paths: ['conflict.txt'], resolution: 'ours' });
    expect(response.status).toBe(200);
    expect(response.body.result.ok).toBe(true);
    expect(await readFile(repo, 'conflict.txt')).toBe('main change\n');

    response = await request(server.app).post(`/api/repos/${id}/commit`).send({ message: 'merge side' });
    expect(response.status).toBe(200);

    response = await request(server.app).get(`/api/repos/${id}/summary`);
    expect(response.body.operation).toBeUndefined();
    expect(response.body.statusCounts.conflicted).toBe(0);

    response = await request(server.app).get(`/api/repos/${id}/log?limit=1`);
    expect(response.body.commits[0].subject).toBe('merge side');
    expect(response.body.commits[0].parents).toHaveLength(2);
  });

  it('detects and aborts a conflicted rebase', async () => {
    const repo = await createConflictingRepo();
    const id = await openRepo(repo);
    await request(server.app).post(`/api/repos/${id}/branch/checkout`).send({ target: 'side' });

    let response = await request(server.app).post(`/api/repos/${id}/branch/rebase`).send({ onto: 'main' });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('CONFLICT');

    response = await request(server.app).get(`/api/repos/${id}/status`);
    expect(response.body.operation.state).toBe('rebasing');
    expect(response.body.counts.conflicted).toBeGreaterThan(0);

    response = await request(server.app)
      .post(`/api/repos/${id}/exec`)
      .send({ args: ['rebase', '--abort'] });
    expect(response.status).toBe(200);

    response = await request(server.app).get(`/api/repos/${id}/status`);
    expect(response.body.operation).toBeUndefined();
    expect(response.body.clean).toBe(true);
  });
});

describe('rebase, cherry-pick, revert and reset', () => {
  async function createDivergedRepo(): Promise<{ repo: string; featureHash: string }> {
    const repo = await initRepo();
    await writeFile(repo, 'base.txt', 'base\n');
    await commitAll(repo, 'base commit');
    await git(repo, ['checkout', '-q', '-b', 'feature']);
    await writeFile(repo, 'feature.txt', 'feature\n');
    const featureHash = await commitAll(repo, 'feature commit');
    await git(repo, ['checkout', '-q', 'main']);
    await writeFile(repo, 'main.txt', 'main\n');
    await commitAll(repo, 'main commit');
    return { repo, featureHash };
  }

  it('rebases a branch onto main', async () => {
    const { repo } = await createDivergedRepo();
    const id = await openRepo(repo);
    await request(server.app).post(`/api/repos/${id}/branch/checkout`).send({ target: 'feature' });

    const response = await request(server.app).post(`/api/repos/${id}/branch/rebase`).send({ onto: 'main' });
    expect(response.status).toBe(200);
    expect(response.body.result.command).toContain('git rebase main');
    expect(response.body.summary.branch).toBe('feature');

    const log = await request(server.app).get(`/api/repos/${id}/log?limit=1`);
    expect(log.body.commits[0].subject).toBe('feature commit');

    const mergeBase = await git(repo, ['merge-base', 'main', 'feature']);
    const mainHash = (await git(repo, ['rev-parse', 'main'])).trim();
    expect(mergeBase.trim()).toBe(mainHash);
  });

  it('cherry-picks and reverts commits', async () => {
    const { repo, featureHash } = await createDivergedRepo();
    const id = await openRepo(repo);

    let response = await request(server.app)
      .post(`/api/repos/${id}/branch/cherry-pick`)
      .send({ commits: [featureHash] });
    expect(response.status).toBe(200);
    let log = await request(server.app).get(`/api/repos/${id}/log?limit=1`);
    expect(log.body.commits[0].subject).toBe('feature commit');
    const pickedHash = log.body.commits[0].hash as string;

    response = await request(server.app)
      .post(`/api/repos/${id}/branch/revert`)
      .send({ commits: [pickedHash] });
    expect(response.status).toBe(200);
    log = await request(server.app).get(`/api/repos/${id}/log?limit=1`);
    expect(log.body.commits[0].subject).toContain('Revert');
    await expect(fs.access(path.join(repo, 'feature.txt'))).rejects.toBeTruthy();
  });

  it('resets soft and hard', async () => {
    const repo = await initRepo();
    await writeFile(repo, 'one.txt', 'one\n');
    await commitAll(repo, 'first');
    await writeFile(repo, 'two.txt', 'two\n');
    await commitAll(repo, 'second');
    const id = await openRepo(repo);

    let response = await request(server.app)
      .post(`/api/repos/${id}/branch/reset`)
      .send({ target: 'HEAD~1', mode: 'soft' });
    expect(response.status).toBe(200);
    expect(response.body.summary.statusCounts.staged).toBe(1);

    response = await request(server.app)
      .post(`/api/repos/${id}/branch/reset`)
      .send({ target: 'HEAD', mode: 'hard' });
    expect(response.status).toBe(200);
    expect(response.body.summary.statusCounts).toEqual({
      staged: 0,
      unstaged: 0,
      untracked: 0,
      conflicted: 0,
    });

    response = await request(server.app).get(`/api/repos/${id}/log?limit=1`);
    expect(response.body.commits[0].subject).toBe('first');
  });

  it('checks out a detached commit', async () => {
    const { repo } = await createDivergedRepo();
    const id = await openRepo(repo);
    const headHash = (await git(repo, ['rev-parse', 'HEAD'])).trim();

    const response = await request(server.app)
      .post(`/api/repos/${id}/branch/checkout`)
      .send({ target: headHash, detach: true });
    expect(response.status).toBe(200);
    expect(response.body.summary.detached).toBe(true);

    const status = await request(server.app).get(`/api/repos/${id}/status`);
    expect(status.body.detached).toBe(true);
  });
});

describe('remotes and upstream synchronisation', () => {
  it('pushes, fetches and pulls against a real bare remote', async () => {
    const repo = await initRepo();
    await writeFile(repo, 'README.md', 'hello\n');
    await commitAll(repo, 'initial commit');
    const remote = await initBareRepo();
    await git(repo, ['remote', 'add', 'origin', remote]);
    const id = await openRepo(repo);

    let response = await request(server.app)
      .post(`/api/repos/${id}/push`)
      .send({ remote: 'origin', branch: 'main', setUpstream: true });
    expect(response.status).toBe(200);
    expect(response.body.result.command).toContain('git push');

    response = await request(server.app).get(`/api/repos/${id}/branches`);
    const main = response.body.branches.find((branch: { name: string }) => branch.name === 'main');
    expect(main.upstream).toBe('origin/main');
    expect(main.ahead).toBe(0);

    // Clone the remote, commit and push, then fetch/pull into the original repo.
    const cloneParent = await mkTempDir('clone');
    const cloneDir = path.join(cloneParent, 'clone');
    await git(cloneParent, ['clone', '-q', remote, cloneDir]);
    await git(cloneDir, ['config', 'user.name', 'Clone Tester']);
    await git(cloneDir, ['config', 'user.email', 'clone@gitdeck.local']);
    await writeFile(cloneDir, 'from-clone.txt', 'clone change\n');
    await commitAll(cloneDir, 'clone commit');
    await git(cloneDir, ['push', '-q', 'origin', 'main']);

    response = await request(server.app)
      .post(`/api/repos/${id}/fetch`)
      .send({ remote: 'origin', prune: true });
    expect(response.status).toBe(200);

    response = await request(server.app).get(`/api/repos/${id}/status`);
    expect(response.body.behind).toBe(1);

    response = await request(server.app)
      .post(`/api/repos/${id}/pull`)
      .send({ remote: 'origin', branch: 'main', strategy: 'ff-only' });
    expect(response.status).toBe(200);
    expect(await readFile(repo, 'from-clone.txt')).toBe('clone change\n');

    response = await request(server.app).get(`/api/repos/${id}/summary`);
    expect(response.body.behind).toBe(0);
    expect(response.body.ahead).toBe(0);

    // Unset and re-set upstream.
    response = await request(server.app)
      .post(`/api/repos/${id}/branch/upstream`)
      .send({ branch: 'main', remote: null });
    expect(response.status).toBe(200);
    response = await request(server.app).get(`/api/repos/${id}/branches`);
    expect(
      response.body.branches.find((branch: { name: string }) => branch.name === 'main').upstream,
    ).toBeUndefined();

    response = await request(server.app)
      .post(`/api/repos/${id}/branch/upstream`)
      .send({ branch: 'main', remote: 'origin', remoteBranch: 'main' });
    expect(response.status).toBe(200);
    response = await request(server.app).get(`/api/repos/${id}/branches`);
    expect(response.body.branches.find((branch: { name: string }) => branch.name === 'main').upstream).toBe(
      'origin/main',
    );
  });

  it('deletes a remote branch', async () => {
    const repo = await initRepo();
    await writeFile(repo, 'README.md', 'hello\n');
    await commitAll(repo, 'initial commit');
    await git(repo, ['checkout', '-q', '-b', 'doomed']);
    await writeFile(repo, 'doomed.txt', 'extra\n');
    await commitAll(repo, 'extra');
    await git(repo, ['checkout', '-q', 'main']);
    const remote = await initBareRepo();
    await git(repo, ['remote', 'add', 'origin', remote]);
    await git(repo, ['push', '-q', 'origin', 'doomed']);
    const id = await openRepo(repo);

    const response = await request(server.app)
      .post(`/api/repos/${id}/branch/delete`)
      .send({ name: 'doomed', remote: true, force: true });
    expect(response.status).toBe(200);
    expect(response.body.result.command).toContain('--delete');

    const remoteBranches = await git(remote, ['branch', '--list']);
    expect(remoteBranches).not.toContain('doomed');
  });
});

describe('worktrees', () => {
  it('adds, lists, locks and removes worktrees', async () => {
    const repo = await initRepo();
    await writeFile(repo, 'README.md', 'hello\n');
    await commitAll(repo, 'initial commit');
    const id = await openRepo(repo);
    const worktreeParent = await mkTempDir('worktrees');
    const worktreePath = path.join(worktreeParent, 'wt');

    let response = await request(server.app)
      .post(`/api/repos/${id}/worktrees/add`)
      .send({ path: worktreePath, newBranch: 'wt-feature' });
    expect(response.status).toBe(200);
    expect(response.body.result.ok).toBe(true);
    expect(response.body.summary.worktreeCount).toBe(2);

    response = await request(server.app).get(`/api/repos/${id}/worktrees`);
    expect(response.body.worktrees).toHaveLength(2);
    const added = response.body.worktrees.find(
      (worktree: { path: string }) => path.resolve(worktree.path) === path.resolve(worktreePath),
    );
    expect(added).toMatchObject({ name: 'wt', branch: 'wt-feature', isMain: false });

    // Opening the worktree checkout must be detected as a linked worktree.
    const openedWorktree = await request(server.app).post('/api/repos/open').send({ path: worktreePath });
    expect(openedWorktree.status).toBe(200);
    expect(openedWorktree.body.summary.isWorktree).toBe(true);
    expect(path.resolve(openedWorktree.body.summary.path)).toBe(path.resolve(worktreePath));

    response = await request(server.app)
      .post(`/api/repos/${id}/worktrees/lock`)
      .send({ path: worktreePath, lock: true, reason: 'testing' });
    expect(response.status).toBe(200);
    response = await request(server.app).get(`/api/repos/${id}/worktrees`);
    expect(
      response.body.worktrees.find(
        (worktree: { path: string }) => path.resolve(worktree.path) === path.resolve(worktreePath),
      ).locked,
    ).toBe('testing');

    response = await request(server.app)
      .post(`/api/repos/${id}/worktrees/lock`)
      .send({ path: worktreePath, lock: false });
    expect(response.status).toBe(200);

    response = await request(server.app)
      .post(`/api/repos/${id}/worktrees/remove`)
      .send({ path: worktreePath, force: true });
    expect(response.status).toBe(200);
    response = await request(server.app).get(`/api/repos/${id}/worktrees`);
    expect(response.body.worktrees).toHaveLength(1);
  });

  it('prunes stale worktree metadata', async () => {
    const repo = await initRepo();
    await writeFile(repo, 'README.md', 'hello\n');
    await commitAll(repo, 'initial commit');
    const id = await openRepo(repo);
    const worktreeParent = await mkTempDir('worktrees');
    const stalePath = path.join(worktreeParent, 'stale');
    await git(repo, ['worktree', 'add', '-q', '--detach', stalePath]);
    await fs.rm(stalePath, { recursive: true, force: true });

    const response = await request(server.app).post(`/api/repos/${id}/worktrees/prune`).send({});
    expect(response.status).toBe(200);
    expect(response.body.result.command).toContain('git worktree prune');

    const list = await request(server.app).get(`/api/repos/${id}/worktrees`);
    expect(list.body.worktrees).toHaveLength(1);
  });
});

describe('binary and image diffs', () => {
  it('returns data urls for changed images', async () => {
    const repo = await initRepo();
    const before = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489', 'hex');
    const after = Buffer.from('89504e470d0a1a0a0000000d4948445200000002000000020806000000720b0d750', 'hex');
    await fs.mkdir(path.join(repo, 'assets'), { recursive: true });
    await fs.writeFile(path.join(repo, 'assets/logo.png'), before);
    await commitAll(repo, 'add image');
    await fs.writeFile(path.join(repo, 'assets/logo.png'), after);
    const id = await openRepo(repo);

    const response = await request(server.app).get(
      `/api/repos/${id}/diff?scope=worktree&path=${encodeURIComponent('assets/logo.png')}`,
    );
    expect(response.status).toBe(200);
    expect(response.body.files).toHaveLength(1);
    expect(response.body.files[0]).toMatchObject({ path: 'assets/logo.png', binary: true });
    expect(response.body.files[0].imageBefore).toMatch(/^data:image\/png;base64,/);
    expect(response.body.files[0].imageAfter).toMatch(/^data:image\/png;base64,/);
    expect(response.body.files[0].imageBefore).not.toBe(response.body.files[0].imageAfter);
  });
});

describe('auto-open demo repository', () => {
  it('opens the demo repository when the registry is empty', async () => {
    const repo = await initRepo();
    await writeFile(repo, 'README.md', 'demo\n');
    await commitAll(repo, 'demo commit');
    const dataDir = await mkTempDir('demo-data');
    const app = createApp({ dataDir, demoRepoPath: repo, gitEnv: server.gitEnv });

    const home = await request(app).get('/api/home');
    expect(home.status).toBe(200);
    expect(home.body.repos).toHaveLength(1);
    expect(path.resolve(home.body.repos[0].path)).toBe(path.resolve(repo));

    const summary = await request(app).get(`/api/repos/${home.body.repos[0].id}/summary`);
    expect(summary.status).toBe(200);
    expect(summary.body.lastCommit.subject).toBe('demo commit');
  });
});

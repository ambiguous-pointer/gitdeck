import path from 'node:path';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import {
  cleanupTemps,
  createBasicRepo,
  createTestServer,
  git,
  readFile,
  writeFile,
  type TestServer,
} from './helpers';

let server: TestServer;
let repo: string;

beforeEach(async () => {
  server = await createTestServer();
  repo = await createBasicRepo();
});

afterEach(async () => {
  await cleanupTemps();
});

async function openRepo(target = repo): Promise<string> {
  const response = await request(server.app).post('/api/repos/open').send({ path: target });
  expect(response.status).toBe(200);
  return response.body.repo.id as string;
}

describe('health, home and settings', () => {
  it('serves health, home and settings', async () => {
    const health = await request(server.app).get('/api/health');
    expect(health.status).toBe(200);
    expect(health.body.status).toBe('ok');
    expect(health.body.app.gitVersion).toBeTruthy();
    expect(health.body.app.dataDir).toBe(server.dataDir);
    expect(health.body.settings.gitPath).toBe('git');

    const home = await request(server.app).get('/api/home');
    expect(home.status).toBe(200);
    expect(home.body.repos).toEqual([]);
    expect(home.body.settings.locale).toBe('en');

    const settings = await request(server.app).get('/api/settings');
    expect(settings.status).toBe(200);
    expect(settings.body).toMatchObject({ locale: 'en', theme: 'dark', maxScanDepth: 4 });
  });

  it('patches, validates and persists settings', async () => {
    const patch = await request(server.app)
      .patch('/api/settings')
      .send({ locale: 'zh', theme: 'light', accent: '#112233', maxScanDepth: 6 });
    expect(patch.status).toBe(200);
    expect(patch.body).toMatchObject({ locale: 'zh', theme: 'light', accent: '#112233', maxScanDepth: 6 });

    const badAccent = await request(server.app).patch('/api/settings').send({ accent: 'red' });
    expect(badAccent.status).toBe(400);
    expect(badAccent.body.error.code).toBe('VALIDATION_ERROR');

    const unknownKey = await request(server.app).patch('/api/settings').send({ unknown: true });
    expect(unknownKey.status).toBe(400);

    // A brand new app instance must load the persisted settings file.
    const second = createApp({ dataDir: server.dataDir, demoRepoPath: null, gitEnv: server.gitEnv });
    const reloaded = await request(second).get('/api/settings');
    expect(reloaded.body).toMatchObject({ locale: 'zh', theme: 'light', accent: '#112233', maxScanDepth: 6 });
  });
});

describe('repository lifecycle', () => {
  it('opens a repository and exposes summary/status', async () => {
    const response = await request(server.app).post('/api/repos/open').send({ path: repo });
    expect(response.status).toBe(200);
    const body = response.body;
    expect(body.repo.id).toMatch(/^[0-9a-f]{40}$/);
    expect(path.resolve(body.repo.path)).toBe(path.resolve(repo));
    expect(body.summary).toMatchObject({
      id: body.repo.id,
      branch: 'main',
      detached: false,
      unborn: false,
      bare: false,
      isWorktree: false,
      worktreeCount: 1,
      stashCount: 0,
      statusCounts: { staged: 0, unstaged: 0, untracked: 0, conflicted: 0 },
    });
    expect(body.summary.gitDir).toBeTruthy();
    expect(body.summary.commonDir).toBe(body.summary.gitDir);
    expect(body.summary.lastCommit.subject).toBe('update readme');

    const summary = await request(server.app).get(`/api/repos/${body.repo.id}/summary`);
    expect(summary.status).toBe(200);
    expect(summary.body.name).toBe(path.basename(repo));

    const status = await request(server.app).get(`/api/repos/${body.repo.id}/status`);
    expect(status.status).toBe(200);
    expect(status.body).toMatchObject({ branch: 'main', clean: true, stashCount: 0 });
    expect(status.body.counts).toEqual({ staged: 0, unstaged: 0, untracked: 0, conflicted: 0 });

    const repos = await request(server.app).get('/api/repos');
    expect(repos.body.repos).toHaveLength(1);
    expect(repos.body.repos[0].id).toBe(body.repo.id);
  });

  it('normalises a subdirectory to the repository root', async () => {
    const opened = await request(server.app)
      .post('/api/repos/open')
      .send({ path: path.join(repo, 'src') });
    expect(opened.status).toBe(200);
    expect(path.resolve(opened.body.repo.path)).toBe(path.resolve(repo));

    const openedAgain = await request(server.app).post('/api/repos/open').send({ path: repo });
    expect(openedAgain.status).toBe(200);
    expect(openedAgain.body.repo.id).toBe(opened.body.repo.id);
    expect((await request(server.app).get('/api/repos')).body.repos).toHaveLength(1);
  });

  it('removes repositories from the registry and rejects unknown ids', async () => {
    const id = await openRepo();
    const removed = await request(server.app).delete(`/api/repos/${id}`);
    expect(removed.status).toBe(200);
    expect(removed.body).toEqual({ ok: true });
    expect((await request(server.app).get('/api/repos')).body.repos).toEqual([]);

    const unknown = await request(server.app).get('/api/repos/does-not-exist/summary');
    expect(unknown.status).toBe(404);
    expect(unknown.body.error.code).toBe('NOT_FOUND');
  });

  it('rejects non repositories and invalid requests', async () => {
    const missing = await request(server.app)
      .post('/api/repos/open')
      .send({ path: path.join(repo, 'nope') });
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('NOT_FOUND');

    await writeFile(server.dataDir, 'plain-folder/keep.txt', 'x');
    const notRepo = await request(server.app)
      .post('/api/repos/open')
      .send({ path: path.join(server.dataDir, 'plain-folder') });
    expect(notRepo.status).toBe(400);
    expect(notRepo.body.error.code).toBe('NOT_A_REPO');

    const invalid = await request(server.app).post('/api/repos/open').send({ path: '' });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('VALIDATION_ERROR');

    const invalidScan = await request(server.app).post('/api/repos/scan').send({ maxDepth: 99 });
    expect(invalidScan.status).toBe(400);

    const badJson = await request(server.app)
      .post('/api/repos/open')
      .set('Content-Type', 'application/json')
      .send('{not json');
    expect(badJson.status).toBe(400);
    expect(badJson.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('working tree, staging and commits', () => {
  it('stages, unstages, commits and reports status/log/diff', async () => {
    const id = await openRepo();
    await writeFile(repo, 'src/app.txt', 'line1\nline2 changed\n');
    await writeFile(repo, 'new-file.txt', 'brand new\n');

    let response = await request(server.app).get(`/api/repos/${id}/status`);
    expect(response.body.counts).toMatchObject({ staged: 0, unstaged: 1, untracked: 1 });
    expect(response.body.unstaged[0]).toMatchObject({ path: 'src/app.txt', status: 'modified' });
    expect(response.body.untracked[0]).toMatchObject({ path: 'new-file.txt', status: 'untracked' });

    // Worktree diff of a modified tracked file.
    response = await request(server.app).get(`/api/repos/${id}/diff?scope=worktree&path=src/app.txt`);
    expect(response.status).toBe(200);
    expect(response.body.files).toHaveLength(1);
    expect(response.body.files[0]).toMatchObject({ path: 'src/app.txt', status: 'modified', binary: false });
    const addedLines = response.body.files[0].hunks[0].lines.filter(
      (line: { type: string }) => line.type === 'add',
    );
    expect(addedLines.some((line: { content: string }) => line.content === 'line2 changed')).toBe(true);

    // Worktree diff of an untracked file is synthesised from the file content.
    response = await request(server.app).get(`/api/repos/${id}/diff?scope=worktree&path=new-file.txt`);
    expect(response.body.files).toHaveLength(1);
    expect(response.body.files[0]).toMatchObject({ path: 'new-file.txt', status: 'untracked' });
    expect(response.body.files[0].hunks[0].lines[0]).toMatchObject({ type: 'add', content: 'brand new' });

    // Stage one file.
    response = await request(server.app)
      .post(`/api/repos/${id}/stage`)
      .send({ paths: ['src/app.txt'] });
    expect(response.status).toBe(200);
    expect(response.body.result.ok).toBe(true);
    expect(response.body.result.command).toContain('git add');
    expect(response.body.summary.statusCounts.staged).toBe(1);

    response = await request(server.app).get(`/api/repos/${id}/diff?scope=staged`);
    expect(response.body.files.map((file: { path: string }) => file.path)).toEqual(['src/app.txt']);

    // Unstage it again.
    response = await request(server.app)
      .post(`/api/repos/${id}/unstage`)
      .send({ paths: ['src/app.txt'] });
    expect(response.status).toBe(200);
    expect(response.body.summary.statusCounts.staged).toBe(0);

    // Commit everything.
    response = await request(server.app)
      .post(`/api/repos/${id}/commit`)
      .send({ message: 'change app and add file', stageAll: true });
    expect(response.status).toBe(200);
    expect(response.body.result.ok).toBe(true);
    expect(response.body.result.command).toContain('git commit');
    expect(response.body.summary.lastCommit.subject).toBe('change app and add file');
    expect(response.body.summary.statusCounts).toEqual({
      staged: 0,
      unstaged: 0,
      untracked: 0,
      conflicted: 0,
    });

    response = await request(server.app).get(`/api/repos/${id}/log?limit=5`);
    expect(response.status).toBe(200);
    expect(response.body.commits[0].subject).toBe('change app and add file');
    expect(response.body.head).toBeTruthy();
    expect(response.body.hasMore).toBe(false);
    const headHash = response.body.commits[0].hash as string;

    response = await request(server.app).get(`/api/repos/${id}/commits/${headHash}`);
    expect(response.status).toBe(200);
    expect(response.body.commit.hash).toBe(headHash);
    expect(response.body.stats.filesChanged).toBe(2);
    expect(response.body.files.map((file: { path: string }) => file.path).sort()).toEqual([
      'new-file.txt',
      'src/app.txt',
    ]);

    response = await request(server.app).get(`/api/repos/${id}/commits/${headHash}/diff`);
    expect(response.status).toBe(200);
    expect(response.body.files).toHaveLength(2);

    response = await request(server.app).get(`/api/repos/${id}/diff?scope=commit&from=${headHash}`);
    expect(response.status).toBe(200);
    expect(response.body.files).toHaveLength(2);

    response = await request(server.app).get(
      `/api/repos/${id}/diff?scope=range&from=${headHash}~1&to=${headHash}&path=src/app.txt`,
    );
    expect(response.status).toBe(200);
    expect(response.body.files).toHaveLength(1);

    // The root commit of a repository is diffed against the empty tree.
    const log = await request(server.app).get(`/api/repos/${id}/log?limit=10`);
    const rootHash = log.body.commits[log.body.commits.length - 1].hash as string;
    const rootDetail = await request(server.app).get(`/api/repos/${id}/commits/${rootHash}`);
    expect(rootDetail.status).toBe(200);
    expect(rootDetail.body.commit.subject).toBe('initial commit');
    expect(rootDetail.body.files.map((file: { path: string }) => file.path).sort()).toEqual([
      'README.md',
      'src/app.txt',
    ]);
    const rootDiff = await request(server.app).get(`/api/repos/${id}/commits/${rootHash}/diff`);
    expect(rootDiff.status).toBe(200);
    expect(rootDiff.body.files).toHaveLength(2);

    const badHash = await request(server.app).get(`/api/repos/${id}/commits/--help`);
    expect(badHash.status).toBe(400);
  });

  it('amends commits and rejects empty commit attempts with git details', async () => {
    const id = await openRepo();
    await writeFile(repo, 'amend.txt', 'one\n');
    let response = await request(server.app)
      .post(`/api/repos/${id}/commit`)
      .send({ message: 'first', stageAll: true, signoff: true });
    expect(response.status).toBe(200);

    await writeFile(repo, 'amend.txt', 'two\n');
    response = await request(server.app)
      .post(`/api/repos/${id}/commit`)
      .send({ message: 'first amended', stageAll: true, amend: true });
    expect(response.status).toBe(200);
    expect(response.body.summary.lastCommit.subject).toBe('first amended');

    response = await request(server.app).get(`/api/repos/${id}/log?limit=2`);
    expect(response.body.commits).toHaveLength(2);

    response = await request(server.app).post(`/api/repos/${id}/commit`).send({ message: 'nothing staged' });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('GIT_ERROR');
    const details = response.body.error.details;
    expect(`${details.stdout}\n${details.stderr}`).toContain('nothing to commit');
  });

  it('discards tracked and untracked changes', async () => {
    const id = await openRepo();
    await writeFile(repo, 'README.md', '# GitDeck\nchanged\n');
    await writeFile(repo, 'scratch.txt', 'temp\n');

    let response = await request(server.app)
      .post(`/api/repos/${id}/discard`)
      .send({ paths: ['README.md', 'scratch.txt'], untracked: true });
    expect(response.status).toBe(200);
    expect(response.body.result.ok).toBe(true);
    expect(await readFile(repo, 'README.md')).toBe('# GitDeck\n\nupdated readme\n');

    const status = await request(server.app).get(`/api/repos/${id}/status`);
    expect(status.body.clean).toBe(true);
  });

  it('paginates, searches and filters the log', async () => {
    const id = await openRepo();

    let response = await request(server.app).get(`/api/repos/${id}/log?limit=1`);
    expect(response.body.commits).toHaveLength(1);
    expect(response.body.hasMore).toBe(true);

    response = await request(server.app).get(`/api/repos/${id}/log?limit=1&skip=1`);
    expect(response.body.commits).toHaveLength(1);
    expect(response.body.commits[0].subject).toBe('initial commit');

    response = await request(server.app).get(`/api/repos/${id}/log?search=readme`);
    expect(response.body.commits.map((commit: { subject: string }) => commit.subject)).toContain(
      'update readme',
    );

    response = await request(server.app).get(`/api/repos/${id}/log?all=true&search=feature`);
    expect(response.body.commits.map((commit: { subject: string }) => commit.subject)).toContain(
      'add feature',
    );

    response = await request(server.app).get(`/api/repos/${id}/log?branch=feature`);
    expect(response.body.commits[0].subject).toBe('add feature');
    expect(response.body.commits[0].refs.some((ref: { label: string }) => ref.label === 'feature')).toBe(
      true,
    );

    response = await request(server.app).get(`/api/repos/${id}/log?branch=${encodeURIComponent('--help')}`);
    expect([400, 200]).toContain(response.status);
  });
});

describe('branches, tags, stashes', () => {
  it('creates, renames, checks out, merges and deletes branches', async () => {
    const id = await openRepo();

    let response = await request(server.app).get(`/api/repos/${id}/branches`);
    expect(response.status).toBe(200);
    expect(response.body.branches.map((branch: { name: string }) => branch.name)).toEqual([
      'main',
      'feature',
    ]);
    expect(response.body.branches[0]).toMatchObject({ current: true, isRemote: false });
    expect(response.body.branches[0].tipSubject).toBe('update readme');

    response = await request(server.app)
      .post(`/api/repos/${id}/branch/create`)
      .send({ name: 'temp-branch', startPoint: 'main', checkout: true });
    expect(response.status).toBe(200);
    expect(response.body.summary.branch).toBe('temp-branch');

    response = await request(server.app)
      .post(`/api/repos/${id}/branch/rename`)
      .send({ from: 'temp-branch', to: 'temp-branch-2' });
    expect(response.status).toBe(200);

    response = await request(server.app).post(`/api/repos/${id}/branch/checkout`).send({ target: 'main' });
    expect(response.status).toBe(200);
    expect(response.body.summary.branch).toBe('main');

    response = await request(server.app)
      .post(`/api/repos/${id}/branch/delete`)
      .send({ name: 'temp-branch-2', force: true });
    expect(response.status).toBe(200);

    response = await request(server.app)
      .post(`/api/repos/${id}/branch/merge`)
      .send({ branch: 'feature', noFf: true, message: 'merge feature' });
    expect(response.status).toBe(200);
    expect(response.body.result.command).toContain('git merge');

    response = await request(server.app).get(`/api/repos/${id}/log?limit=1`);
    expect(response.body.commits[0].subject).toBe('merge feature');
    expect(response.body.commits[0].parents).toHaveLength(2);

    response = await request(server.app)
      .post(`/api/repos/${id}/branch/delete`)
      .send({ name: 'feature', force: true });
    expect(response.status).toBe(200);
    response = await request(server.app).get(`/api/repos/${id}/branches`);
    expect(response.body.branches.map((branch: { name: string }) => branch.name)).toEqual(['main']);
  });

  it('creates and deletes annotated and lightweight tags', async () => {
    const id = await openRepo();

    let response = await request(server.app)
      .post(`/api/repos/${id}/tags`)
      .send({ name: 'v1.0.0', message: 'release one' });
    expect(response.status).toBe(200);
    expect(response.body.result.command).toContain('git tag');

    response = await request(server.app).post(`/api/repos/${id}/tags`).send({ name: 'light' });
    expect(response.status).toBe(200);

    response = await request(server.app).get(`/api/repos/${id}/tags`);
    expect(response.status).toBe(200);
    expect(response.body.tags).toHaveLength(2);
    const annotated = response.body.tags.find((tag: { name: string }) => tag.name === 'v1.0.0');
    const lightweight = response.body.tags.find((tag: { name: string }) => tag.name === 'light');
    expect(annotated).toMatchObject({ annotated: true, subject: 'release one' });
    expect(lightweight).toMatchObject({ annotated: false });
    expect(annotated.hash).toMatch(/^[0-9a-f]{40}$/);
    expect(lightweight.hash).toMatch(/^[0-9a-f]{40}$/);

    response = await request(server.app).post(`/api/repos/${id}/tags/delete`).send({ name: 'v1.0.0' });
    expect(response.status).toBe(200);
    response = await request(server.app).get(`/api/repos/${id}/tags`);
    expect(response.body.tags).toHaveLength(1);
  });

  it('creates, inspects, applies, pops and drops stashes', async () => {
    const id = await openRepo();
    await writeFile(repo, 'README.md', '# GitDeck\nstash me\n');

    let response = await request(server.app).post(`/api/repos/${id}/stashes`).send({ message: 'wip readme' });
    expect(response.status).toBe(200);
    expect(response.body.result.ok).toBe(true);
    expect(response.body.summary.stashCount).toBe(1);

    response = await request(server.app).get(`/api/repos/${id}/stashes`);
    expect(response.body.stashes).toHaveLength(1);
    expect(response.body.stashes[0]).toMatchObject({ index: 0, branch: 'main' });
    expect(response.body.stashes[0].message).toContain('wip readme');

    response = await request(server.app).get(`/api/repos/${id}/stashes/0/show`);
    expect(response.status).toBe(200);
    expect(response.body.result.command).toContain('git stash show');
    expect(response.body.diff).toHaveLength(1);
    expect(response.body.diff[0].path).toBe('README.md');

    response = await request(server.app).post(`/api/repos/${id}/stashes/pop`).send({ index: 0 });
    expect(response.status).toBe(200);
    expect(await readFile(repo, 'README.md')).toContain('stash me');
    response = await request(server.app).get(`/api/repos/${id}/stashes`);
    expect(response.body.stashes).toHaveLength(0);

    response = await request(server.app).post(`/api/repos/${id}/stashes`).send({});
    expect(response.status).toBe(200);
    response = await request(server.app).post(`/api/repos/${id}/stashes/apply`).send({ index: 0 });
    expect(response.status).toBe(200);
    response = await request(server.app).post(`/api/repos/${id}/stashes/drop`).send({ index: 0 });
    expect(response.status).toBe(200);
    response = await request(server.app).get(`/api/repos/${id}/stashes`);
    expect(response.body.stashes).toHaveLength(0);
  });
});

describe('remotes, config, exec and reflog', () => {
  it('adds, updates and removes remotes and reads config scopes', async () => {
    const id = await openRepo();

    let response = await request(server.app)
      .post(`/api/repos/${id}/remotes/add`)
      .send({ name: 'origin', url: 'C:/repos/remote.git', pushUrl: 'C:/repos/remote-push.git' });
    expect(response.status).toBe(200);
    expect(response.body.result.command).toContain('git remote add');

    response = await request(server.app).get(`/api/repos/${id}/remotes`);
    expect(response.body.remotes).toEqual([
      { name: 'origin', fetchUrl: 'C:/repos/remote.git', pushUrl: 'C:/repos/remote-push.git' },
    ]);

    response = await request(server.app)
      .post(`/api/repos/${id}/remotes/update`)
      .send({ name: 'origin', url: 'C:/repos/remote2.git' });
    expect(response.status).toBe(200);
    response = await request(server.app).get(`/api/repos/${id}/remotes`);
    expect(response.body.remotes[0].fetchUrl).toBe('C:/repos/remote2.git');

    response = await request(server.app)
      .post(`/api/repos/${id}/config/set`)
      .send({ scope: 'local', key: 'user.name', value: 'Local Name' });
    expect(response.status).toBe(200);
    response = await request(server.app)
      .post(`/api/repos/${id}/config/set`)
      .send({ scope: 'global', key: 'user.name', value: 'Global Name' });
    expect(response.status).toBe(200);

    response = await request(server.app).get(`/api/repos/${id}/config?scope=local`);
    expect(response.status).toBe(200);
    expect(response.body.entries).toContainEqual({ key: 'user.name', value: 'Local Name', scope: 'local' });

    response = await request(server.app).get(`/api/repos/${id}/config?scope=global`);
    expect(response.body.entries).toContainEqual({ key: 'user.name', value: 'Global Name', scope: 'global' });

    response = await request(server.app)
      .post(`/api/repos/${id}/config/unset`)
      .send({ scope: 'local', key: 'user.name' });
    expect(response.status).toBe(200);

    response = await request(server.app).get(`/api/repos/${id}/config?scope=all`);
    expect(
      response.body.entries.some(
        (entry: { key: string; scope: string }) => entry.key === 'user.name' && entry.scope === 'local',
      ),
    ).toBe(false);

    response = await request(server.app).post(`/api/repos/${id}/remotes/remove`).send({ name: 'origin' });
    expect(response.status).toBe(200);
    response = await request(server.app).get(`/api/repos/${id}/remotes`);
    expect(response.body.remotes).toEqual([]);

    response = await request(server.app).get(`/api/repos/${id}/config?scope=bogus`);
    expect(response.status).toBe(400);
  });

  it('runs allowlisted exec commands and rejects others', async () => {
    const id = await openRepo();

    let response = await request(server.app)
      .post(`/api/repos/${id}/exec`)
      .send({ args: ['status', '--porcelain'] });
    expect(response.status).toBe(200);
    expect(response.body.result.command).toBe('git status --porcelain');
    expect(response.body.result.ok).toBe(true);

    response = await request(server.app)
      .post(`/api/repos/${id}/exec`)
      .send({ args: ['gc'] });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');

    await writeFile(repo, 'exec.txt', 'via exec\n');
    response = await request(server.app)
      .post(`/api/repos/${id}/exec`)
      .send({ args: ['add', '-A'] });
    expect(response.body.result.ok).toBe(true);
    response = await request(server.app)
      .post(`/api/repos/${id}/exec`)
      .send({ args: ['commit', '-m', 'commit via exec'] });
    expect(response.body.result.ok).toBe(true);
    response = await request(server.app).get(`/api/repos/${id}/log?limit=1`);
    expect(response.body.commits[0].subject).toBe('commit via exec');
  });

  it('returns the reflog', async () => {
    const id = await openRepo();
    const response = await request(server.app).get(`/api/repos/${id}/reflog?limit=10`);
    expect(response.status).toBe(200);
    expect(response.body.result.command).toContain('git reflog');
    expect(response.body.commits.length).toBeGreaterThan(0);
    expect(response.body.commits[0].hash).toMatch(/^[0-9a-f]{40}$/);
  });
});

describe('scan', () => {
  it('discovers repositories and worktrees recursively while skipping noise', async () => {
    const root = path.join(server.dataDir, 'scan-root');
    const repoA = path.join(root, 'repo-a');
    const repoB = path.join(root, 'nested', 'repo-b');
    const hidden = path.join(root, '.hidden-repo');
    const noisy = path.join(root, 'node_modules', 'pkg');
    for (const target of [repoA, repoB, hidden, noisy]) {
      await writeFile(target, 'seed.txt', 'x\n');
      await git(target, ['init', '-q', '-b', 'main']);
      await git(target, ['config', 'user.name', 'Scan Tester']);
      await git(target, ['config', 'user.email', 'scan@gitdeck.local']);
      await git(target, ['add', '-A']);
      await git(target, ['commit', '-q', '-m', 'init']);
    }
    const worktreePath = path.join(root, 'worktrees', 'wt');
    await git(repoA, ['worktree', 'add', '-q', '-b', 'wt-branch', worktreePath]);

    const response = await request(server.app)
      .post('/api/repos/scan')
      .send({ roots: [root], maxDepth: 6 });
    expect(response.status).toBe(200);
    expect(response.body.roots).toEqual([root]);
    const found = response.body.found as Array<{ path: string; kind: string }>;
    const byName = new Map(found.map((entry) => [path.basename(entry.path), entry]));
    expect(byName.get('repo-a')?.kind).toBe('repository');
    expect(byName.get('repo-b')?.kind).toBe('repository');
    expect(byName.get('wt')?.kind).toBe('worktree');
    expect(byName.has('.hidden-repo')).toBe(false);
    expect(byName.has('pkg')).toBe(false);
    expect(response.body.durationMs).toBeGreaterThanOrEqual(0);
  });
});

#!/usr/bin/env node
/**
 * End-to-end API smoke test for a running GitDeck server.
 *
 *   node scripts/smoke-api.mjs [http://127.0.0.1:4319]
 *
 * Opens the seeded demo repository and exercises the read APIs plus a few safe
 * write operations (stage/unstage a scratch file), then reports pass/fail.
 */
const base = process.argv[2] ?? 'http://127.0.0.1:4319';
const demoPath = new URL('../.demo/gitdeck-demo', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

const results = [];
let repoId = null;

async function call(method, path, body) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = text;
  }
  return { status: response.status, payload };
}

async function check(name, fn) {
  try {
    const detail = await fn();
    results.push({ name, ok: true, detail });
    console.log(`  PASS  ${name}${detail ? `  — ${detail}` : ''}`);
  } catch (error) {
    results.push({ name, ok: false, detail: error.message });
    console.log(`  FAIL  ${name}  — ${error.message}`);
  }
}

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  console.log(`GitDeck API smoke test against ${base}\n`);

  await check('GET /api/health', async () => {
    const { status, payload } = await call('GET', '/api/health');
    expect(status === 200, `HTTP ${status}`);
    expect(payload?.status === 'ok', 'status != ok');
    return `git ${payload?.app?.gitVersion ?? '?'} · node ${payload?.app?.nodeVersion ?? '?'}`;
  });

  await check('GET /api/home', async () => {
    const { status, payload } = await call('GET', '/api/home');
    expect(status === 200, `HTTP ${status}`);
    expect(Array.isArray(payload?.repos), 'repos is not an array');
    expect(payload?.settings, 'missing settings');
    return `${payload.repos.length} repos · scanRoots ${payload.settings.scanRoots?.length ?? 0}`;
  });

  await check('POST /api/repos/scan', async () => {
    const { status, payload } = await call('POST', '/api/repos/scan', {});
    expect(status === 200, `HTTP ${status}`);
    expect(Array.isArray(payload?.found), 'found is not an array');
    const kinds = payload.found.map((item) => item.kind);
    return `${payload.found.length} found (${kinds.filter((k) => k === 'worktree').length} worktrees)`;
  });

  await check('POST /api/repos/open (demo)', async () => {
    const { status, payload } = await call('POST', '/api/repos/open', { path: demoPath });
    expect(status === 200, `HTTP ${status}: ${JSON.stringify(payload)}`);
    expect(payload?.repo?.id, 'missing repo id');
    expect(payload?.summary?.branch, 'missing summary branch');
    repoId = payload.repo.id;
    return `${payload.repo.name} @ ${payload.summary.branch}`;
  });

  const repo = (suffix) => `/api/repos/${repoId}${suffix}`;

  await check('GET summary', async () => {
    const { payload } = await call('GET', repo('/summary'));
    expect(payload?.statusCounts, 'missing statusCounts');
    return `${payload.branch} · +${payload.ahead}/-${payload.behind} · ${payload.worktreeCount} worktrees`;
  });

  await check('GET status', async () => {
    const { payload } = await call('GET', repo('/status'));
    expect(Array.isArray(payload?.unstaged) && Array.isArray(payload?.staged), 'bad status shape');
    return `${payload.staged.length} staged / ${payload.unstaged.length} unstaged / ${payload.untracked.length} untracked`;
  });

  await check('GET log', async () => {
    const { payload } = await call('GET', repo('/log?limit=50&all=true'));
    expect(Array.isArray(payload?.commits) && payload.commits.length > 10, 'expected >10 commits');
    expect(payload.commits[0].refs, 'missing refs');
    return `${payload.commits.length} commits`;
  });

  await check('GET commit detail + diff', async () => {
    const { payload: log } = await call('GET', repo('/log?limit=5'));
    const hash = log.commits[0].hash;
    const detail = await call('GET', repo(`/commits/${hash}`));
    expect(detail.payload?.commit?.hash === hash, 'commit mismatch');
    expect(Array.isArray(detail.payload?.files), 'missing files');
    const diff = await call('GET', repo(`/diff?scope=commit&from=${hash}`));
    expect(Array.isArray(diff.payload?.files), 'missing diff files');
    return `${detail.payload.files.length} files · diff files ${diff.payload.files.length}`;
  });

  await check('GET branches/remotes/tags/stashes/worktrees', async () => {
    const [branches, remotes, tags, stashes, worktrees] = await Promise.all([
      call('GET', repo('/branches')),
      call('GET', repo('/remotes')),
      call('GET', repo('/tags')),
      call('GET', repo('/stashes')),
      call('GET', repo('/worktrees')),
    ]);
    expect(branches.payload?.branches?.length >= 5, 'expected >=5 branches');
    expect(remotes.payload?.remotes?.some((remote) => remote.name === 'origin'), 'missing origin');
    expect(tags.payload?.tags?.length >= 2, 'expected >=2 tags');
    expect(stashes.payload?.stashes?.length >= 1, 'expected stashes');
    expect(worktrees.payload?.worktrees?.length >= 2, 'expected >=2 worktrees');
    return `${branches.payload.branches.length} branches · ${tags.payload.tags.length} tags · ${stashes.payload.stashes.length} stashes · ${worktrees.payload.worktrees.length} worktrees`;
  });

  await check('GET config', async () => {
    const { payload } = await call('GET', repo('/config?scope=all'));
    expect(Array.isArray(payload?.entries), 'missing entries');
    return `${payload.entries.length} entries`;
  });

  await check('stage + unstage scratch file', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const scratch = path.join(demoPath, 'smoke-scratch.txt');
    fs.writeFileSync(scratch, `smoke ${Date.now()}\n`);
    const staged = await call('POST', repo('/stage'), { paths: ['smoke-scratch.txt'] });
    expect(staged.payload?.result?.ok, `stage failed: ${JSON.stringify(staged.payload)}`);
    const status = await call('GET', repo('/status'));
    expect(status.payload.staged.some((file) => file.path === 'smoke-scratch.txt'), 'file not staged');
    const unstaged = await call('POST', repo('/unstage'), { paths: ['smoke-scratch.txt'] });
    expect(unstaged.payload?.result?.ok, 'unstage failed');
    fs.rmSync(scratch, { force: true });
    return 'ok';
  });

  await check('GET stash show (if any)', async () => {
    const { payload } = await call('GET', repo('/stashes'));
    if (!payload?.stashes?.length) return 'no stashes (skipped)';
    const shown = await call('GET', repo(`/stashes/${payload.stashes[0].index}/show`));
    expect(Array.isArray(shown.payload?.diff), 'missing diff');
    return `${shown.payload.diff.length} files`;
  });

  await check('GET settings', async () => {
    const { payload } = await call('GET', '/api/settings');
    expect(payload?.scanRoots !== undefined, 'missing scanRoots');
    return `locale ${payload.locale} · theme ${payload.theme}`;
  });

  await check('POST /api/repos/close', async () => {
    const { status, payload } = await call('DELETE', `/api/repos/${repoId}`);
    expect(status === 200 && payload?.ok, `HTTP ${status}`);
    return 'closed';
  });

  const failed = results.filter((result) => !result.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DiffHunk, DiffLine, FileDiff } from '@gitdeck/shared';
import {
  MAX_DIFF_CONTEXT,
  MAX_FILE_DIFF_BYTES,
  MAX_TOTAL_DIFF_BYTES,
  MIN_DIFF_CONTEXT,
  clampDiffContext,
  estimateFileDiffBytes,
  limitDiffPayload,
} from '../git/diff';
import {
  cleanupTemps,
  createTestServer,
  git,
  initRepo,
  commitAll,
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

/** Repository with a few multi-line text files and two commits on main. */
async function createDiffRepo(): Promise<string> {
  const repo = await initRepo();
  await writeFile(repo, 'alpha.txt', 'one\ntwo\nthree\nfour\nfive\n');
  await writeFile(repo, 'beta.txt', 'b1\nb2\nb3\n');
  await writeFile(repo, 'gamma.txt', 'g1\ng2\ng3\n');
  await commitAll(repo, 'initial commit');
  await writeFile(repo, 'delta.txt', 'd1\nd2\n');
  await commitAll(repo, 'second commit');
  return repo;
}

/* ------------------------------------------------------------------ */
/* Unified payload shape assertions (the contract the web client uses) */
/* ------------------------------------------------------------------ */

const FILE_STATUSES = [
  'added',
  'modified',
  'deleted',
  'renamed',
  'copied',
  'untracked',
  'conflicted',
  'typechange',
  'ignored',
];

const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

/**
 * Assert the classic unified-diff payload: `hunks[].lines[]` with
 * `context | add | del` and consistent old/new line numbering.
 */
function expectUnifiedDiffPayload(files: FileDiff[]): void {
  expect(Array.isArray(files)).toBe(true);
  for (const file of files) {
    expect(typeof file.path).toBe('string');
    expect(file.path.length).toBeGreaterThan(0);
    expect(FILE_STATUSES).toContain(file.status);
    expect(typeof file.binary).toBe('boolean');
    expect(Array.isArray(file.hunks)).toBe(true);
    if (file.binary) expect(file.hunks).toEqual([]);

    for (const hunk of file.hunks) {
      assertHunk(hunk);
    }
  }
}

function assertHunk(hunk: DiffHunk): void {
  const match = HUNK_HEADER.exec(hunk.header);
  expect(match, `invalid hunk header: ${hunk.header}`).toBeTruthy();
  expect(Array.isArray(hunk.lines)).toBe(true);

  let oldLine = Number.parseInt(match?.[1] ?? '0', 10);
  let newLine = Number.parseInt(match?.[3] ?? '0', 10);
  for (const line of hunk.lines) {
    assertLine(line);
    if (line.type === 'context') {
      expect(line.oldLine).toBe(oldLine);
      expect(line.newLine).toBe(newLine);
      oldLine += 1;
      newLine += 1;
    } else if (line.type === 'add') {
      expect(line.newLine).toBe(newLine);
      newLine += 1;
    } else {
      expect(line.oldLine).toBe(oldLine);
      oldLine += 1;
    }
  }
}

function assertLine(line: DiffLine): void {
  expect(['context', 'add', 'del']).toContain(line.type);
  expect(typeof line.content).toBe('string');
  if (line.type === 'context') {
    expect(typeof line.oldLine).toBe('number');
    expect(typeof line.newLine).toBe('number');
  } else if (line.type === 'add') {
    expect(typeof line.newLine).toBe('number');
    expect(line.oldLine).toBeUndefined();
  } else {
    expect(typeof line.oldLine).toBe('number');
    expect(line.newLine).toBeUndefined();
  }
}

/* ------------------------------------------------------------------ */
/* Integration: scope × context matrix                                 */
/* ------------------------------------------------------------------ */

describe('GET /repos/:id/diff — unified payload contract', () => {
  it('returns several files for scope=worktree and honours an explicit context', async () => {
    const repo = await createDiffRepo();
    await writeFile(repo, 'alpha.txt', 'one\ntwo changed\nthree\nfour\nfive\n');
    await writeFile(repo, 'beta.txt', 'b1\nb2 changed\nb3\n');
    const id = await openRepo(repo);

    const response = await request(server.app).get(`/api/repos/${id}/diff?scope=worktree&context=1`);
    expect(response.status).toBe(200);
    const files = response.body.files as FileDiff[];
    expect(files.map((file) => file.path)).toEqual(['alpha.txt', 'beta.txt']);
    expectUnifiedDiffPayload(files);

    // -U1 around line 2 yields exactly: context, del, add, context.
    const alpha = files[0]!;
    expect(alpha.status).toBe('modified');
    expect(alpha.binary).toBe(false);
    expect(alpha.hunks).toHaveLength(1);
    expect(alpha.hunks[0]!.header).toBe('@@ -1,3 +1,3 @@');
    expect(alpha.hunks[0]!.lines).toEqual([
      { type: 'context', content: 'one', oldLine: 1, newLine: 1 },
      { type: 'del', content: 'two', oldLine: 2 },
      { type: 'add', content: 'two changed', newLine: 2 },
      { type: 'context', content: 'three', oldLine: 3, newLine: 3 },
    ]);
  });

  it('honours context for scope=staged', async () => {
    const repo = await createDiffRepo();
    await writeFile(repo, 'gamma.txt', 'g1\ng2 changed\ng3\n');
    await git(repo, ['add', 'gamma.txt']);
    const id = await openRepo(repo);

    const compact = await request(server.app).get(`/api/repos/${id}/diff?scope=staged&context=0`);
    expect(compact.status).toBe(200);
    const compactFiles = compact.body.files as FileDiff[];
    expect(compactFiles).toHaveLength(1);
    expectUnifiedDiffPayload(compactFiles);
    const compactLines = compactFiles[0]!.hunks.flatMap((hunk) => hunk.lines);
    expect(compactLines.length).toBeGreaterThan(0);
    expect(compactLines.every((line) => line.type !== 'context')).toBe(true);

    const wide = await request(server.app).get(`/api/repos/${id}/diff?scope=staged&context=2`);
    expect(wide.status).toBe(200);
    const wideFiles = wide.body.files as FileDiff[];
    expectUnifiedDiffPayload(wideFiles);
    const wideLines = wideFiles[0]!.hunks.flatMap((hunk) => hunk.lines);
    expect(wideLines.filter((line) => line.type === 'context').length).toBeGreaterThan(0);
  });

  it('honours context for scope=commit and keeps /commits/:hash/diff unified', async () => {
    const repo = await createDiffRepo();
    await writeFile(repo, 'gamma.txt', 'g1\ng2 changed\ng3\n');
    await commitAll(repo, 'change gamma');
    const hash = (await git(repo, ['rev-parse', 'HEAD'])).trim();
    const id = await openRepo(repo);

    const compact = await request(server.app).get(
      `/api/repos/${id}/diff?scope=commit&from=${hash}&context=0`,
    );
    expect(compact.status).toBe(200);
    const compactFiles = compact.body.files as FileDiff[];
    expect(compactFiles).toHaveLength(1);
    expectUnifiedDiffPayload(compactFiles);
    expect(
      compactFiles[0]!.hunks.flatMap((hunk) => hunk.lines).every((line) => line.type !== 'context'),
    ).toBe(true);

    const wide = await request(server.app).get(`/api/repos/${id}/diff?scope=commit&from=${hash}&context=2`);
    expect(wide.status).toBe(200);
    const wideFiles = wide.body.files as FileDiff[];
    expectUnifiedDiffPayload(wideFiles);
    expect(wideFiles[0]!.hunks.flatMap((hunk) => hunk.lines).some((line) => line.type === 'context')).toBe(
      true,
    );

    const commitDiff = await request(server.app).get(`/api/repos/${id}/commits/${hash}/diff`);
    expect(commitDiff.status).toBe(200);
    expectUnifiedDiffPayload(commitDiff.body.files as FileDiff[]);
  });

  it('honours context for scope=range', async () => {
    const repo = await createDiffRepo();
    const first = (await git(repo, ['rev-parse', 'HEAD'])).trim();
    await writeFile(repo, 'alpha.txt', 'one\ntwo changed\nthree\nfour\nfive\n');
    await writeFile(repo, 'beta.txt', 'b1\nb2 changed\nb3\n');
    await commitAll(repo, 'second commit');
    const id = await openRepo(repo);

    const response = await request(server.app).get(
      `/api/repos/${id}/diff?scope=range&from=${first}&to=HEAD&context=1`,
    );
    expect(response.status).toBe(200);
    const files = response.body.files as FileDiff[];
    expect(files.map((file) => file.path)).toEqual(['alpha.txt', 'beta.txt']);
    expectUnifiedDiffPayload(files);
    const lines = files.flatMap((file) => file.hunks.flatMap((hunk) => hunk.lines));
    expect(lines.some((line) => line.type === 'context')).toBe(true);
  });

  it('validates the context query parameter bounds for every scope', async () => {
    const repo = await createDiffRepo();
    const head = (await git(repo, ['rev-parse', 'HEAD'])).trim();
    const id = await openRepo(repo);
    const url = (scope: string, extra: string): string => `/api/repos/${id}/diff?scope=${scope}${extra}`;

    const scopedExtras: Record<string, string> = {
      worktree: '',
      staged: '',
      commit: `&from=${head}`,
      range: `&from=${head}~1&to=${head}`,
    };
    for (const [scope, extra] of Object.entries(scopedExtras)) {
      expect((await request(server.app).get(url(scope, extra))).status, scope).toBe(200);
      expect((await request(server.app).get(url(scope, `${extra}&context=0`))).status, scope).toBe(200);
      expect(
        (await request(server.app).get(url(scope, `${extra}&context=${MAX_DIFF_CONTEXT}`))).status,
        scope,
      ).toBe(200);

      for (const bad of ['-1', `${MAX_DIFF_CONTEXT + 1}`, 'abc', '1.5']) {
        const rejected = await request(server.app).get(url(scope, `${extra}&context=${bad}`));
        expect(rejected.status, `${scope} context=${bad}`).toBe(400);
        expect(rejected.body.error.code).toBe('VALIDATION_ERROR');
      }
    }

    const invertedRange = await request(server.app).get(`/api/repos/${id}/diff?scope=range&context=1`);
    expect(invertedRange.status).toBe(400);
    expect(invertedRange.body.error.code).toBe('VALIDATION_ERROR');
  });
});

/* ------------------------------------------------------------------ */
/* Integration: payload guard                                          */
/* ------------------------------------------------------------------ */

describe('diff payload guard', () => {
  it('caps an oversized file but still returns its metadata entry', async () => {
    const repo = await initRepo();
    await writeFile(repo, 'huge.txt', 'small\n');
    await commitAll(repo, 'add huge file');
    const hugeLine = 'x'.repeat(1_200_000);
    await writeFile(repo, 'huge.txt', hugeLine);
    const id = await openRepo(repo);

    const response = await request(server.app).get(`/api/repos/${id}/diff?scope=worktree&path=huge.txt`);
    expect(response.status).toBe(200);
    const files = response.body.files as FileDiff[];
    expect(files).toHaveLength(1);
    expect(files[0]).toMatchObject({ path: 'huge.txt', status: 'modified', binary: false });
    expect(files[0]!.hunks).toEqual([]);
    // The response must stay far below the file size (metadata only).
    expect(JSON.stringify(response.body).length).toBeLessThan(64 * 1024);
  });

  it('caps oversized commit diffs as well', async () => {
    const repo = await initRepo();
    await writeFile(repo, 'huge.txt', 'small\n');
    await commitAll(repo, 'add huge file');
    await writeFile(repo, 'huge.txt', 'y'.repeat(1_200_000));
    await commitAll(repo, 'grow huge file');
    const hash = (await git(repo, ['rev-parse', 'HEAD'])).trim();
    const id = await openRepo(repo);

    const response = await request(server.app).get(`/api/repos/${id}/diff?scope=commit&from=${hash}`);
    expect(response.status).toBe(200);
    const files = response.body.files as FileDiff[];
    expect(files).toHaveLength(1);
    expect(files[0]).toMatchObject({ path: 'huge.txt', status: 'modified' });
    expect(files[0]!.hunks).toEqual([]);
    expect(JSON.stringify(response.body).length).toBeLessThan(64 * 1024);
  });
});

/* ------------------------------------------------------------------ */
/* Unit: limits, clamping and the guard itself                         */
/* ------------------------------------------------------------------ */

function makeFile(path: string, content: string): FileDiff {
  return {
    path,
    status: 'modified',
    binary: false,
    hunks: [
      {
        header: '@@ -1 +1 @@',
        lines: [{ type: 'add', content, newLine: 1 }],
      },
    ],
  };
}

describe('diff payload guard (unit)', () => {
  it('exposes the documented default limits', () => {
    expect(MIN_DIFF_CONTEXT).toBe(0);
    expect(MAX_DIFF_CONTEXT).toBe(1000);
    expect(MAX_FILE_DIFF_BYTES).toBe(1024 * 1024);
    expect(MAX_TOTAL_DIFF_BYTES).toBe(8 * 1024 * 1024);
    expect(clampDiffContext(undefined)).toBe(3);
    expect(clampDiffContext(Number.NaN)).toBe(3);
    expect(clampDiffContext(-5)).toBe(0);
    expect(clampDiffContext(1.9)).toBe(1);
    expect(clampDiffContext(50_000)).toBe(MAX_DIFF_CONTEXT);
  });

  it('keeps normal diffs untouched', () => {
    const files = [makeFile('a.txt', 'hello\n'), makeFile('b.txt', 'world\n')];
    const limited = limitDiffPayload(files);
    expect(limited).toEqual(files);
    expect(limited[0]).toBe(files[0]);
    expect(estimateFileDiffBytes(files[0]!)).toBeGreaterThan('hello'.length);
  });

  it('downgrades a file above the per-file limit without mutating the input', () => {
    const big = makeFile('big.txt', 'x'.repeat(2000));
    const small = makeFile('small.txt', 'small\n');
    const limited = limitDiffPayload([big, small], { maxFileBytes: 1000, maxTotalBytes: 100_000 });
    expect(limited[0]).toEqual({ path: 'big.txt', status: 'modified', binary: false, hunks: [] });
    expect(limited[1]!.hunks).toHaveLength(1);
    expect(big.hunks).toHaveLength(1); // input arrays are not mutated
    expect(small.hunks).toHaveLength(1);
  });

  it('downgrades remaining files once the total budget is exhausted', () => {
    const first = makeFile('first.txt', 'a'.repeat(200));
    const second = makeFile('second.txt', 'b'.repeat(200));
    const limited = limitDiffPayload([first, second], {
      maxFileBytes: MAX_FILE_DIFF_BYTES,
      maxTotalBytes: 600,
    });
    expect(limited[0]!.hunks).toHaveLength(1);
    expect(limited[1]).toEqual({ path: 'second.txt', status: 'modified', binary: false, hunks: [] });
  });

  it('drops image data urls that exceed the per-file limit', () => {
    const image: FileDiff = {
      path: 'assets/logo.png',
      status: 'modified',
      binary: true,
      hunks: [],
      imageBefore: `data:image/png;base64,${'A'.repeat(2000)}`,
      imageAfter: `data:image/png;base64,${'B'.repeat(2000)}`,
    };
    const limited = limitDiffPayload([image], { maxFileBytes: 1000 });
    expect(limited[0]).toEqual({ path: 'assets/logo.png', status: 'modified', binary: true, hunks: [] });
    expect(limited[0]!.imageBefore).toBeUndefined();
    expect(limited[0]!.imageAfter).toBeUndefined();
    expect(image.imageBefore).toBeTruthy(); // input is not mutated
  });
});

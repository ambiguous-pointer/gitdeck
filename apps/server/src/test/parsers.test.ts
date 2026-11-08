import { describe, expect, it } from 'vitest';
import {
  attachRefs,
  diffStats,
  mergeFileStats,
  parseBranches,
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
  parseTrack,
  parseWorktrees,
} from '../git/parsers';
import { parseUnifiedDiff } from '../git/diff';

const raw = (...tokens: string[]): string => tokens.join('\u0000');

describe('parseStatus (porcelain v2)', () => {
  it('classifies staged, unstaged, untracked, renamed and conflicted entries', () => {
    const status = parseStatus(
      raw(
        '# branch.oid 1111111111111111111111111111111111111111',
        '# branch.head main',
        '# branch.upstream origin/main',
        '# branch.ab +2 -3',
        '1 M. N... 100644 100644 100644 aaaa bbbb staged.txt',
        '1 .M N... 100644 100644 100644 aaaa bbbb unstaged.txt',
        '1 MM N... 100644 100644 100644 aaaa bbbb both.txt',
        '2 R. N... 100644 100644 100644 aaaa bbbb R100 renamed-new.txt',
        'renamed-old.txt',
        '? untracked.txt',
        'u UU N... 100644 100644 100644 100644 aaaa bbbb cccc conflict.txt',
        '',
      ),
    );

    expect(status.branch).toBe('main');
    expect(status.detached).toBe(false);
    expect(status.unborn).toBe(false);
    expect(status.upstream).toBe('origin/main');
    expect(status.ahead).toBe(2);
    expect(status.behind).toBe(3);
    expect(status.staged.map((file) => file.path)).toEqual(['staged.txt', 'both.txt', 'renamed-new.txt']);
    expect(status.staged[2]).toMatchObject({ status: 'renamed', oldPath: 'renamed-old.txt' });
    expect(status.unstaged.map((file) => file.path)).toEqual(['unstaged.txt', 'both.txt']);
    expect(status.untracked).toEqual([{ path: 'untracked.txt', status: 'untracked' }]);
    expect(status.conflicted).toEqual([
      { path: 'conflict.txt', status: 'conflicted', conflictType: 'both-modified' },
    ]);
    expect(status.counts).toEqual({ staged: 3, unstaged: 2, untracked: 1, conflicted: 1 });
  });

  it('detects unborn and detached branches', () => {
    const unborn = parseStatus(raw('# branch.oid (initial)', '# branch.head main', ''));
    expect(unborn.unborn).toBe(true);
    expect(unborn.branch).toBe('main');
    expect(unborn.headOid).toBeUndefined();

    const detached = parseStatus(
      raw('# branch.oid 2222222222222222222222222222222222222222', '# branch.head (detached)', ''),
    );
    expect(detached.detached).toBe(true);
    expect(detached.branch).toBe('2222222');
  });
});

describe('parseLog / parseReflog', () => {
  it('parses NUL separated commit records', () => {
    const record = (hash: string, subject: string, body: string): string =>
      [
        hash,
        hash.slice(0, 7),
        '3333333333333333333333333333333333333333',
        'Alice',
        'alice@example.com',
        '2024-01-02T03:04:05+00:00',
        'Bob',
        'bob@example.com',
        '2024-01-02T03:05:00+00:00',
        subject,
        body,
      ].join('\u0000') + '\x1e';

    const commits = parseLog(
      `\n${record('a'.repeat(40), 'first subject', 'body line\n')}${record('b'.repeat(40), 'second', '')}`,
    );
    expect(commits).toHaveLength(2);
    expect(commits[0]).toMatchObject({
      hash: 'a'.repeat(40),
      shortHash: 'aaaaaaa',
      subject: 'first subject',
      body: 'body line',
      parents: ['3'.repeat(40)],
      refs: [],
    });
    expect(commits[0]?.author).toEqual({
      name: 'Alice',
      email: 'alice@example.com',
      date: '2024-01-02T03:04:05+00:00',
    });
    expect(commits[1]?.body).toBe('');
  });

  it('parses reflog records without a body', () => {
    const line = `${'c'.repeat(40)}\u0000ccccccc\u0000\u0000Alice\u0000alice@example.com\u0000\u0000Bob\u0000bob@example.com\u0000\u0000commit: initial\u0000HEAD@{0}\x1e`;
    const commits = parseReflog(line);
    expect(commits).toHaveLength(1);
    expect(commits[0]).toMatchObject({
      hash: 'c'.repeat(40),
      subject: 'commit: initial',
      body: '',
      refs: [],
    });
  });

  it('attaches decorated refs and HEAD', () => {
    const refs = parseRefList(
      [
        `${'a'.repeat(40)}\u0000refs/heads/main\u0000*`,
        `${'a'.repeat(40)}\u0000refs/remotes/origin/main\u0000 `,
        `${'a'.repeat(40)}\u0000refs/tags/v1\u0000 `,
      ].join('\n'),
    );
    const commits = parseLog(
      `${'a'.repeat(40)}\u0000aaaaaaa\u0000\u0000A\u0000a@x\u0000d\u0000C\u0000c@x\u0000d\u0000subject\u0000\x1e`,
    );
    attachRefs(commits, refs, 'a'.repeat(40));
    expect(commits[0]?.refs.map((ref) => ref.label)).toEqual(['HEAD', 'main', 'v1', 'origin/main']);
  });
});

describe('parseBranches', () => {
  it('parses local/remote branches with upstream tracking', () => {
    const branches = parseBranches(
      [
        `refs/heads/main\u0000${'a'.repeat(40)}\u0000aaaaaaa\u0000*\u0000origin/main\u0000[ahead 2, behind 1]\u0000latest\u0000Alice\u00002024-01-01T00:00:00Z`,
        `refs/heads/fix\u0000${'b'.repeat(40)}\u0000bbbbbbb\u0000 \u0000\u0000\u0000fix work\u0000Bob\u00002024-01-02T00:00:00Z`,
        `refs/remotes/origin/main\u0000${'a'.repeat(40)}\u0000aaaaaaa\u0000 \u0000\u0000\u0000latest\u0000Alice\u00002024-01-01T00:00:00Z`,
        `refs/remotes/origin/HEAD\u0000${'a'.repeat(40)}\u0000aaaaaaa\u0000 \u0000\u0000\u0000latest\u0000Alice\u00002024-01-01T00:00:00Z`,
      ].join('\n'),
    );
    expect(branches.map((branch) => branch.name)).toEqual(['main', 'fix', 'origin/main']);
    expect(branches[0]).toMatchObject({
      current: true,
      ahead: 2,
      behind: 1,
      upstream: 'origin/main',
      tipShortHash: 'aaaaaaa',
    });
    expect(branches[2]).toMatchObject({ isRemote: true, remote: 'origin', current: false });
  });

  it('parses tracking metadata', () => {
    expect(parseTrack('[ahead 3, behind 4]')).toEqual({ ahead: 3, behind: 4 });
    expect(parseTrack('[gone]')).toEqual({ ahead: 0, behind: 0 });
    expect(parseTrack('')).toEqual({ ahead: 0, behind: 0 });
  });
});

describe('parseRemotes / parseTags / parseStashes / parseWorktrees', () => {
  it('parses remotes with push urls', () => {
    const remotes = parseRemotes(
      [
        'origin\tC:/repos/remote.git (fetch)',
        'origin\tC:/repos/remote-push.git (push)',
        'upstream\thttps://example.com/up.git (fetch)',
      ].join('\n'),
    );
    expect(remotes).toEqual([
      { name: 'origin', fetchUrl: 'C:/repos/remote.git', pushUrl: 'C:/repos/remote-push.git' },
      { name: 'upstream', fetchUrl: 'https://example.com/up.git', pushUrl: 'https://example.com/up.git' },
    ]);
  });

  it('parses annotated and lightweight tags', () => {
    const tags = parseTags(
      [
        `refs/tags/v1\u0000aa\u0000bb\u0000bbbbbbb\u0000tag\u0000Tagger\u00002024-01-01T00:00:00Z\u0000release one\u00002024-01-01T00:00:00Z`,
        `refs/tags/light\u0000cc\u0000\u0000\u0000commit\u0000\u0000\u0000commit subject\u00002024-01-02T00:00:00Z`,
      ].join('\n'),
    );
    expect(tags).toEqual([
      {
        name: 'light',
        hash: 'cc',
        shortHash: 'cc',
        annotated: false,
        subject: 'commit subject',
        date: '2024-01-02T00:00:00Z',
      },
      {
        name: 'v1',
        hash: 'bb',
        shortHash: 'bbbbbbb',
        annotated: true,
        subject: 'release one',
        tagger: 'Tagger',
        date: '2024-01-01T00:00:00Z',
      },
    ]);
  });

  it('parses stashes with branch and index', () => {
    const stashes = parseStashes(
      [
        'stash@{0}\u0000aaaa\u0000aaaaaaa\u0000On main: work in progress\u00002024-01-01T00:00:00Z',
        'stash@{1}\u0000bbbb\u0000bbbbbbb\u0000WIP on feature: 1234 thing\u00002024-01-02T00:00:00Z',
      ].join('\n'),
    );
    expect(stashes[0]).toEqual({
      index: 0,
      hash: 'aaaa',
      shortHash: 'aaaaaaa',
      name: 'stash@{0}',
      message: 'On main: work in progress',
      date: '2024-01-01T00:00:00Z',
      branch: 'main',
    });
    expect(stashes[1]?.branch).toBe('feature');
  });

  it('parses worktrees with locked and detached entries', () => {
    const worktrees = parseWorktrees(
      [
        'worktree C:/repos/main',
        'HEAD aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        'branch refs/heads/main',
        '',
        'worktree C:/repos/wt',
        'HEAD bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        'detached',
        'locked reason here',
        '',
      ].join('\n'),
    );
    expect(worktrees).toHaveLength(2);
    expect(worktrees[0]).toMatchObject({ name: 'main', branch: 'main', isMain: true, bare: false });
    expect(worktrees[1]).toMatchObject({ name: 'wt', detached: true, isMain: false, locked: 'reason here' });
  });
});

describe('parseConfigList', () => {
  it('parses NUL separated key/value pairs', () => {
    const entries = parseConfigList(
      'user.name\nAlice\u0000core.filemode\nfalse\u0000foo.bar\n\u0000',
      'local',
    );
    expect(entries).toEqual([
      { key: 'user.name', value: 'Alice', scope: 'local' },
      { key: 'core.filemode', value: 'false', scope: 'local' },
      { key: 'foo.bar', value: '', scope: 'local' },
    ]);
  });
});

describe('parseUnifiedDiff', () => {
  const patch = [
    'diff --git a/added.txt b/added.txt',
    'new file mode 100644',
    'index 0000000..1111111',
    '--- /dev/null',
    '+++ b/added.txt',
    '@@ -0,0 +1,2 @@',
    '+hello',
    '+world',
    'diff --git a/modified.txt b/modified.txt',
    'index 1111111..2222222 100644',
    '--- a/modified.txt',
    '+++ b/modified.txt',
    '@@ -1,3 +1,3 @@',
    ' context',
    '-old',
    '+new',
    ' tail',
    'diff --git a/deleted.txt b/deleted.txt',
    'deleted file mode 100644',
    '--- a/deleted.txt',
    '+++ /dev/null',
    '@@ -1 +0,0 @@',
    '-bye',
    'diff --git a/old-name.txt b/new-name.txt',
    'similarity index 100%',
    'rename from old-name.txt',
    'rename to new-name.txt',
    'diff --git a/image.png b/image.png',
    'index 3333333..4444444 100644',
    'Binary files a/image.png and b/image.png differ',
    'diff --git a/gone.bin b/gone.bin',
    'new file mode 100644',
    'index 0000000..5555555',
    'Binary files /dev/null and b/gone.bin differ',
  ].join('\n');

  it('parses added, modified, deleted, renamed and binary files', () => {
    const files = parseUnifiedDiff(patch);
    expect(files.map((file) => [file.path, file.status, file.binary])).toEqual([
      ['added.txt', 'added', false],
      ['modified.txt', 'modified', false],
      ['deleted.txt', 'deleted', false],
      ['new-name.txt', 'renamed', false],
      ['image.png', 'modified', true],
      ['gone.bin', 'added', true],
    ]);
    const added = files[0];
    expect(added?.hunks).toHaveLength(1);
    expect(added?.hunks[0]?.header).toBe('@@ -0,0 +1,2 @@');
    expect(added?.hunks[0]?.lines).toEqual([
      { type: 'add', content: 'hello', newLine: 1 },
      { type: 'add', content: 'world', newLine: 2 },
    ]);

    const modified = files[1];
    expect(modified?.hunks[0]?.lines).toEqual([
      { type: 'context', content: 'context', oldLine: 1, newLine: 1 },
      { type: 'del', content: 'old', oldLine: 2 },
      { type: 'add', content: 'new', newLine: 2 },
      { type: 'context', content: 'tail', oldLine: 3, newLine: 3 },
    ]);
    expect(files[3]).toMatchObject({ path: 'new-name.txt', oldPath: 'old-name.txt' });
  });
});

describe('diff-tree parsers', () => {
  it('merges name-status with numstat', () => {
    const files = parseNameStatus(
      ['M\tsrc/app.txt', 'A\tnew.txt', 'R100\told.txt\trenamed.txt', 'D\tgone.txt'].join('\n'),
    );
    const stats = parseNumstat(
      ['2\t1\tsrc/app.txt', '5\t0\tnew.txt', '0\t0\told.txt', '0\t0\told.txt'].join('\n'),
    );
    const merged = mergeFileStats(files, stats);
    expect(merged[0]).toMatchObject({ path: 'src/app.txt', status: 'modified', insertions: 2, deletions: 1 });
    expect(merged[2]).toMatchObject({ path: 'renamed.txt', oldPath: 'old.txt', status: 'renamed' });
    expect(diffStats(merged)).toEqual({ filesChanged: 4, insertions: 7, deletions: 1 });
  });

  it('parses default branch from symbolic refs', () => {
    expect(parseDefaultBranch('origin/main')).toBe('main');
    expect(parseDefaultBranch('upstream/develop')).toBe('develop');
    expect(parseDefaultBranch('')).toBeUndefined();
  });
});

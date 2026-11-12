import { describe, expect, it } from 'vitest';
import {
  buildFileTree,
  collectFolderPaths,
  countTreeFiles,
  diffLineContent,
  normalizeRepoPath,
  splitFileHunks,
  splitHunkLines,
} from './diff.js';
import type { DiffLine, FileDiff } from './types.js';

function line(type: DiffLine['type'], content: string, oldLine?: number, newLine?: number): DiffLine {
  return { type, content, oldLine, newLine };
}

describe('splitHunkLines', () => {
  it('mirrors context lines on both sides', () => {
    const rows = splitHunkLines([line('context', 'same', 1, 1)]);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.left).toMatchObject({ type: 'context', content: 'same', oldLine: 1 });
    expect(rows[0]!.right).toMatchObject({ type: 'context', content: 'same', newLine: 1 });
  });

  it('pairs deletions with additions', () => {
    const rows = splitHunkLines([
      line('context', 'before', 1, 1),
      line('del', 'old', 2),
      line('add', 'new', undefined, 2),
      line('context', 'after', 3, 3),
    ]);
    expect(rows).toHaveLength(3);
    expect(rows[1]!.left).toMatchObject({ type: 'del', content: 'old', oldLine: 2 });
    expect(rows[1]!.right).toMatchObject({ type: 'add', content: 'new', newLine: 2 });
    expect(rows[2]!.left).toMatchObject({ type: 'context', content: 'after' });
  });

  it('keeps unmatched deletions in the left column only', () => {
    const rows = splitHunkLines([line('del', 'a', 1), line('del', 'b', 2), line('add', 'c', 1)]);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.left?.content).toBe('a');
    expect(rows[0]!.right?.content).toBe('c');
    expect(rows[1]!.left?.content).toBe('b');
    expect(rows[1]!.right).toBeUndefined();
  });

  it('keeps unmatched additions in the right column only', () => {
    const rows = splitHunkLines([line('add', 'a', 1), line('add', 'b', 2)]);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.left).toBeUndefined();
    expect(rows[0]!.right?.content).toBe('a');
    expect(rows[1]!.right?.content).toBe('b');
  });

  it('treats a multi-line change block as one pair per index', () => {
    const rows = splitHunkLines([
      line('del', 'x1', 1),
      line('del', 'x2', 2),
      line('add', 'y1', 1),
      line('add', 'y2', 2),
    ]);
    expect(rows.map((row) => [row.left?.content, row.right?.content])).toEqual([
      ['x1', 'y1'],
      ['x2', 'y2'],
    ]);
  });

  it('strips leading markers kept in the payload', () => {
    const rows = splitHunkLines([line('del', '-removed', 1), line('add', '+added', 1)]);
    expect(rows[0]!.left?.content).toBe('removed');
    expect(rows[0]!.right?.content).toBe('added');
  });

  it('keeps hunk headers out of the row list', () => {
    const rows = splitHunkLines([line('hunk', '@@ -1 +1 @@'), line('context', 'body', 1, 1)]);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.left?.content).toBe('body');
  });
});

describe('splitFileHunks', () => {
  it('maps every hunk of a file', () => {
    const file: FileDiff = {
      path: 'a.ts',
      status: 'modified',
      binary: false,
      hunks: [
        { header: '@@ -1,2 +1,2 @@', lines: [line('context', 'a', 1, 1), line('del', 'b', 2)] },
        { header: '@@ -10 +10 @@', lines: [line('add', 'c', 10)] },
      ],
    };
    const hunks = splitFileHunks(file);
    expect(hunks).toHaveLength(2);
    expect(hunks[0]!.header).toBe('@@ -1,2 +1,2 @@');
    expect(hunks[0]!.rows).toHaveLength(2);
    expect(hunks[1]!.rows[0]!.right?.content).toBe('c');
  });
});

describe('diffLineContent', () => {
  it('only strips markers matching the line type', () => {
    expect(diffLineContent(line('add', '+x'))).toBe('x');
    expect(diffLineContent(line('del', '-x'))).toBe('x');
    expect(diffLineContent(line('add', '-x'))).toBe('-x');
    expect(diffLineContent(line('context', ' x'))).toBe(' x');
  });
});

describe('buildFileTree', () => {
  it('groups files into folders and sorts folders first', () => {
    const tree = buildFileTree([
      { path: 'src/app/main.ts' },
      { path: 'README.md' },
      { path: 'src/lib/util.ts' },
      { path: 'src/app/router.ts' },
    ]);
    expect(tree.map((node) => node.name)).toEqual(['src', 'README.md']);
    expect(tree[0]!.children.map((node) => node.name)).toEqual(['app', 'lib']);
    expect(tree[0]!.children[0]!.children.map((node) => node.name)).toEqual(['main.ts', 'router.ts']);
    expect(countTreeFiles(tree)).toBe(4);
  });

  it('normalizes Windows separators', () => {
    const tree = buildFileTree([{ path: 'apps\\web\\src\\index.ts' }]);
    expect(tree[0]!.name).toBe('apps');
    expect(tree[0]!.children[0]!.path).toBe('apps/web');
    expect(tree[0]!.children[0]!.children[0]!.path).toBe('apps/web/src');
    expect(tree[0]!.children[0]!.children[0]!.children[0]!.path).toBe('apps/web/src/index.ts');
  });

  it('keeps the file entry metadata', () => {
    const tree = buildFileTree([{ path: 'a.ts', status: 'added', insertions: 3, deletions: 0 }]);
    expect(tree[0]!.entry).toMatchObject({ path: 'a.ts', status: 'added', insertions: 3 });
  });

  it('lists every folder path for expand-all', () => {
    const tree = buildFileTree([{ path: 'a/b/c.ts' }, { path: 'a/d.ts' }]);
    expect(collectFolderPaths(tree).sort()).toEqual(['a', 'a/b']);
  });

  it('ignores empty paths', () => {
    expect(buildFileTree([{ path: '' }])).toEqual([]);
  });
});

describe('normalizeRepoPath', () => {
  it('strips ./ and backslashes', () => {
    expect(normalizeRepoPath('./src\\index.ts')).toBe('src/index.ts');
  });
});

/**
 * Diff presentation helpers.
 *
 * The server always produces a *unified* diff (`DiffHunk.lines` is a flat list
 * of context / add / del lines). This module derives the two classic layouts
 * used by Git GUIs from that single source:
 *
 *   - `unified` — the raw list, one column (already available from the API).
 *   - `split`   — a side-by-side table where deleted lines live in the left
 *                 column and added lines live in the right column.
 *
 * The pairing logic is pure and unit tested so the web app can switch layouts
 * instantly without asking the server for a second diff.
 */
import type { DiffHunk, DiffLine, FileDiff, FileStatus } from './types.js';

export type DiffViewMode = 'unified' | 'split';

/** A single rendered cell of the side-by-side view. */
export interface SplitCell {
  /** `context` / `add` / `del` for real content, `empty` for a filler cell. */
  type: 'context' | 'add' | 'del' | 'empty';
  content: string;
  oldLine?: number;
  newLine?: number;
}

/** One visual row of the side-by-side view (left = old, right = new). */
export interface SplitRow {
  left?: SplitCell;
  right?: SplitCell;
}

/** A hunk with its lines already paired for the side-by-side layout. */
export interface SplitHunk {
  header: string;
  rows: SplitRow[];
}

/**
 * Strip the leading `+` / `-` marker the backend may keep in `content`.
 *
 * The server usually strips it already, but `git diff --no-prefix` style
 * payloads and hand-crafted API responses can keep it.
 */
export function diffLineContent(line: DiffLine): string {
  if (line.type === 'add' && line.content.startsWith('+')) return line.content.slice(1);
  if (line.type === 'del' && line.content.startsWith('-')) return line.content.slice(1);
  return line.content;
}

/**
 * Pair unified diff lines into side-by-side rows.
 *
 * Git emits a change block as "all deletions, then all additions". We collect
 * the whole block, split it into deletions / additions and zip them by index:
 * the i-th deleted line is rendered next to the i-th added line. Extra
 * deletions (or additions) keep an empty filler cell on the other side.
 */
export function splitHunkLines(lines: DiffLine[]): SplitRow[] {
  const rows: SplitRow[] = [];
  let index = 0;

  const cell = (line: DiffLine, type: SplitCell['type']): SplitCell => ({
    type,
    content: diffLineContent(line),
    oldLine: line.oldLine,
    newLine: line.newLine,
  });

  while (index < lines.length) {
    const line = lines[index]!;

    if (line.type === 'add' || line.type === 'del') {
      // Collect the whole change block (consecutive add/del lines).
      const block: DiffLine[] = [];
      while (index < lines.length && (lines[index]!.type === 'add' || lines[index]!.type === 'del')) {
        block.push(lines[index]!);
        index += 1;
      }

      const deletions = block.filter((item) => item.type === 'del');
      const additions = block.filter((item) => item.type === 'add');
      const paired = Math.min(deletions.length, additions.length);

      for (let i = 0; i < paired; i += 1) {
        rows.push({ left: cell(deletions[i]!, 'del'), right: cell(additions[i]!, 'add') });
      }
      for (let i = paired; i < deletions.length; i += 1) {
        rows.push({ left: cell(deletions[i]!, 'del') });
      }
      for (let i = paired; i < additions.length; i += 1) {
        rows.push({ right: cell(additions[i]!, 'add') });
      }
      continue;
    }

    if (line.type === 'hunk') {
      // Hunk headers are rendered separately; they are not part of the rows.
      index += 1;
      continue;
    }

    // Context (or an unknown marker): shown on both sides.
    rows.push({ left: cell(line, 'context'), right: cell(line, 'context') });
    index += 1;
  }

  return rows;
}

/** Pair every hunk of a file for the side-by-side layout. */
export function splitFileHunks(file: FileDiff): SplitHunk[] {
  return file.hunks.map((hunk: DiffHunk) => ({
    header: hunk.header,
    rows: splitHunkLines(hunk.lines),
  }));
}

/* ------------------------------------------------------------------ */
/* File tree                                                           */
/* ------------------------------------------------------------------ */

/** Minimal file descriptor required to build a tree. */
export interface FileTreeEntry {
  path: string;
  status?: FileStatus;
  oldPath?: string;
  insertions?: number;
  deletions?: number;
  binary?: boolean;
}

export interface FileTreeNode {
  /** Segment name for folders, file name for files. */
  name: string;
  /** Full path from the repository root (folder path for folders). */
  path: string;
  kind: 'folder' | 'file';
  children: FileTreeNode[];
  /** Present on `kind === 'file'` nodes. */
  entry?: FileTreeEntry;
}

/** Normalize Windows separators and strip leading `./`. */
export function normalizeRepoPath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.\//, '');
}

/**
 * Build a directory tree from a flat list of file paths.
 *
 * Folders are sorted before files, both alphabetically (case-insensitive) so
 * the tree is stable across platforms.
 */
export function buildFileTree(entries: FileTreeEntry[]): FileTreeNode[] {
  const root: FileTreeNode[] = [];

  for (const entry of entries) {
    const path = normalizeRepoPath(entry.path);
    const segments = path.split('/').filter(Boolean);
    if (segments.length === 0) continue;

    let level = root;
    let currentPath = '';

    segments.forEach((segment, index) => {
      currentPath = currentPath ? `${currentPath}/${segment}` : segment;
      const isFile = index === segments.length - 1;

      if (isFile) {
        level.push({
          name: segment,
          path: currentPath,
          kind: 'file',
          children: [],
          entry: { ...entry, path },
        });
        return;
      }

      let folder = level.find((node) => node.kind === 'folder' && node.name === segment);
      if (!folder) {
        folder = { name: segment, path: currentPath, kind: 'folder', children: [] };
        level.push(folder);
      }
      level = folder.children;
    });
  }

  const sort = (nodes: FileTreeNode[]): FileTreeNode[] => {
    nodes.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });
    for (const node of nodes) if (node.children.length > 0) sort(node.children);
    return nodes;
  };

  return sort(root);
}

/** Count the files contained in a tree (recursively). */
export function countTreeFiles(nodes: FileTreeNode[]): number {
  return nodes.reduce((sum, node) => sum + (node.kind === 'file' ? 1 : countTreeFiles(node.children)), 0);
}

/**
 * Collect every folder path of a tree — useful for "expand all" actions.
 */
export function collectFolderPaths(nodes: FileTreeNode[], prefix = ''): string[] {
  const paths: string[] = [];
  for (const node of nodes) {
    if (node.kind !== 'folder') continue;
    const path = prefix ? `${prefix}/${node.name}` : node.name;
    paths.push(path);
    paths.push(...collectFolderPaths(node.children, path));
  }
  return paths;
}

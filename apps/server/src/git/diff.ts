/**
 * Unified diff parsing: turns `git diff` / `git diff-tree -p` output into the
 * `FileDiff[]` structure consumed by the web diff viewer.
 */
import type { DiffHunk, DiffLine, FileDiff, FileStatus } from '@gitdeck/shared';

interface HunkBuilder {
  header: string;
  lines: DiffLine[];
  oldLine: number;
  newLine: number;
}

interface FileBuilder {
  oldPath?: string;
  newPath?: string;
  status?: FileStatus;
  binary: boolean;
  hunks: DiffHunk[];
  currentHunk?: HunkBuilder;
}

/** Decode a C-quoted git path (e.g. `"a/caf\303\251.txt"`) if needed. */
function decodeGitPath(value: string): string {
  const trimmed = value.trim();
  if (!trimmed.startsWith('"') || !trimmed.endsWith('"') || trimmed.length < 2) return trimmed;
  const body = trimmed.slice(1, -1);
  const bytes: number[] = [];
  for (let index = 0; index < body.length; index += 1) {
    const char = body[index] ?? '';
    if (char === '\\' && index + 1 < body.length) {
      const next = body[index + 1] ?? '';
      if (next >= '0' && next <= '7') {
        const octal = body.slice(index + 1, index + 4);
        bytes.push(Number.parseInt(octal, 8) & 0xff);
        index += 3;
        continue;
      }
      const escapes: Record<string, number> = { n: 10, t: 9, r: 13, '"': 34, '\\': 92 };
      const escaped = escapes[next];
      if (escaped !== undefined) {
        bytes.push(escaped);
        index += 1;
        continue;
      }
    }
    bytes.push(char.charCodeAt(0));
  }
  return Buffer.from(bytes).toString('utf8');
}

function stripPrefix(value: string): string | undefined {
  const decoded = decodeGitPath(value);
  if (decoded === '/dev/null') return undefined;
  if (decoded.startsWith('a/')) return decoded.slice(2);
  if (decoded.startsWith('b/')) return decoded.slice(2);
  return decoded;
}

/** Best-effort path extraction from `Binary files <a> and <b> differ`. */
function parseBinaryPaths(line: string): { oldPath?: string; newPath?: string } {
  const match = /^Binary files (.+) and (.+) differ$/.exec(line);
  if (!match) return {};
  return { oldPath: stripPrefix(match[1] ?? ''), newPath: stripPrefix(match[2] ?? '') };
}

function finalizeHunk(file: FileBuilder): void {
  if (!file.currentHunk) return;
  file.hunks.push({ header: file.currentHunk.header, lines: file.currentHunk.lines });
  file.currentHunk = undefined;
}

function finalizeFile(file: FileBuilder | undefined, files: FileDiff[]): void {
  if (!file) return;
  finalizeHunk(file);
  const newPath = file.newPath;
  const oldPath = file.oldPath;
  const path = newPath ?? oldPath;
  if (!path) return;

  let status: FileStatus = file.status ?? 'modified';
  if (!file.status) {
    if (!oldPath) status = 'added';
    else if (!newPath) status = 'deleted';
    else if (oldPath !== newPath) status = 'renamed';
  }

  files.push({
    path,
    ...(oldPath && oldPath !== path ? { oldPath } : {}),
    status,
    binary: file.binary,
    hunks: file.hunks,
  });
}

/**
 * Parse a unified diff (as produced by `git diff --no-color --patch`) into
 * per-file diffs. Handles adds/deletes, renames/copies, binary markers and
 * multiple hunks per file.
 */
export function parseUnifiedDiff(raw: string): FileDiff[] {
  const files: FileDiff[] = [];
  let current: FileBuilder | undefined = undefined;
  const lines = raw.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;

    if (line.startsWith('diff --git ')) {
      finalizeFile(current, files);
      current = { binary: false, hunks: [] };
      continue;
    }
    if (!current) continue;

    if (line.startsWith('new file mode ')) {
      current.status = 'added';
      continue;
    }
    if (line.startsWith('deleted file mode ')) {
      current.status = 'deleted';
      continue;
    }
    if (line.startsWith('rename from ')) {
      current.oldPath = decodeGitPath(line.slice('rename from '.length));
      current.status = 'renamed';
      continue;
    }
    if (line.startsWith('rename to ')) {
      current.newPath = decodeGitPath(line.slice('rename to '.length));
      current.status = 'renamed';
      continue;
    }
    if (line.startsWith('copy from ')) {
      current.oldPath = decodeGitPath(line.slice('copy from '.length));
      current.status = 'copied';
      continue;
    }
    if (line.startsWith('copy to ')) {
      current.newPath = decodeGitPath(line.slice('copy to '.length));
      current.status = 'copied';
      continue;
    }
    if (line.startsWith('--- ')) {
      finalizeHunk(current);
      current.oldPath = stripPrefix(line.slice(4));
      continue;
    }
    if (line.startsWith('+++ ')) {
      current.newPath = stripPrefix(line.slice(4));
      continue;
    }
    if (line.startsWith('Binary files ') || line === 'GIT binary patch') {
      current.binary = true;
      if (line.startsWith('Binary files ')) {
        const { oldPath, newPath } = parseBinaryPaths(line);
        if (oldPath !== undefined) current.oldPath = oldPath;
        if (newPath !== undefined) current.newPath = newPath;
      }
      continue;
    }
    if (line.startsWith('@@')) {
      finalizeHunk(current);
      const match = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(line);
      current.currentHunk = {
        header: line,
        lines: [],
        oldLine: match ? Number.parseInt(match[1] ?? '0', 10) : 0,
        newLine: match ? Number.parseInt(match[3] ?? '0', 10) : 0,
      };
      continue;
    }

    const hunk = current.currentHunk;
    if (!hunk) continue;
    const marker = line[0] ?? ' ';
    if (marker === '\\') continue; // "\ No newline at end of file"
    if (marker === ' ') {
      hunk.lines.push({
        type: 'context',
        content: line.slice(1),
        oldLine: hunk.oldLine,
        newLine: hunk.newLine,
      });
      hunk.oldLine += 1;
      hunk.newLine += 1;
      continue;
    }
    if (marker === '+') {
      hunk.lines.push({ type: 'add', content: line.slice(1), newLine: hunk.newLine });
      hunk.newLine += 1;
      continue;
    }
    if (marker === '-') {
      hunk.lines.push({ type: 'del', content: line.slice(1), oldLine: hunk.oldLine });
      hunk.oldLine += 1;
    }
  }

  finalizeFile(current, files);
  return files;
}

/** True when the file extension is a raster image we can render as a data URL. */
const IMAGE_MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
  '.avif': 'image/avif',
};

export function imageMimeForPath(filePath: string): string | undefined {
  const lower = filePath.toLowerCase();
  const dot = lower.lastIndexOf('.');
  if (dot === -1) return undefined;
  return IMAGE_MIME[lower.slice(dot)];
}

export function bufferToDataUrl(mime: string, buffer: Buffer): string {
  return `data:${mime};base64,${buffer.toString('base64')}`;
}

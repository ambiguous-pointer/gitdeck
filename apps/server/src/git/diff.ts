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
    // `raw.split('\n')` yields an empty trailing item for git's final newline;
    // it is not a patch line (a real empty context line would be ' ').
    if (line === '') continue;
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

/* ------------------------------------------------------------------ */
/* Context bounds                                                      */
/* ------------------------------------------------------------------ */

/** Smallest/largest unified-diff context accepted by the API. */
export const MIN_DIFF_CONTEXT = 0;
export const MAX_DIFF_CONTEXT = 1000;
/** Context used when the client does not pass `context` (git's default). */
export const DEFAULT_DIFF_CONTEXT = 3;

/**
 * Clamp a requested unified-diff context size into the supported range.
 *
 * The route schema already rejects out-of-range values; this is a defensive
 * second line for internal callers (e.g. commit diffs) and keeps `git -U<n>`
 * arguments sane even if a value slips through.
 */
export function clampDiffContext(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return DEFAULT_DIFF_CONTEXT;
  return Math.min(Math.max(Math.trunc(value), MIN_DIFF_CONTEXT), MAX_DIFF_CONTEXT);
}

/* ------------------------------------------------------------------ */
/* Payload guard                                                       */
/* ------------------------------------------------------------------ */

/** Upper bound for a single serialized `FileDiff` entry (~1 MiB). */
export const MAX_FILE_DIFF_BYTES = 1024 * 1024;
/** Upper bound for a combined serialized diff payload (`FileDiff[]`, ~8 MiB). */
export const MAX_TOTAL_DIFF_BYTES = 8 * 1024 * 1024;

export interface DiffPayloadLimits {
  maxFileBytes?: number;
  maxTotalBytes?: number;
}

/** Rough JSON framing cost of a file/hunk/line object (keys, punctuation). */
const FILE_ENTRY_OVERHEAD_BYTES = 96;
const HUNK_OVERHEAD_BYTES = 48;
const LINE_OVERHEAD_BYTES = 32;

function textBytes(value: string | undefined): number {
  return value ? Buffer.byteLength(value, 'utf8') : 0;
}

/** Estimated serialized size (JSON string bytes) of one file diff. */
export function estimateFileDiffBytes(file: FileDiff): number {
  let bytes =
    FILE_ENTRY_OVERHEAD_BYTES +
    textBytes(file.path) +
    textBytes(file.oldPath) +
    textBytes(file.imageBefore) +
    textBytes(file.imageAfter);
  for (const hunk of file.hunks) {
    bytes += HUNK_OVERHEAD_BYTES + textBytes(hunk.header);
    for (const line of hunk.lines) {
      bytes += LINE_OVERHEAD_BYTES + textBytes(line.content);
    }
  }
  return bytes;
}

/** Keep the file entry (path/status/binary) but drop its unbounded payload. */
function metadataOnly(file: FileDiff): FileDiff {
  const copy: FileDiff = { path: file.path, status: file.status, binary: file.binary, hunks: [] };
  if (file.oldPath) copy.oldPath = file.oldPath;
  return copy;
}

/**
 * Bound a diff response so it can never embed unbounded content.
 *
 * A file whose hunks (or image data URLs) exceed `maxFileBytes`, or that would
 * push the total payload over `maxTotalBytes`, is down-graded to a
 * metadata-only entry: path/status/binary are preserved, `hunks` is empty and
 * image data URLs are dropped. The file is never removed from the list, so the
 * client can still render its file tree and degrade gracefully instead of
 * crashing on a huge diff. The response shape is unchanged.
 */
export function limitDiffPayload(files: FileDiff[], limits: DiffPayloadLimits = {}): FileDiff[] {
  const maxFileBytes = limits.maxFileBytes ?? MAX_FILE_DIFF_BYTES;
  const maxTotalBytes = limits.maxTotalBytes ?? MAX_TOTAL_DIFF_BYTES;
  let totalBytes = 0;
  return files.map((file) => {
    const size = estimateFileDiffBytes(file);
    const metadataSize = FILE_ENTRY_OVERHEAD_BYTES + textBytes(file.path) + textBytes(file.oldPath);
    if (size > maxFileBytes || totalBytes + size > maxTotalBytes) {
      totalBytes += metadataSize;
      return metadataOnly(file);
    }
    totalBytes += size;
    return file;
  });
}

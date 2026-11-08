/**
 * Pure helpers shared by the operation dialogs, the working tree panel and the
 * command console: command preview formatting, ref-name validation, splitting
 * a raw command into an argv array and turning `OperationResult`s into toasts.
 */
import { EXEC_ALLOWED_SUBCOMMANDS, type OperationResult } from '@gitdeck/shared';
import type { Translator } from '@/i18n';

/** Minimal toast surface so helpers stay testable without a React tree. */
export interface ToastLike {
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
}

/** Characters that never need quoting in a shell-safe display command. */
const SAFE_COMMAND_TOKEN = /^[A-Za-z0-9_@%+=:,./^~-]+$/;

/** Quote one argv token for the human readable command preview. */
export function shellQuote(value: string): string {
  if (value === '') return '""';
  if (SAFE_COMMAND_TOKEN.test(value)) return value;
  return `"${value.replace(/(["\\$`])/g, '\\$1')}"`;
}

export type CommandToken = string | false | null | undefined;

/** Build a display command: `git push --set-upstream origin main`. */
export function gitCommand(...tokens: CommandToken[]): string {
  const parts = tokens.filter((token): token is string => typeof token === 'string' && token.length > 0);
  return ['git', ...parts].join(' ');
}

/** Display command for an argv array (raw console). */
export function formatCommandArgs(args: string[]): string {
  const [subcommand, ...rest] = args;
  if (!subcommand) return 'git';
  return gitCommand(subcommand, ...rest.map(shellQuote));
}

/**
 * Accept only names git itself would accept, mirroring the shared zod schema.
 * Keeps obviously invalid input from ever reaching the server.
 */
export function isValidRefName(value: string): boolean {
  const name = value.trim();
  if (!name || name.length > 255) return false;
  if (/[\s~^:?*[\\]/.test(name)) return false;
  if (/[\x00-\x1f\x7f]/.test(name)) return false;
  if (name.startsWith('-') || name.startsWith('/') || name.endsWith('/') || name.endsWith('.')) return false;
  if (name.includes('..') || name.includes('//') || name.includes('@{')) return false;
  if (name.endsWith('.lock')) return false;
  return true;
}

/** Commit hashes / refs accepted by cherry-pick and revert inputs. */
export function isValidCommitRef(value: string): boolean {
  return /^[0-9A-Za-z_][0-9A-Za-z_./~^@{}-]*$/.test(value) && !value.includes('..');
}

/** Join the useful parts of a command's output for display. */
export function operationOutput(result: OperationResult['result']): string {
  return [result.stderr?.trim(), result.stdout?.trim()].filter(Boolean).join('\n');
}

export function isConflictOutput(output: string): boolean {
  return /conflict|needs merge|unmerged|CONFLICT/i.test(output);
}

export interface FailedOutput {
  command: string;
  output: string;
}

/**
 * Convert a completed-but-failed `OperationResult` into something dialogs can
 * render inline (`null` when the command succeeded).
 */
export function failedOutput(result: Pick<OperationResult, 'result'> | null): FailedOutput | null {
  if (!result || result.result.ok) return null;
  return { command: result.result.command, output: operationOutput(result.result) };
}

/**
 * Toast an `OperationResult`. Returns true when the git command succeeded.
 * A successful HTTP response with a failing git process (merge conflict, push
 * rejected, …) is reported as a warning/error instead of a misleading success.
 */
export function notifyOperation(
  toast: ToastLike,
  t: Translator,
  data: Pick<OperationResult, 'result'>,
  successTitle: string,
): boolean {
  const { result } = data;
  if (result.ok) {
    toast.success(successTitle);
    return true;
  }
  const output = operationOutput(result);
  if (isConflictOutput(output)) {
    toast.warning(t('toast.conflict', 'Done, but conflicts must be resolved'), output || result.command);
  } else {
    toast.error(t('toast.failed', 'Operation failed'), output || result.command);
  }
  return false;
}

/* ------------------------------------------------------------------ */
/* Raw command console                                                 */
/* ------------------------------------------------------------------ */

/**
 * Split a raw argument string into argv tokens, honouring single/double
 * quotes so paths with spaces survive (`commit -m "fix: a b"`).
 */
export function parseCommandArgs(input: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]!;
    if (quote) {
      if (char === '\\' && input[index + 1] === quote) {
        current += quote;
        index += 1;
        continue;
      }
      if (char === quote) {
        quote = null;
        continue;
      }
      current += char;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }
    current += char;
  }
  if (current) tokens.push(current);
  return tokens;
}

const READ_ONLY_SUBCOMMANDS = new Set([
  'status',
  'log',
  'show',
  'diff',
  'rev-parse',
  'ls-files',
  'for-each-ref',
  'cat-file',
  'reflog',
  'blame',
  'describe',
]);

/** Flags that only list/inspect something for mutating-looking subcommands. */
const READ_ONLY_FLAGS = new Set([
  '-v',
  '--verbose',
  '-l',
  '--list',
  '-n',
  '--show-current',
  '--contains',
  '--merged',
  '--no-merged',
  '-r',
  '--remotes',
  '-a',
  '--all',
  '--format',
  '--get',
  '--get-all',
  '--get-regexp',
]);

function onlyListFlags(rest: string[]): boolean {
  return rest.every((arg) => READ_ONLY_FLAGS.has(arg) || /^\d+$/.test(arg));
}

/**
 * Heuristic used by the command-run dialog: does this argv look like it can
 * modify the repository? Mutating commands require an explicit confirmation.
 */
export function isMutatingGitArgs(args: string[]): boolean {
  const [subcommand, ...rest] = args;
  if (!subcommand) return false;
  if (READ_ONLY_SUBCOMMANDS.has(subcommand)) return false;
  switch (subcommand) {
    case 'branch':
      return !(rest.length === 0 || onlyListFlags(rest));
    case 'tag':
      return !(rest.length === 0 || rest.includes('-l') || rest.includes('--list'));
    case 'remote':
      return !(rest.length === 0 || ['-v', '--verbose', 'show', 'get-url', '-n'].includes(rest[0]!));
    case 'config':
      return !rest.some((arg) => arg.startsWith('--get') || arg === '-l' || arg === '--list');
    case 'stash':
      return !(rest.length === 0 || ['list', 'show'].includes(rest[0]!));
    case 'worktree':
      return rest[0] !== 'list';
    case 'submodule':
      return rest[0] !== 'status';
    default:
      return true;
  }
}

export function isAllowedExecSubcommand(subcommand: string): boolean {
  return (EXEC_ALLOWED_SUBCOMMANDS as readonly string[]).includes(subcommand);
}

/** Copy text to the clipboard; resolves to false when the browser blocks it. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}


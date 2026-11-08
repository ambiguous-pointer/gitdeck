/**
 * Low level `git` process runner.
 *
 * Every git invocation goes through `spawn` with an **argument array** (never a
 * shell string), inherits a sanitised environment that disables interactive
 * prompts/editors, is bounded by a timeout and caps the captured output. Output
 * is decoded as UTF-8 for JSON transport (raw buffers are available for binary
 * blobs, e.g. image diffs).
 */
import { spawn } from 'node:child_process';
import type { CommandResult } from '@gitdeck/shared';

/* ------------------------------------------------------------------ */
/* Display helpers                                                     */
/* ------------------------------------------------------------------ */

/** Quote a single argument for display (never used for execution). */
export function quoteArg(arg: string): string {
  if (arg === '') return '""';
  if (/^[A-Za-z0-9_./:=@%+,^~-]+$/.test(arg)) return arg;
  if (process.platform === 'win32') {
    if (!/[\s"&|<>^]/.test(arg)) return arg;
    return `"${arg.replace(/"/g, '\\"')}"`;
  }
  return `'${arg.replace(/'/g, `'\\''`)}'`;
}

/** Shell-safe display string of a git command, e.g. `git status --porcelain`. */
export function displayCommand(gitPath: string, args: readonly string[]): string {
  return [gitPath, ...args].map(quoteArg).join(' ');
}

/* ------------------------------------------------------------------ */
/* Execution                                                           */
/* ------------------------------------------------------------------ */

export interface RunGitOptions {
  gitPath: string;
  cwd: string;
  args: readonly string[];
  timeoutMs?: number;
  maxBytes?: number;
  /** Extra environment variables (used by tests to isolate HOME etc.). */
  env?: Record<string, string>;
}

export interface GitOutcome {
  result: CommandResult;
  timedOut: boolean;
  truncated: boolean;
}

export interface GitBufferOutcome {
  stdout: Buffer;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
  truncated: boolean;
}

interface RawSpawnResult {
  stdout: Buffer;
  stderr: Buffer;
  exitCode: number;
  timedOut: boolean;
  truncated: boolean;
  durationMs: number;
}

const DEFAULT_MAX_OUTPUT = 2 * 1024 * 1024;

function buildEnv(extra?: Record<string, string>): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ...(extra ?? {}),
    // Never let git block on credentials / editors / pagers.
    GIT_TERMINAL_PROMPT: '0',
    GIT_PAGER: 'cat',
    PAGER: 'cat',
    GIT_EDITOR: ':',
    GIT_SEQUENCE_EDITOR: ':',
    GIT_MERGE_AUTOEDIT: 'no',
    // Stable, machine parsable messages.
    LC_ALL: 'C',
    LANG: 'C',
  };
  if (env.GIT_ASKPASS === '') delete env.GIT_ASKPASS;
  return env;
}

function spawnRaw(options: RunGitOptions): Promise<RawSpawnResult> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const timeoutMs = options.timeoutMs ?? 120_000;
    const maxBytes = options.maxBytes ?? DEFAULT_MAX_OUTPUT;
    let child;
    try {
      child = spawn(options.gitPath, [...options.args], {
        cwd: options.cwd,
        env: buildEnv(options.env),
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)));
      return;
    }

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let truncated = false;
    let timedOut = false;
    let settled = false;

    const killTimer = (): void => {
      if (!child.killed) child.kill();
      const hardKill = setTimeout(() => {
        if (!child.killed) child.kill('SIGKILL');
      }, 1_000);
      hardKill.unref();
    };

    const timer =
      timeoutMs > 0
        ? setTimeout(() => {
            timedOut = true;
            killTimer();
          }, timeoutMs)
        : undefined;
    timer?.unref();

    child.stdout?.on('data', (chunk: Buffer) => {
      if (stdoutBytes >= maxBytes) {
        truncated = true;
        return;
      }
      const remaining = maxBytes - stdoutBytes;
      const slice = chunk.length <= remaining ? chunk : chunk.subarray(0, remaining);
      stdoutChunks.push(slice);
      stdoutBytes += slice.length;
      if (slice.length < chunk.length) truncated = true;
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      if (stderrBytes >= maxBytes) {
        truncated = true;
        return;
      }
      const remaining = maxBytes - stderrBytes;
      const slice = chunk.length <= remaining ? chunk : chunk.subarray(0, remaining);
      stderrChunks.push(slice);
      stderrBytes += slice.length;
      if (slice.length < chunk.length) truncated = true;
    });

    const finish = (exitCode: number, spawnError?: string): void => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      if (spawnError) stderrChunks.push(Buffer.from(spawnError, 'utf8'));
      resolve({
        stdout: Buffer.concat(stdoutChunks),
        stderr: Buffer.concat(stderrChunks),
        exitCode: timedOut ? 124 : exitCode,
        timedOut,
        truncated,
        durationMs: Date.now() - started,
      });
    };

    child.on('error', (error: Error) => finish(1, `Failed to run ${options.gitPath}: ${error.message}`));
    child.on('close', (code, signal) => finish(typeof code === 'number' ? code : signal ? 1 : 1));
  });
}

/** Run git and capture UTF-8 text output. Never throws on non-zero exit. */
export async function runGit(options: RunGitOptions): Promise<GitOutcome> {
  const raw = await spawnRaw(options);
  const result: CommandResult = {
    command: displayCommand(options.gitPath, options.args),
    cwd: options.cwd,
    stdout: raw.stdout.toString('utf8'),
    stderr: raw.stderr.toString('utf8'),
    exitCode: raw.exitCode,
    durationMs: raw.durationMs,
    ok: raw.exitCode === 0 && !raw.timedOut,
  };
  return { result, timedOut: raw.timedOut, truncated: raw.truncated };
}

/** Run git and capture the raw stdout buffer (binary blobs / image diffs). */
export async function runGitBuffer(options: RunGitOptions): Promise<GitBufferOutcome> {
  const raw = await spawnRaw(options);
  return {
    stdout: raw.stdout,
    stderr: raw.stderr.toString('utf8'),
    exitCode: raw.exitCode,
    timedOut: raw.timedOut,
    truncated: raw.truncated,
  };
}

/* ------------------------------------------------------------------ */
/* Failure helpers (implemented over the Express ApiError envelope)    */
/* ------------------------------------------------------------------ */

export interface FailureDetails {
  command: string;
  cwd: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut?: boolean;
  truncated?: boolean;
  operation?: unknown;
}

/**
 * Build the `details` payload for an ApiError. The web client reads
 * `details.stdout` / `details.stderr` when displaying git failures.
 */
export function commandDetails(outcome: GitOutcome, extra?: Record<string, unknown>): FailureDetails {
  return {
    command: outcome.result.command,
    cwd: outcome.result.cwd,
    stdout: outcome.result.stdout,
    stderr: outcome.result.stderr,
    exitCode: outcome.result.exitCode,
    ...(outcome.timedOut ? { timedOut: true } : {}),
    ...(outcome.truncated ? { truncated: true } : {}),
    ...(extra ?? {}),
  };
}

/** First meaningful line of git stderr, used as the API error message. */
export function stderrMessage(outcome: GitOutcome, fallback: string): string {
  const lines = outcome.result.stderr
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('hint:'));
  return lines[0] ?? fallback;
}

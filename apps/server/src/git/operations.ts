/**
 * Mutation execution layer.
 *
 * Every write endpoint runs one or more git commands through `runMutation`,
 * which produces the contract's `OperationResult` (`{ result, summary? }`),
 * classifies conflicts and always reports the display-safe command string.
 */
import type { CommandResult, OperationResult } from '@gitdeck/shared';
import { ApiError } from '../app';
import type { ServerContext } from '../context';
import { computeSummary, gitRun, readOperation, type RepoMeta } from './repo';
import { commandDetails } from './runner';

export interface MutationSpec {
  /** Sequential git invocations; the display command joins them with ` && `. */
  steps: string[][];
  /** Human readable operation name used in error messages. */
  action: string;
  /** git failures are reported as 409 CONFLICT when an operation is in progress. */
  conflictAware?: boolean;
  /** Include a fresh RepoSummary (default true). */
  includeSummary?: boolean;
}

/** Combine several successful command results into one OperationResult. */
export function combineResults(results: CommandResult[]): CommandResult {
  if (results.length === 1) {
    const only = results[0] as CommandResult;
    return { ...only };
  }
  const first = results[0] as CommandResult;
  return {
    command: results.map((result) => result.command).join(' && '),
    cwd: first.cwd,
    stdout: results
      .map((result) => result.stdout)
      .filter(Boolean)
      .join('\n'),
    stderr: results
      .map((result) => result.stderr)
      .filter(Boolean)
      .join('\n'),
    exitCode: 0,
    durationMs: results.reduce((total, result) => total + result.durationMs, 0),
    ok: true,
  };
}

export async function runMutation(
  ctx: ServerContext,
  meta: RepoMeta,
  spec: MutationSpec,
): Promise<OperationResult> {
  const results: CommandResult[] = [];
  for (const args of spec.steps) {
    const outcome = await gitRun(ctx, meta.root, args);
    results.push(outcome.result);
    if (outcome.timedOut || !outcome.result.ok) {
      const operation = readOperation(meta.gitDir);
      const conflict = Boolean(spec.conflictAware && operation);
      const outputLine =
        outcome.result.stderr
          .split(/\r?\n/)
          .map((line) => line.trim())
          .find((line) => line && !line.startsWith('hint:')) ??
        outcome.result.stdout
          .split(/\r?\n/)
          .map((line) => line.trim())
          .find((line) => line && !line.startsWith('hint:') && !line.startsWith('On branch'));
      throw new ApiError(
        conflict ? 409 : outcome.timedOut ? 504 : 400,
        conflict ? 'CONFLICT' : outcome.timedOut ? 'TIMEOUT' : 'GIT_ERROR',
        conflict
          ? `${spec.action} stopped with conflicts — resolve them and continue`
          : (outputLine ?? `${spec.action} failed (exit code ${outcome.result.exitCode})`),
        commandDetails(outcome, {
          ...(operation ? { operation } : {}),
          steps: results.map((result) => commandDetailsFromResult(result)),
        }),
      );
    }
  }

  const response: OperationResult = { result: combineResults(results) };
  if (spec.includeSummary !== false) {
    try {
      response.summary = await computeSummary(ctx, meta);
    } catch {
      // The mutation itself succeeded: a summary read failure must not fail it.
    }
  }
  return response;
}

function commandDetailsFromResult(result: CommandResult): Record<string, unknown> {
  return {
    command: result.command,
    cwd: result.cwd,
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode,
  };
}

/* ------------------------------------------------------------------ */
/* Staging / working tree                                              */
/* ------------------------------------------------------------------ */

export function buildStageArgs(paths: string[], all?: boolean): string[][] {
  if (all) return [['add', '-A']];
  return [['add', '--', ...paths]];
}

export function buildUnstageArgs(paths: string[], all?: boolean, hasHead = true): string[][] {
  if (!hasHead) {
    // Unborn branch: remove entries from the index without touching the disk.
    return all
      ? [['rm', '--cached', '-r', '--quiet', '--', '.']]
      : [['rm', '--cached', '--quiet', '--', ...paths]];
  }
  if (all) return [['reset', '--quiet', 'HEAD']];
  return [['reset', '--quiet', 'HEAD', '--', ...paths]];
}

export function buildCommitArgs(input: {
  message: string;
  amend?: boolean;
  signoff?: boolean;
  noVerify?: boolean;
  author?: { name: string; email: string };
}): string[] {
  const args = ['commit', '-m', input.message];
  if (input.amend) args.push('--amend');
  if (input.signoff) args.push('--signoff');
  if (input.noVerify) args.push('--no-verify');
  if (input.author) args.push(`--author=${input.author.name} <${input.author.email}>`);
  return args;
}

export function buildResolveSteps(
  paths: string[],
  resolution: 'ours' | 'theirs' | 'mark-resolved',
): string[][] {
  if (resolution === 'mark-resolved') return [['add', '--', ...paths]];
  return [
    ['checkout', `--${resolution}`, '--', ...paths],
    ['add', '--', ...paths],
  ];
}

/* ------------------------------------------------------------------ */
/* Branch operations                                                   */
/* ------------------------------------------------------------------ */

export function buildCheckoutArgs(target: string, detach?: boolean, force?: boolean): string[] {
  const args = ['checkout'];
  if (force) args.push('--force');
  if (detach) args.push('--detach');
  args.push(target);
  return args;
}

export function buildBranchCreateArgs(name: string, startPoint?: string, checkout?: boolean): string[] {
  if (checkout) {
    const args = ['checkout', '-b', name];
    if (startPoint) args.push(startPoint);
    return args;
  }
  const args = ['branch', name];
  if (startPoint) args.push(startPoint);
  return args;
}

export function buildBranchDeleteArgs(name: string, force?: boolean): string[] {
  return ['branch', force ? '-D' : '-d', name];
}

export function buildMergeArgs(
  branch: string,
  options: { noFf?: boolean; squash?: boolean; message?: string },
): string[] {
  const args = ['merge'];
  if (options.noFf) args.push('--no-ff');
  if (options.squash) args.push('--squash');
  if (options.message) args.push('-m', options.message);
  else args.push('--no-edit');
  args.push(branch);
  return args;
}

export function buildRebaseArgs(onto: string, autostash?: boolean): string[] {
  const args = ['rebase'];
  if (autostash) args.push('--autostash');
  args.push(onto);
  return args;
}

export function buildResetArgs(target: string, mode: 'soft' | 'mixed' | 'hard'): string[] {
  return ['reset', `--${mode}`, target];
}

/* ------------------------------------------------------------------ */
/* Sync operations                                                     */
/* ------------------------------------------------------------------ */

export function buildFetchArgs(remote?: string, prune?: boolean, all?: boolean): string[] {
  const args = ['fetch'];
  if (all) args.push('--all');
  if (prune) args.push('--prune');
  if (!all && remote) args.push(remote);
  return args;
}

export function buildPullArgs(options: {
  remote?: string;
  branch?: string;
  strategy?: 'merge' | 'rebase' | 'ff-only';
  autostash?: boolean;
}): string[] {
  const args = ['pull'];
  if (options.strategy === 'rebase') args.push('--rebase');
  else if (options.strategy === 'ff-only') args.push('--ff-only');
  else if (options.strategy === 'merge') args.push('--no-rebase');
  if (options.autostash) args.push('--autostash');
  if (options.remote) args.push(options.remote);
  if (options.branch) {
    if (!options.remote) args.push('origin');
    args.push(options.branch);
  }
  return args;
}

export function buildPushArgs(options: {
  remote?: string;
  branch?: string;
  setUpstream?: boolean;
  force?: 'none' | 'with-lease';
  tags?: boolean;
}): string[] {
  const args = ['push'];
  if (options.setUpstream) args.push('--set-upstream');
  if (options.force === 'with-lease') args.push('--force-with-lease');
  if (options.tags) args.push('--tags');
  if (options.remote) args.push(options.remote);
  if (options.branch) args.push(options.branch);
  return args;
}

/** Command used to delete a branch on its remote. */
export function buildRemoteBranchDeleteArgs(remote: string, branch: string): string[] {
  return ['push', remote, '--delete', branch];
}

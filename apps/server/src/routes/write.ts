/**
 * Mutating repository routes: staging/commit/conflicts, branch operations and
 * remote synchronisation (fetch/pull/push). Every endpoint returns
 * `OperationResult` (`{ result, summary? }`).
 */
import { Router } from 'express';
import {
  branchCreateInputSchema,
  branchDeleteInputSchema,
  branchRenameInputSchema,
  checkoutInputSchema,
  cherryPickInputSchema,
  commitInputSchema,
  discardInputSchema,
  fetchInputSchema,
  mergeInputSchema,
  pullInputSchema,
  pushInputSchema,
  rebaseInputSchema,
  resetInputSchema,
  resolveInputSchema,
  revertInputSchema,
  stageInputSchema,
  unstageInputSchema,
  upstreamInputSchema,
  type CommandResult,
} from '@gitdeck/shared';
import { ApiError } from '../app';
import type { ServerContext } from '../context';
import {
  buildBranchCreateArgs,
  buildBranchDeleteArgs,
  buildCheckoutArgs,
  buildCommitArgs,
  buildFetchArgs,
  buildMergeArgs,
  buildPullArgs,
  buildPushArgs,
  buildRebaseArgs,
  buildRemoteBranchDeleteArgs,
  buildResetArgs,
  buildResolveSteps,
  buildStageArgs,
  buildUnstageArgs,
  runMutation,
} from '../git/operations';
import { assertSafeRevision, computeSummary, gitRun, type RepoMeta } from '../git/repo';
import { handle, parseBody, repoFromRequest } from './util';

async function hasHead(ctx: ServerContext, meta: RepoMeta): Promise<boolean> {
  const outcome = await gitRun(ctx, meta.root, ['rev-parse', '--verify', '--quiet', 'HEAD']);
  return outcome.result.ok;
}

function emptyResult(cwd: string): CommandResult {
  return { command: '', cwd, stdout: '', stderr: '', exitCode: 0, durationMs: 0, ok: true };
}

async function resolveRemoteBranch(
  ctx: ServerContext,
  meta: RepoMeta,
  branch: string,
): Promise<{ remote: string; remoteBranch: string }> {
  const outcome = await gitRun(ctx, meta.root, ['rev-parse', '--abbrev-ref', `${branch}@{upstream}`]);
  if (outcome.result.ok) {
    const value = outcome.result.stdout.trim();
    const slash = value.indexOf('/');
    if (slash > 0) return { remote: value.slice(0, slash), remoteBranch: value.slice(slash + 1) };
  }
  const remotes = await gitRun(ctx, meta.root, ['remote']);
  const first = remotes.result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)[0];
  return { remote: first ?? 'origin', remoteBranch: branch };
}

export function createRepoWriteRouter(ctx: ServerContext): Router {
  const router = Router();

  /* ------------------------------ staging ------------------------------ */

  router.post(
    '/repos/:id/stage',
    handle(async (req, res) => {
      const meta = await repoFromRequest(ctx, req);
      const input = parseBody(stageInputSchema, req);
      if (!input.all && input.paths.length === 0) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'No paths to stage');
      }
      res.json(
        await runMutation(ctx, meta, {
          steps: buildStageArgs(input.paths, input.all),
          action: 'git add',
        }),
      );
    }),
  );

  router.post(
    '/repos/:id/unstage',
    handle(async (req, res) => {
      const meta = await repoFromRequest(ctx, req);
      const input = parseBody(unstageInputSchema, req);
      if (!input.all && input.paths.length === 0) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'No paths to unstage');
      }
      const head = await hasHead(ctx, meta);
      res.json(
        await runMutation(ctx, meta, {
          steps: buildUnstageArgs(input.paths, input.all, head),
          action: 'git reset',
        }),
      );
    }),
  );

  router.post(
    '/repos/:id/discard',
    handle(async (req, res) => {
      const meta = await repoFromRequest(ctx, req);
      const input = parseBody(discardInputSchema, req);
      const trackedOutcome = await gitRun(ctx, meta.root, ['ls-files', '-z', '--', ...input.paths]);
      const tracked = new Set(trackedOutcome.result.stdout.split('\0').filter((entry) => entry.length > 0));
      const trackedPaths = input.paths.filter((candidate) => tracked.has(candidate));
      const untrackedPaths = input.paths.filter((candidate) => !tracked.has(candidate));
      const steps: string[][] = [];
      if (trackedPaths.length > 0) {
        if (!(await hasHead(ctx, meta))) {
          throw new ApiError(400, 'GIT_ERROR', 'Cannot discard tracked changes before the first commit');
        }
        steps.push(['restore', '--source=HEAD', '--staged', '--worktree', '--', ...trackedPaths]);
      }
      if (untrackedPaths.length > 0 && input.untracked !== false) {
        steps.push(['clean', '-f', '-d', '--', ...untrackedPaths]);
      }
      if (steps.length === 0) {
        res.json({ result: emptyResult(meta.root), summary: await computeSummary(ctx, meta) });
        return;
      }
      res.json(await runMutation(ctx, meta, { steps, action: 'discard changes' }));
    }),
  );

  router.post(
    '/repos/:id/commit',
    handle(async (req, res) => {
      const meta = await repoFromRequest(ctx, req);
      const input = parseBody(commitInputSchema, req);
      const commitArgs = buildCommitArgs({
        message: input.message,
        ...(input.amend !== undefined ? { amend: input.amend } : {}),
        ...(input.signoff !== undefined ? { signoff: input.signoff } : {}),
        ...(input.noVerify !== undefined ? { noVerify: input.noVerify } : {}),
        ...(input.author ? { author: input.author } : {}),
      });
      const steps: string[][] = [];
      if (input.stageAll) steps.push(['add', '-A']);
      steps.push(commitArgs);
      res.json(await runMutation(ctx, meta, { steps, action: 'git commit' }));
    }),
  );

  router.post(
    '/repos/:id/resolve',
    handle(async (req, res) => {
      const meta = await repoFromRequest(ctx, req);
      const input = parseBody(resolveInputSchema, req);
      res.json(
        await runMutation(ctx, meta, {
          steps: buildResolveSteps(input.paths, input.resolution),
          action: 'resolve conflicts',
          conflictAware: true,
        }),
      );
    }),
  );

  /* ------------------------------ branches ----------------------------- */

  router.post(
    '/repos/:id/branch/checkout',
    handle(async (req, res) => {
      const meta = await repoFromRequest(ctx, req);
      const input = parseBody(checkoutInputSchema, req);
      res.json(
        await runMutation(ctx, meta, {
          steps: [buildCheckoutArgs(input.target, input.detach, input.force)],
          action: 'git checkout',
          conflictAware: true,
        }),
      );
    }),
  );

  router.post(
    '/repos/:id/branch/create',
    handle(async (req, res) => {
      const meta = await repoFromRequest(ctx, req);
      const input = parseBody(branchCreateInputSchema, req);
      res.json(
        await runMutation(ctx, meta, {
          steps: [buildBranchCreateArgs(input.name, input.startPoint, input.checkout)],
          action: 'create branch',
        }),
      );
    }),
  );

  router.post(
    '/repos/:id/branch/rename',
    handle(async (req, res) => {
      const meta = await repoFromRequest(ctx, req);
      const input = parseBody(branchRenameInputSchema, req);
      res.json(
        await runMutation(ctx, meta, {
          steps: [['branch', '-m', input.from, input.to]],
          action: 'rename branch',
        }),
      );
    }),
  );

  router.post(
    '/repos/:id/branch/delete',
    handle(async (req, res) => {
      const meta = await repoFromRequest(ctx, req);
      const input = parseBody(branchDeleteInputSchema, req);
      if (input.remote) {
        const target = await resolveRemoteBranch(ctx, meta, input.name);
        res.json(
          await runMutation(ctx, meta, {
            steps: [buildRemoteBranchDeleteArgs(target.remote, target.remoteBranch)],
            action: 'delete remote branch',
          }),
        );
        return;
      }
      res.json(
        await runMutation(ctx, meta, {
          steps: [buildBranchDeleteArgs(input.name, input.force)],
          action: 'delete branch',
        }),
      );
    }),
  );

  router.post(
    '/repos/:id/branch/merge',
    handle(async (req, res) => {
      const meta = await repoFromRequest(ctx, req);
      const input = parseBody(mergeInputSchema, req);
      assertSafeRevision(input.branch, 'branch');
      res.json(
        await runMutation(ctx, meta, {
          steps: [buildMergeArgs(input.branch, input)],
          action: 'git merge',
          conflictAware: true,
        }),
      );
    }),
  );

  router.post(
    '/repos/:id/branch/rebase',
    handle(async (req, res) => {
      const meta = await repoFromRequest(ctx, req);
      const input = parseBody(rebaseInputSchema, req);
      assertSafeRevision(input.onto, 'onto');
      res.json(
        await runMutation(ctx, meta, {
          steps: [buildRebaseArgs(input.onto, input.autostash)],
          action: 'git rebase',
          conflictAware: true,
        }),
      );
    }),
  );

  router.post(
    '/repos/:id/branch/cherry-pick',
    handle(async (req, res) => {
      const meta = await repoFromRequest(ctx, req);
      const input = parseBody(cherryPickInputSchema, req);
      for (const revision of input.commits) assertSafeRevision(revision, 'commit');
      res.json(
        await runMutation(ctx, meta, {
          steps: [['cherry-pick', ...input.commits]],
          action: 'git cherry-pick',
          conflictAware: true,
        }),
      );
    }),
  );

  router.post(
    '/repos/:id/branch/revert',
    handle(async (req, res) => {
      const meta = await repoFromRequest(ctx, req);
      const input = parseBody(revertInputSchema, req);
      for (const revision of input.commits) assertSafeRevision(revision, 'commit');
      const args = ['revert', '--no-edit'];
      if (input.noCommit) args.push('--no-commit');
      args.push(...input.commits);
      res.json(
        await runMutation(ctx, meta, {
          steps: [args],
          action: 'git revert',
          conflictAware: true,
        }),
      );
    }),
  );

  router.post(
    '/repos/:id/branch/reset',
    handle(async (req, res) => {
      const meta = await repoFromRequest(ctx, req);
      const input = parseBody(resetInputSchema, req);
      assertSafeRevision(input.target, 'target');
      res.json(
        await runMutation(ctx, meta, {
          steps: [buildResetArgs(input.target, input.mode)],
          action: 'git reset',
        }),
      );
    }),
  );

  router.post(
    '/repos/:id/branch/upstream',
    handle(async (req, res) => {
      const meta = await repoFromRequest(ctx, req);
      const input = parseBody(upstreamInputSchema, req);
      if (input.remote === null || input.remote === undefined) {
        res.json(
          await runMutation(ctx, meta, {
            steps: [['branch', '--unset-upstream', input.branch]],
            action: 'unset upstream',
          }),
        );
        return;
      }
      const remoteBranch = input.remoteBranch ?? input.branch;
      res.json(
        await runMutation(ctx, meta, {
          steps: [['branch', `--set-upstream-to=${input.remote}/${remoteBranch}`, input.branch]],
          action: 'set upstream',
        }),
      );
    }),
  );

  /* ------------------------------- sync -------------------------------- */

  router.post(
    '/repos/:id/fetch',
    handle(async (req, res) => {
      const meta = await repoFromRequest(ctx, req);
      const input = parseBody(fetchInputSchema, req);
      res.json(
        await runMutation(ctx, meta, {
          steps: [buildFetchArgs(input.remote, input.prune, input.all)],
          action: 'git fetch',
        }),
      );
    }),
  );

  router.post(
    '/repos/:id/pull',
    handle(async (req, res) => {
      const meta = await repoFromRequest(ctx, req);
      const input = parseBody(pullInputSchema, req);
      if (input.branch) assertSafeRevision(input.branch, 'branch');
      res.json(
        await runMutation(ctx, meta, {
          steps: [buildPullArgs(input)],
          action: 'git pull',
          conflictAware: true,
        }),
      );
    }),
  );

  router.post(
    '/repos/:id/push',
    handle(async (req, res) => {
      const meta = await repoFromRequest(ctx, req);
      const input = parseBody(pushInputSchema, req);
      if (input.branch) assertSafeRevision(input.branch, 'branch');
      if (input.remote) assertSafeRevision(input.remote, 'remote');
      res.json(
        await runMutation(ctx, meta, {
          steps: [buildPushArgs(input)],
          action: 'git push',
        }),
      );
    }),
  );

  return router;
}

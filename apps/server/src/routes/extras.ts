/**
 * Mutating routes for remotes, tags, stashes, worktrees, git config and the
 * raw `exec` escape hatch.
 */
import path from 'node:path';
import { Router } from 'express';
import {
  EXEC_ALLOWED_SUBCOMMANDS,
  configSetInputSchema,
  configUnsetInputSchema,
  execInputSchema,
  remoteAddInputSchema,
  remoteRemoveInputSchema,
  remoteUpdateInputSchema,
  stashIndexInputSchema,
  stashPushInputSchema,
  tagCreateInputSchema,
  tagDeleteInputSchema,
  worktreeAddInputSchema,
  worktreeLockInputSchema,
  worktreeRemoveInputSchema,
} from '@gitdeck/shared';
import { ApiError } from '../app';
import type { ServerContext } from '../context';
import { runMutation } from '../git/operations';
import type { RepoMeta } from '../git/repo';
import { handle, parseBody, repoFromRequest } from './util';

function assertConfigKey(key: string): void {
  if (!key || key.startsWith('-') || /[\0\r\n]/.test(key)) {
    throw new ApiError(400, 'VALIDATION_ERROR', `Invalid config key: ${JSON.stringify(key)}`);
  }
}

/** Resolve a worktree path (relative paths are resolved against the repo root). */
function resolveWorktreePath(meta: RepoMeta, raw: string): string {
  const resolved = path.isAbsolute(raw) ? path.resolve(raw) : path.resolve(meta.root, raw);
  const segments = path.relative(path.parse(resolved).root, resolved).split(/[\\/]/);
  if (segments.includes('.git')) {
    throw new ApiError(400, 'UNSAFE_PATH', `Worktree path must not be inside .git: ${raw}`);
  }
  return resolved;
}

function scopeFlag(scope: 'local' | 'global'): string {
  return scope === 'global' ? '--global' : '--local';
}

export function createRepoExtrasRouter(ctx: ServerContext): Router {
  const router = Router();

  /* ------------------------------ remotes ------------------------------ */

  router.post(
    '/repos/:id/remotes/add',
    handle(async (req, res) => {
      const meta = await repoFromRequest(ctx, req);
      const input = parseBody(remoteAddInputSchema, req);
      const steps: string[][] = [['remote', 'add', input.name, input.url]];
      if (input.pushUrl) steps.push(['remote', 'set-url', '--push', input.name, input.pushUrl]);
      res.json(await runMutation(ctx, meta, { steps, action: 'add remote' }));
    }),
  );

  router.post(
    '/repos/:id/remotes/update',
    handle(async (req, res) => {
      const meta = await repoFromRequest(ctx, req);
      const input = parseBody(remoteUpdateInputSchema, req);
      const steps: string[][] = [];
      let effectiveName = input.name;
      if (input.newName && input.newName !== input.name) {
        steps.push(['remote', 'rename', input.name, input.newName]);
        effectiveName = input.newName;
      }
      if (input.url) steps.push(['remote', 'set-url', effectiveName, input.url]);
      if (input.pushUrl) steps.push(['remote', 'set-url', '--push', effectiveName, input.pushUrl]);
      if (steps.length === 0) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Nothing to update on the remote');
      }
      res.json(await runMutation(ctx, meta, { steps, action: 'update remote' }));
    }),
  );

  router.post(
    '/repos/:id/remotes/remove',
    handle(async (req, res) => {
      const meta = await repoFromRequest(ctx, req);
      const input = parseBody(remoteRemoveInputSchema, req);
      res.json(
        await runMutation(ctx, meta, {
          steps: [['remote', 'remove', input.name]],
          action: 'remove remote',
        }),
      );
    }),
  );

  /* -------------------------------- tags ------------------------------- */

  router.post(
    '/repos/:id/tags',
    handle(async (req, res) => {
      const meta = await repoFromRequest(ctx, req);
      const input = parseBody(tagCreateInputSchema, req);
      const tagArgs = ['tag'];
      if (input.message) tagArgs.push('-a', '-m', input.message);
      tagArgs.push(input.name);
      if (input.target) tagArgs.push(input.target);
      const steps: string[][] = [tagArgs];
      if (input.push) {
        steps.push(['push', input.remote ?? 'origin', `refs/tags/${input.name}`]);
      }
      res.json(await runMutation(ctx, meta, { steps, action: 'create tag' }));
    }),
  );

  router.post(
    '/repos/:id/tags/delete',
    handle(async (req, res) => {
      const meta = await repoFromRequest(ctx, req);
      const input = parseBody(tagDeleteInputSchema, req);
      const steps: string[][] = [['tag', '-d', input.name]];
      if (input.remote) {
        steps.push(['push', input.remote, `:refs/tags/${input.name}`]);
      }
      res.json(await runMutation(ctx, meta, { steps, action: 'delete tag' }));
    }),
  );

  /* ------------------------------ stashes ------------------------------ */

  router.post(
    '/repos/:id/stashes',
    handle(async (req, res) => {
      const meta = await repoFromRequest(ctx, req);
      const input = parseBody(stashPushInputSchema, req);
      const args = ['stash', 'push'];
      if (input.includeUntracked) args.push('-u');
      if (input.keepIndex) args.push('--keep-index');
      if (input.message) args.push('-m', input.message);
      res.json(await runMutation(ctx, meta, { steps: [args], action: 'git stash push' }));
    }),
  );

  router.post(
    '/repos/:id/stashes/apply',
    handle(async (req, res) => {
      const meta = await repoFromRequest(ctx, req);
      const input = parseBody(stashIndexInputSchema, req);
      res.json(
        await runMutation(ctx, meta, {
          steps: [['stash', 'apply', `stash@{${input.index}}`]],
          action: 'git stash apply',
          conflictAware: true,
        }),
      );
    }),
  );

  router.post(
    '/repos/:id/stashes/pop',
    handle(async (req, res) => {
      const meta = await repoFromRequest(ctx, req);
      const input = parseBody(stashIndexInputSchema, req);
      res.json(
        await runMutation(ctx, meta, {
          steps: [['stash', 'pop', `stash@{${input.index}}`]],
          action: 'git stash pop',
          conflictAware: true,
        }),
      );
    }),
  );

  router.post(
    '/repos/:id/stashes/drop',
    handle(async (req, res) => {
      const meta = await repoFromRequest(ctx, req);
      const input = parseBody(stashIndexInputSchema, req);
      res.json(
        await runMutation(ctx, meta, {
          steps: [['stash', 'drop', `stash@{${input.index}}`]],
          action: 'git stash drop',
        }),
      );
    }),
  );

  /* ----------------------------- worktrees ----------------------------- */

  router.post(
    '/repos/:id/worktrees/add',
    handle(async (req, res) => {
      const meta = await repoFromRequest(ctx, req);
      const input = parseBody(worktreeAddInputSchema, req);
      const worktreePath = resolveWorktreePath(meta, input.path);
      const args = ['worktree', 'add'];
      if (input.force) args.push('--force');
      if (input.newBranch) {
        args.push('-b', input.newBranch, worktreePath);
        if (input.startPoint) args.push(input.startPoint);
      } else if (input.branch) {
        args.push(worktreePath, input.branch);
      } else {
        args.push('--detach', worktreePath, input.startPoint ?? 'HEAD');
      }
      res.json(await runMutation(ctx, meta, { steps: [args], action: 'git worktree add' }));
    }),
  );

  router.post(
    '/repos/:id/worktrees/remove',
    handle(async (req, res) => {
      const meta = await repoFromRequest(ctx, req);
      const input = parseBody(worktreeRemoveInputSchema, req);
      const worktreePath = resolveWorktreePath(meta, input.path);
      const args = ['worktree', 'remove'];
      if (input.force) args.push('--force');
      args.push(worktreePath);
      res.json(await runMutation(ctx, meta, { steps: [args], action: 'git worktree remove' }));
    }),
  );

  router.post(
    '/repos/:id/worktrees/prune',
    handle(async (req, res) => {
      const meta = await repoFromRequest(ctx, req);
      res.json(
        await runMutation(ctx, meta, {
          steps: [['worktree', 'prune']],
          action: 'git worktree prune',
        }),
      );
    }),
  );

  router.post(
    '/repos/:id/worktrees/lock',
    handle(async (req, res) => {
      const meta = await repoFromRequest(ctx, req);
      const input = parseBody(worktreeLockInputSchema, req);
      const worktreePath = resolveWorktreePath(meta, input.path);
      const args = input.lock
        ? ['worktree', 'lock', ...(input.reason ? ['--reason', input.reason] : []), worktreePath]
        : ['worktree', 'unlock', worktreePath];
      res.json(await runMutation(ctx, meta, { steps: [args], action: 'git worktree lock' }));
    }),
  );

  /* ------------------------------- config ------------------------------ */

  router.post(
    '/repos/:id/config/set',
    handle(async (req, res) => {
      const meta = await repoFromRequest(ctx, req);
      const input = parseBody(configSetInputSchema, req);
      assertConfigKey(input.key);
      res.json(
        await runMutation(ctx, meta, {
          steps: [['config', scopeFlag(input.scope), '--', input.key, input.value]],
          action: 'git config set',
        }),
      );
    }),
  );

  router.post(
    '/repos/:id/config/unset',
    handle(async (req, res) => {
      const meta = await repoFromRequest(ctx, req);
      const input = parseBody(configUnsetInputSchema, req);
      assertConfigKey(input.key);
      res.json(
        await runMutation(ctx, meta, {
          steps: [['config', scopeFlag(input.scope), '--unset', input.key]],
          action: 'git config unset',
        }),
      );
    }),
  );

  /* -------------------------------- exec ------------------------------- */

  router.post(
    '/repos/:id/exec',
    handle(async (req, res) => {
      const meta = await repoFromRequest(ctx, req);
      const input = parseBody(execInputSchema, req);
      const [subcommand, ...rest] = input.args;
      if (!subcommand || !(EXEC_ALLOWED_SUBCOMMANDS as readonly string[]).includes(subcommand)) {
        throw new ApiError(400, 'VALIDATION_ERROR', `Command not allowed: ${subcommand ?? '(empty)'}`);
      }
      res.json(
        await runMutation(ctx, meta, {
          steps: [[subcommand, ...rest]],
          action: `git ${subcommand}`,
          conflictAware: true,
        }),
      );
    }),
  );

  return router;
}

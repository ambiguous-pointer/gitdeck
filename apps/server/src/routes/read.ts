/**
 * Read-only repository routes: summary, status, log, commit details, diffs and
 * every listing (branches, remotes, tags, stashes, worktrees, config, reflog).
 */
import { Router } from 'express';
import { diffQueryInputSchema, logQuerySchema } from '@gitdeck/shared';
import type { ServerContext } from '../context';
import {
  computeStatus,
  computeSummary,
  readBranches,
  readCommitDetail,
  readCommitDiff,
  readConfig,
  readDiff,
  readLog,
  readReflog,
  readRemotes,
  readStashShow,
  readStashes,
  readTags,
  readWorktrees,
} from '../git/repo';
import { handle, intParam, limitParam, param, parseQuery, repoFromRequest } from './util';

const CONFIG_SCOPES = new Set(['all', 'local', 'global']);

export function createRepoReadRouter(ctx: ServerContext): Router {
  const router = Router();

  router.get(
    '/repos/:id/summary',
    handle(async (req, res) => {
      const meta = await repoFromRequest(ctx, req);
      res.json(await computeSummary(ctx, meta));
    }),
  );

  router.get(
    '/repos/:id/status',
    handle(async (req, res) => {
      const meta = await repoFromRequest(ctx, req);
      res.json(await computeStatus(ctx, meta));
    }),
  );

  router.get(
    '/repos/:id/log',
    handle(async (req, res) => {
      const meta = await repoFromRequest(ctx, req);
      const query = parseQuery(logQuerySchema, req);
      res.json(await readLog(ctx, meta, query));
    }),
  );

  router.get(
    '/repos/:id/reflog',
    handle(async (req, res) => {
      const meta = await repoFromRequest(ctx, req);
      const limit = limitParam(req, 100);
      res.json(await readReflog(ctx, meta, limit));
    }),
  );

  router.get(
    '/repos/:id/commits/:hash',
    handle(async (req, res) => {
      const meta = await repoFromRequest(ctx, req);
      res.json(await readCommitDetail(ctx, meta, param(req, 'hash')));
    }),
  );

  router.get(
    '/repos/:id/commits/:hash/diff',
    handle(async (req, res) => {
      const meta = await repoFromRequest(ctx, req);
      const filterPath = typeof req.query.path === 'string' && req.query.path ? req.query.path : undefined;
      res.json({ files: await readCommitDiff(ctx, meta, param(req, 'hash'), filterPath) });
    }),
  );

  router.get(
    '/repos/:id/diff',
    handle(async (req, res) => {
      const meta = await repoFromRequest(ctx, req);
      const query = parseQuery(diffQueryInputSchema, req);
      res.json({ files: await readDiff(ctx, meta, query) });
    }),
  );

  router.get(
    '/repos/:id/branches',
    handle(async (req, res) => {
      const meta = await repoFromRequest(ctx, req);
      res.json({ branches: await readBranches(ctx, meta) });
    }),
  );

  router.get(
    '/repos/:id/remotes',
    handle(async (req, res) => {
      const meta = await repoFromRequest(ctx, req);
      res.json({ remotes: await readRemotes(ctx, meta) });
    }),
  );

  router.get(
    '/repos/:id/tags',
    handle(async (req, res) => {
      const meta = await repoFromRequest(ctx, req);
      res.json({ tags: await readTags(ctx, meta) });
    }),
  );

  router.get(
    '/repos/:id/stashes',
    handle(async (req, res) => {
      const meta = await repoFromRequest(ctx, req);
      res.json({ stashes: await readStashes(ctx, meta) });
    }),
  );

  router.get(
    '/repos/:id/stashes/:index/show',
    handle(async (req, res) => {
      const meta = await repoFromRequest(ctx, req);
      const index = intParam(param(req, 'index'), 'stash index');
      const { result, files } = await readStashShow(ctx, meta, index);
      res.json({ result, diff: files });
    }),
  );

  router.get(
    '/repos/:id/worktrees',
    handle(async (req, res) => {
      const meta = await repoFromRequest(ctx, req);
      res.json({ worktrees: await readWorktrees(ctx, meta) });
    }),
  );

  router.get(
    '/repos/:id/config',
    handle(async (req, res) => {
      const meta = await repoFromRequest(ctx, req);
      const raw = typeof req.query.scope === 'string' ? req.query.scope : 'all';
      if (!CONFIG_SCOPES.has(raw)) {
        res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: `Invalid config scope: ${raw}` },
        });
        return;
      }
      const scope = raw as 'all' | 'local' | 'global';
      res.json({ entries: await readConfig(ctx, meta, scope) });
    }),
  );

  return router;
}

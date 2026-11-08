/**
 * Application level routes: health/home, repository lifecycle, scanning and
 * persisted settings.
 */
import { Router } from 'express';
import { openRepoInputSchema, scanInputSchema, settingsPatchInputSchema } from '@gitdeck/shared';
import { ApiError } from '../app';
import type { ServerContext } from '../context';
import { appInfo } from '../context';
import { openRepository } from '../git/repo';
import { scanRepos } from '../scan';
import { handle, parseBody, repoFromRequest } from './util';

export function createMetaRouter(ctx: ServerContext): Router {
  const router = Router();

  router.get(
    '/home',
    handle(async (_req, res) => {
      await ctx.autoOpenDemo();
      res.json({ app: appInfo(ctx), settings: ctx.settingsStore.get(), repos: ctx.registry.list() });
    }),
  );

  router.get(
    '/repos',
    handle(async (_req, res) => {
      await ctx.autoOpenDemo();
      res.json({ repos: ctx.registry.list() });
    }),
  );

  router.post(
    '/repos/open',
    handle(async (req, res) => {
      const input = parseBody(openRepoInputSchema, req);
      const result = await openRepository(ctx, input.path);
      res.json(result);
    }),
  );

  router.post(
    '/repos/scan',
    handle(async (req, res) => {
      const input = parseBody(scanInputSchema, req);
      const result = await scanRepos(ctx, input);
      res.json(result);
    }),
  );

  router.delete(
    '/repos/:id',
    handle(async (req, res) => {
      const meta = await repoFromRequest(ctx, req);
      const removed = ctx.registry.remove(meta.id);
      if (!removed) throw new ApiError(404, 'NOT_FOUND', `Unknown repository id: ${meta.id}`);
      ctx.metaCache.delete(meta.id);
      res.json({ ok: true });
    }),
  );

  router.get(
    '/settings',
    handle(async (_req, res) => {
      res.json(ctx.settingsStore.get());
    }),
  );

  router.patch(
    '/settings',
    handle(async (req, res) => {
      const patch = parseBody(settingsPatchInputSchema, req);
      const settings = ctx.settingsStore.update(patch);
      if (patch.gitPath) ctx.gitPath = patch.gitPath;
      if (patch.commandTimeoutMs) ctx.commandTimeoutMs = patch.commandTimeoutMs;
      res.json(settings);
    }),
  );

  return router;
}

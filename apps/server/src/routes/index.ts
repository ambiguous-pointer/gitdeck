/**
 * Aggregates every feature router under the `/api` prefix.
 */
import { Router } from 'express';
import type { ServerContext } from '../context';
import { createMetaRouter } from './meta';
import { createRepoReadRouter } from './read';
import { createRepoWriteRouter } from './write';
import { createRepoExtrasRouter } from './extras';

export function createApiRouter(ctx: ServerContext): Router {
  const router = Router();
  router.use(createMetaRouter(ctx));
  router.use(createRepoReadRouter(ctx));
  router.use(createRepoWriteRouter(ctx));
  router.use(createRepoExtrasRouter(ctx));
  return router;
}

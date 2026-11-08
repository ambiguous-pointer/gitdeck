/**
 * Shared helpers for the feature routers: async handler wrapper, zod request
 * parsing and repository-id resolution.
 */
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { z } from 'zod';
import { ApiError } from '../app';
import type { ServerContext } from '../context';
import { getRepoMeta, type RepoMeta } from '../git/repo';

export type AsyncHandler = (req: Request, res: Response) => Promise<void>;

/** Wrap an async handler so rejected promises hit the error envelope. */
export function handle(fn: AsyncHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res).catch(next);
  };
}

function validationError(source: string, error: z.ZodError): ApiError {
  return new ApiError(400, 'VALIDATION_ERROR', `Invalid ${source}`, error.flatten());
}

/** Validate `req.body` against a shared zod schema. */
export function parseBody<S extends z.ZodTypeAny>(schema: S, req: Request): z.infer<S> {
  const parsed = schema.safeParse(req.body ?? {});
  if (!parsed.success) throw validationError('request body', parsed.error);
  return parsed.data as z.infer<S>;
}

/** Validate `req.query` against a shared zod schema. */
export function parseQuery<S extends z.ZodTypeAny>(schema: S, req: Request): z.infer<S> {
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) throw validationError('query parameters', parsed.error);
  return parsed.data as z.infer<S>;
}

/** Read a path parameter as a single string (Express 5 may type it as string[]). */
export function param(req: Request, name: string): string {
  const value = req.params[name];
  if (Array.isArray(value)) return value[0] ?? '';
  return typeof value === 'string' ? value : '';
}

/** Resolve the `:id` path parameter through the allow-list registry. */
export async function repoFromRequest(ctx: ServerContext, req: Request): Promise<RepoMeta> {
  return getRepoMeta(ctx, param(req, 'id'));
}

/** Parse a positive integer path parameter. */
export function intParam(value: string | undefined, label: string): number {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed) || parsed < 0 || String(parsed) !== String(value)) {
    throw new ApiError(400, 'VALIDATION_ERROR', `Invalid ${label}`);
  }
  return parsed;
}

/** Parse an optional `limit` query parameter (1..max, default fallback). */
export function limitParam(req: Request, fallback = 100, max = 2000): number {
  const raw = req.query.limit;
  if (raw === undefined || raw === '') return fallback;
  const parsed = typeof raw === 'string' ? Number.parseInt(raw, 10) : Number.NaN;
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid limit');
  }
  return Math.min(parsed, max);
}

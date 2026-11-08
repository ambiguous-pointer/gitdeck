/**
 * Express application factory.
 *
 * Infrastructure (logging, CORS, JSON parsing, error envelope, static web
 * bundle) lives here. Feature routers are mounted from `src/routes/*`.
 */
import cors from 'cors';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import pino from 'pino';
import pinoHttp from 'pino-http';
import type { ApiErrorBody, ApiErrorCode, AppSettings, GitVersionInfo } from '@gitdeck/shared';
import { config } from './config';

export const logger = pino({ level: config.logLevel });

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly details?: unknown;

  constructor(status: number, code: ApiErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new ApiError(400, 'VALIDATION_ERROR', message, details);
export const notFound = (message: string) => new ApiError(404, 'NOT_FOUND', message);
export const gitError = (message: string, details?: unknown) => new ApiError(400, 'GIT_ERROR', message, details);

export interface CreateAppOptions {
  settings?: AppSettings;
  gitVersion?: string;
}

export function createApp(options: CreateAppOptions = {}): express.Express {
  const app = express();
  app.disable('x-powered-by');

  app.use(
    cors({
      origin: config.corsOrigins.length > 0 ? config.corsOrigins : false,
      credentials: false,
    }),
  );
  app.use(express.json({ limit: '4mb' }));
  app.use(
    pinoHttp({
      logger,
      autoLogging: {
        ignore: (req) => req.url === '/api/health',
      },
      customSuccessMessage: (req, res) => `${req.method} ${req.url} -> ${res.statusCode}`,
    }),
  );

  app.get('/api/health', (_req, res) => {
    const appInfo: GitVersionInfo = {
      appVersion: config.appVersion,
      gitVersion: options.gitVersion ?? 'unknown',
      nodeVersion: process.version,
      platform: `${process.platform}-${process.arch}`,
      home: config.monorepoRoot ?? process.cwd(),
      dataDir: config.dataDir,
    };
    res.json({ status: 'ok', app: appInfo, settings: options.settings });
  });

  // Feature routers (implemented by the backend feature branch).
  // app.use('/api', createRepoRouter()); etc.

  app.use('/api', (req, _res, next) => {
    next(notFound(`Unknown API route: ${req.method} ${req.path}`));
  });

  // Serve the built web app when available (production / `pnpm build`).
  if (config.webDist && fs.existsSync(path.join(config.webDist, 'index.html'))) {
    app.use(express.static(config.webDist));
    app.use((req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
      res.sendFile(path.join(config.webDist!, 'index.html'));
    });
  }

  // 404 for everything else.
  app.use((_req, _res, next) => next(notFound('Resource not found')));

  // Central error envelope: { error: { code, message, details } }.
  app.use(
    (error: unknown, req: express.Request, res: express.Response, _next: express.NextFunction): void => {
      const apiError =
        error instanceof ApiError
          ? error
          : new ApiError(500, 'INTERNAL', error instanceof Error ? error.message : 'Unexpected server error');
      const body: ApiErrorBody = {
        error: { code: apiError.code, message: apiError.message, details: apiError.details },
      };
      if (apiError.status >= 500) {
        logger.error({ err: error, url: req.originalUrl }, 'request failed');
      } else {
        logger.debug({ err: error, url: req.originalUrl }, 'request rejected');
      }
      res.status(apiError.status).json(body);
    },
  );

  return app;
}

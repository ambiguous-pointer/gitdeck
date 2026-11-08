/**
 * Node SEA (Single Executable Application) support.
 *
 * When the server runs from a SEA binary, the built web app is embedded in the
 * executable as SEA assets under the `web/` prefix instead of living on disk.
 * This module exposes:
 *  - `isSeaBinary()` / `readSeaAsset()` low level helpers (safe outside SEA),
 *  - `createSeaStaticMiddleware()` — a tiny static file server for the embedded
 *    assets with SPA fallback (`index.html`) and correct MIME types.
 *
 * Outside SEA (normal `node`/`tsx` runs) none of this is active.
 */
import path from 'node:path';
import type { Request, RequestHandler, Response } from 'express';

interface SeaApi {
  isSea: () => boolean;
  getAsset: (key: string) => ArrayBuffer;
}

let cachedSea: SeaApi | null | undefined;

function loadSea(): SeaApi | null {
  try {
    // `node:sea` exists since Node 20.12 / 21.7. Older runtimes simply run the
    // regular server, so a failed require is expected and harmless.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const module = require('node:sea') as Partial<SeaApi>;
    if (typeof module.isSea === 'function' && typeof module.getAsset === 'function') {
      return module as SeaApi;
    }
    return null;
  } catch {
    return null;
  }
}

/** @internal exposed for tests. */
export function resetSeaCache(): void {
  cachedSea = undefined;
}

export function getSeaApi(): SeaApi | null {
  if (cachedSea === undefined) cachedSea = loadSea();
  return cachedSea;
}

export function isSeaBinary(): boolean {
  const sea = getSeaApi();
  if (!sea) return false;
  try {
    return sea.isSea();
  } catch {
    return false;
  }
}

/** Read an embedded asset as raw bytes, or `null` when absent / not running in SEA. */
export function readSeaAsset(key: string): Buffer | null {
  const sea = getSeaApi();
  if (!sea) return null;
  try {
    return Buffer.from(sea.getAsset(key));
  } catch {
    return null;
  }
}

/** Read an embedded asset as UTF-8 text, or `null`. */
export function readSeaAssetText(key: string): string | null {
  const asset = readSeaAsset(key);
  return asset ? asset.toString('utf8') : null;
}

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

const INDEX_KEY = 'web/index.html';

function sendAsset(req: Request, res: Response, key: string, body: Buffer): void {
  const extension = path.extname(key).toLowerCase();
  const isHtml = extension === '.html' || extension === '';
  res.setHeader('Content-Type', MIME_TYPES[extension] ?? 'application/octet-stream');
  res.setHeader('Content-Length', body.byteLength);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  // Vite fingerprints assets, so they can be cached aggressively; HTML must not.
  res.setHeader('Cache-Control', isHtml ? 'no-cache' : 'public, max-age=31536000, immutable');
  res.status(200);
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  res.end(body);
}

/**
 * Static middleware for the `web/` SEA assets.
 *
 * Returns `null` when not running as a SEA binary or when the build did not
 * embed any web assets, so the caller can fall back to `express.static`.
 */
export function createSeaStaticMiddleware(): RequestHandler | null {
  if (!isSeaBinary()) return null;
  if (!readSeaAsset(INDEX_KEY)) return null;

  return (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      next();
      return;
    }
    if (req.path.startsWith('/api')) {
      next();
      return;
    }

    let pathname: string;
    try {
      pathname = decodeURIComponent(req.path);
    } catch {
      next();
      return;
    }
    if (pathname.includes('\0') || pathname.includes('..')) {
      next();
      return;
    }

    if (pathname === '/' || pathname === '') {
      const index = readSeaAsset(INDEX_KEY);
      if (index) {
        sendAsset(req, res, INDEX_KEY, index);
        return;
      }
      next();
      return;
    }

    const candidateKey = `web${pathname.startsWith('/') ? pathname : `/${pathname}`}`;
    const asset = readSeaAsset(candidateKey);
    if (asset) {
      sendAsset(req, res, candidateKey, asset);
      return;
    }

    // Assets with an extension must 404 instead of falling back to the SPA.
    const extension = path.extname(pathname).toLowerCase();
    if (extension && extension !== '.html') {
      next();
      return;
    }

    const index = readSeaAsset(INDEX_KEY);
    if (index) {
      sendAsset(req, res, INDEX_KEY, index);
      return;
    }
    next();
  };
}

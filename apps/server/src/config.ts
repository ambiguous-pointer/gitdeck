/**
 * Server configuration resolved from environment variables with sensible
 * defaults for both development (inside the pnpm monorepo) and production
 * (standalone `node dist/index.js`).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { isSeaBinary, readSeaAssetText } from './sea-assets';

/** True when the server runs from a Node SEA binary (`pnpm build:sea`). */
const seaMode = isSeaBinary();

function findMonorepoRoot(): string | null {
  if (seaMode) return null;
  // `__dirname` is apps/server/src or apps/server/dist — three levels up is the repo root.
  const fromDirname = path.resolve(__dirname, '../../..');
  const candidates = [process.cwd(), fromDirname];
  for (const start of candidates) {
    let current = path.resolve(start);
    for (;;) {
      try {
        if (fs.existsSync(path.join(current, 'pnpm-workspace.yaml'))) return current;
      } catch {
        // ignore unreadable candidates
      }
      const parent = path.dirname(current);
      if (parent === current) break;
      current = parent;
    }
  }
  return null;
}

const monorepoRoot = findMonorepoRoot();

function readAppVersion(): string {
  if (seaMode) {
    // The build script embeds the root package.json as `app/package.json`.
    const embedded = readSeaAssetText('app/package.json');
    if (embedded) {
      try {
        const parsed = JSON.parse(embedded) as { version?: string };
        if (parsed.version) return parsed.version;
      } catch {
        // fall through to the default below
      }
    }
    return '0.1.0';
  }
  const candidates = [
    path.resolve(__dirname, '../../package.json'),
    path.resolve(monorepoRoot ?? process.cwd(), 'package.json'),
  ];
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(fs.readFileSync(candidate, 'utf8')) as { version?: string };
      if (parsed.version) return parsed.version;
    } catch {
      // keep looking
    }
  }
  return '0.1.0';
}

const demoRepoPath = monorepoRoot ? path.join(monorepoRoot, '.demo', 'gitdeck-demo') : null;
const envDataDir = process.env.GITDECK_HOME;

export interface ServerConfig {
  host: string;
  port: number;
  logLevel: string;
  corsOrigins: string[];
  gitPath: string;
  commandTimeoutMs: number;
  dataDir: string;
  monorepoRoot: string | null;
  demoRepoPath: string | null;
  webDist: string | null;
  appVersion: string;
  maxOutputBytes: number;
  /** Running from a single-file Node SEA executable. */
  seaMode: boolean;
  /** Directory containing the executable (SEA builds use it as a hint for logs). */
  executableDir: string;
}

export const config: ServerConfig = {
  host: process.env.HOST ?? '127.0.0.1',
  port: Number.parseInt(process.env.PORT ?? '4319', 10),
  logLevel: process.env.LOG_LEVEL ?? 'info',
  corsOrigins: (process.env.CORS_ORIGIN ?? 'http://127.0.0.1:5188,http://localhost:5188')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  gitPath: process.env.GIT_BIN ?? 'git',
  commandTimeoutMs: Number.parseInt(process.env.COMMAND_TIMEOUT_MS ?? '120000', 10),
  dataDir: envDataDir
    ? path.resolve(envDataDir)
    : monorepoRoot
      ? path.join(monorepoRoot, '.gitdeck')
      : path.join(os.homedir(), '.gitdeck'),
  monorepoRoot,
  demoRepoPath,
  webDist: seaMode
    ? null
    : (process.env.GITDECK_WEB_DIST ?? (monorepoRoot ? path.join(monorepoRoot, 'apps', 'web', 'dist') : null)),
  appVersion: readAppVersion(),
  maxOutputBytes: 2 * 1024 * 1024,
  seaMode,
  executableDir: path.dirname(process.execPath),
};

export function ensureDataDir(): void {
  fs.mkdirSync(config.dataDir, { recursive: true });
}

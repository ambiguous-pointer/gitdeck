/**
 * Per-application server context.
 *
 * `createApp(options)` builds exactly one context: it owns the persisted data
 * (repo registry + settings), runtime configuration derived from settings and
 * the small in-memory caches used by the git layer.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AppSettings, GitVersionInfo } from '@gitdeck/shared';
import { config } from './config';
import { resolveRepoMeta, type RepoMeta } from './git/repo';
import { RepoRegistry } from './store/registry';
import { SettingsStore } from './store/settings';

export interface ServerOptions {
  /** Settings override merged over the persisted settings (used by tests/embedders). */
  settings?: Partial<AppSettings>;
  gitVersion?: string;
  /** Isolated data directory; defaults to `config.dataDir`. */
  dataDir?: string;
  /** Override the git executable; defaults to `config.gitPath`. */
  gitPath?: string;
  commandTimeoutMs?: number;
  maxOutputBytes?: number;
  /** Demo repository opened automatically on first use when the registry is empty. */
  demoRepoPath?: string | null;
  /** Extra environment passed to every git child process (test isolation). */
  gitEnv?: Record<string, string>;
}

export interface ServerContext {
  readonly dataDir: string;
  readonly gitEnv: Record<string, string>;
  readonly maxOutputBytes: number;
  readonly demoRepoPath: string | null;
  readonly registry: RepoRegistry;
  readonly settingsStore: SettingsStore;
  readonly metaCache: Map<string, RepoMeta>;
  readonly gitVersion: string;
  /** Runtime git executable (updated when settings change). */
  gitPath: string;
  /** Runtime command timeout (updated when settings change). */
  commandTimeoutMs: number;
  /** Open the demo repository once, if configured and no repo is known yet. */
  autoOpenDemo(): Promise<void>;
}

function defaultScanRoots(): string[] {
  if (config.monorepoRoot) return [config.monorepoRoot];
  return [os.homedir()];
}

function defaultSettings(options: ServerOptions): AppSettings {
  return {
    scanRoots: defaultScanRoots(),
    gitPath: options.gitPath ?? config.gitPath,
    maxScanDepth: 4,
    commandTimeoutMs: options.commandTimeoutMs ?? config.commandTimeoutMs,
    locale: 'en',
    theme: 'dark',
    accent: '#6366f1',
    confirmDangerous: true,
  };
}

export function createServerContext(options: ServerOptions = {}): ServerContext {
  const dataDir = path.resolve(options.dataDir ?? config.dataDir);
  fs.mkdirSync(dataDir, { recursive: true });

  const settingsStore = new SettingsStore(dataDir, defaultSettings(options), options.settings);
  const registry = new RepoRegistry(dataDir);
  const settings = settingsStore.get();

  const context: ServerContext = {
    dataDir,
    gitEnv: { ...(options.gitEnv ?? {}) },
    maxOutputBytes: options.maxOutputBytes ?? config.maxOutputBytes,
    demoRepoPath: options.demoRepoPath !== undefined ? options.demoRepoPath : config.demoRepoPath,
    registry,
    settingsStore,
    metaCache: new Map<string, RepoMeta>(),
    gitVersion: options.gitVersion ?? 'unknown',
    gitPath: options.gitPath ?? settings.gitPath ?? config.gitPath,
    commandTimeoutMs: options.commandTimeoutMs ?? settings.commandTimeoutMs ?? config.commandTimeoutMs,
    autoOpenDemo: () => Promise.resolve(),
  };

  let demoPromise: Promise<void> | null = null;
  context.autoOpenDemo = () => {
    if (!demoPromise) {
      demoPromise = (async () => {
        const demoPath = context.demoRepoPath;
        if (!demoPath) return;
        if (registry.list().length > 0) return;
        try {
          if (!fs.statSync(demoPath).isDirectory()) return;
          const meta = await resolveRepoMeta(context, demoPath);
          const record = registry.upsert(meta.root, meta.name);
          context.metaCache.set(record.id, { ...meta, id: record.id, record });
        } catch {
          // Demo repo absent/invalid: not an error, the welcome screen will show.
        }
      })();
    }
    return demoPromise;
  };

  // Kick off eagerly but never block `createApp` (it is synchronous by contract).
  void context.autoOpenDemo();

  return context;
}

/** Version/build information reported by `/api/health` and `/api/home`. */
export function appInfo(ctx: ServerContext): GitVersionInfo {
  return {
    appVersion: config.appVersion,
    gitVersion: ctx.gitVersion,
    nodeVersion: process.version,
    platform: `${process.platform}-${process.arch}`,
    home: config.monorepoRoot ?? process.cwd(),
    dataDir: ctx.dataDir,
  };
}

/**
 * Persisted application settings (`<dataDir>/settings.json`).
 *
 * The store is intentionally small: it merges defaults with the persisted file
 * and an optional explicit override (tests / embedders), and writes atomically.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { AppSettings } from '@gitdeck/shared';
import { settingsPatchInputSchema } from '@gitdeck/shared';

function atomicWriteJson(file: string, value: unknown): void {
  const payload = `${JSON.stringify(value, null, 2)}\n`;
  const tmp = `${file}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(tmp, payload, 'utf8');
    fs.renameSync(tmp, file);
  } catch {
    try {
      fs.rmSync(tmp, { force: true });
    } catch {
      // ignore
    }
    fs.writeFileSync(file, payload, 'utf8');
  }
}

/** Pick only known settings keys from a persisted blob. */
function sanitizeStoredSettings(raw: unknown): Partial<AppSettings> {
  if (typeof raw !== 'object' || raw === null) return {};
  const parsed = settingsPatchInputSchema.safeParse(raw);
  if (!parsed.success) return {};
  const result: Partial<AppSettings> = {};
  for (const [key, value] of Object.entries(parsed.data)) {
    if (value !== undefined) Object.assign(result, { [key]: value });
  }
  return result;
}

export class SettingsStore {
  private readonly file: string;
  private current: AppSettings;

  constructor(dataDir: string, defaults: AppSettings, override?: Partial<AppSettings>) {
    this.file = path.join(dataDir, 'settings.json');
    let stored: Partial<AppSettings> = {};
    try {
      stored = sanitizeStoredSettings(JSON.parse(fs.readFileSync(this.file, 'utf8')) as unknown);
    } catch {
      stored = {};
    }
    this.current = { ...defaults, ...stored, ...(override ?? {}) };
    if (!fs.existsSync(this.file)) this.persist();
  }

  get(): AppSettings {
    return { ...this.current, scanRoots: [...this.current.scanRoots] };
  }

  update(patch: Partial<AppSettings>): AppSettings {
    this.current = { ...this.current, ...patch };
    this.persist();
    return this.get();
  }

  private persist(): void {
    atomicWriteJson(this.file, this.current);
  }
}

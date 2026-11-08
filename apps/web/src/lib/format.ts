/**
 * Locale-aware formatting helpers. All of them take the active locale so the
 * UI can switch between Chinese and English without a reload.
 */
import type { Locale } from '@gitdeck/shared';

const LOCALE_TAGS: Record<Locale, string> = {
  zh: 'zh-CN',
  en: 'en-US',
};

export function localeTag(locale: Locale): string {
  return LOCALE_TAGS[locale] ?? 'en-US';
}

/** Absolute date + time, e.g. `2026-11-08 21:03`. */
export function formatDateTime(iso: string | undefined, locale: Locale, withTime = true): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  try {
    return new Intl.DateTimeFormat(localeTag(locale), {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
      hour12: false,
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 16).replace('T', ' ');
  }
}

/** Compact date used by the commit graph rows, e.g. `11-08 21:03`. */
export function formatCommitDate(iso: string | undefined, locale: Locale): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  try {
    return new Intl.DateTimeFormat(localeTag(locale), {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  } catch {
    return date.toISOString().slice(5, 16).replace('T', ' ');
  }
}

const RELATIVE_UNITS: { unit: Intl.RelativeTimeFormatUnit; ms: number }[] = [
  { unit: 'year', ms: 365 * 24 * 60 * 60 * 1000 },
  { unit: 'month', ms: 30 * 24 * 60 * 60 * 1000 },
  { unit: 'day', ms: 24 * 60 * 60 * 1000 },
  { unit: 'hour', ms: 60 * 60 * 1000 },
  { unit: 'minute', ms: 60 * 1000 },
  { unit: 'second', ms: 1000 },
];

/** Relative time, e.g. `3 分钟前` / `3 minutes ago`. */
export function formatRelativeTime(iso: string | undefined, locale: Locale, now = Date.now()): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const diff = date.getTime() - now;
  const formatter = new Intl.RelativeTimeFormat(localeTag(locale), { numeric: 'auto' });
  for (const { unit, ms } of RELATIVE_UNITS) {
    if (Math.abs(diff) >= ms) return formatter.format(Math.round(diff / ms), unit);
  }
  return formatter.format(Math.round(diff / 1000), 'second');
}

export function formatCount(count: number, locale: Locale, singular: string, plural?: string): string {
  return new Intl.NumberFormat(localeTag(locale)).format(count) + ' ' + (count === 1 ? singular : (plural ?? singular));
}

export function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(localeTag(locale)).format(value);
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

export function formatDuration(ms: number | undefined): string {
  if (!ms || ms < 0) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(ms < 10_000 ? 2 : 1)} s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.round((ms % 60_000) / 1000);
  return `${minutes}m ${seconds}s`;
}

export function truncate(value: string, max = 60): string {
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(1, max - 1))}…`;
}

export function shortHash(hash: string | undefined, length = 7): string {
  if (!hash) return '';
  return hash.slice(0, length);
}

export function splitPath(path: string): { dir: string; name: string; ext: string } {
  const normalized = path.replace(/\\/g, '/');
  const index = normalized.lastIndexOf('/');
  const name = index >= 0 ? normalized.slice(index + 1) : normalized;
  const dir = index >= 0 ? normalized.slice(0, index) : '';
  const dot = name.lastIndexOf('.');
  const ext = dot > 0 ? name.slice(dot + 1) : '';
  return { dir, name, ext };
}

export function initials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

/** Deterministic hue derived from a name — used for avatar fallbacks. */
export function nameHue(name: string): number {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) % 360;
  }
  return hash;
}

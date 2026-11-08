/**
 * Color utilities: accent color derivation and graph lane palette tokens.
 */
import type { FileStatus } from '@gitdeck/shared';

export const ACCENT_PRESETS: { name: string; value: string }[] = [
  { name: 'Ocean', value: '#5b8def' },
  { name: 'Violet', value: '#8b5cf6' },
  { name: 'Blossom', value: '#ec4899' },
  { name: 'Amber', value: '#f59e0b' },
  { name: 'Emerald', value: '#10b981' },
  { name: 'Cyan', value: '#06b6d4' },
  { name: 'Crimson', value: '#ef4444' },
  { name: 'Lime', value: '#84cc16' },
];

export const DEFAULT_ACCENT = ACCENT_PRESETS[0]!.value;
export const GRAPH_LANE_COUNT = 10;

/** CSS variable for a graph lane palette index. */
export function graphColorVar(colorIndex: number): string {
  const index = ((colorIndex % GRAPH_LANE_COUNT) + GRAPH_LANE_COUNT) % GRAPH_LANE_COUNT;
  return `var(--graph-${index + 1})`;
}

export function graphColorHex(colorIndex: number): string {
  // Keep in sync with the `--graph-*` tokens in src/styles/theme.css.
  const palette = [
    '#5b8def',
    '#e5a33c',
    '#a78bfa',
    '#4ade80',
    '#f472b6',
    '#38bdf8',
    '#fb923c',
    '#facc15',
    '#2dd4bf',
    '#c084fc',
  ];
  const index = ((colorIndex % GRAPH_LANE_COUNT) + GRAPH_LANE_COUNT) % GRAPH_LANE_COUNT;
  return palette[index]!;
}

interface Rgb {
  r: number;
  g: number;
  b: number;
}

export function hexToRgb(hex: string): Rgb {
  const normalized = hex.replace('#', '').trim();
  const full = normalized.length === 3 ? normalized.split('').map((c) => c + c).join('') : normalized;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return { r: 91, g: 141, b: 239 };
  return {
    r: Number.parseInt(full.slice(0, 2), 16),
    g: Number.parseInt(full.slice(2, 4), 16),
    b: Number.parseInt(full.slice(4, 6), 16),
  };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const clamp = (value: number) => Math.max(0, Math.min(255, Math.round(value)));
  return `#${[r, g, b].map((value) => clamp(value).toString(16).padStart(2, '0')).join('')}`;
}

/** Mix `hex` towards `target` by `amount` (0..1). */
export function mixColor(hex: string, target: string, amount: number): string {
  const from = hexToRgb(hex);
  const to = hexToRgb(target);
  const ratio = Math.max(0, Math.min(1, amount));
  return rgbToHex({
    r: from.r + (to.r - from.r) * ratio,
    g: from.g + (to.g - from.g) * ratio,
    b: from.b + (to.b - from.b) * ratio,
  });
}

export function withAlpha(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
}

export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const channel = (value: number) => {
    const normalized = value / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastText(hex: string): string {
  return relativeLuminance(hex) > 0.45 ? '#0b1220' : '#ffffff';
}

export interface AccentPalette {
  accent: string;
  hover: string;
  soft: string;
  fg: string;
}

/** Derive the full accent palette applied as CSS variables. */
export function buildAccentPalette(hex: string, resolvedMode: 'dark' | 'light'): AccentPalette {
  const normalized = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : DEFAULT_ACCENT;
  const hover = mixColor(normalized, resolvedMode === 'dark' ? '#ffffff' : '#000000', 0.12);
  const soft = withAlpha(normalized, resolvedMode === 'dark' ? 0.18 : 0.14);
  return { accent: normalized, hover, soft, fg: contrastText(normalized) };
}

export interface FileStatusMeta {
  letter: string;
  className: string;
  labelKey: string;
}

const FILE_STATUS_META: Record<FileStatus, FileStatusMeta> = {
  added: { letter: 'A', className: 'text-success', labelKey: 'status.added' },
  modified: { letter: 'M', className: 'text-warning', labelKey: 'status.modified' },
  deleted: { letter: 'D', className: 'text-danger', labelKey: 'status.deleted' },
  renamed: { letter: 'R', className: 'text-info', labelKey: 'status.renamed' },
  copied: { letter: 'C', className: 'text-info', labelKey: 'status.copied' },
  untracked: { letter: 'U', className: 'text-success', labelKey: 'status.untracked' },
  conflicted: { letter: '!', className: 'text-danger', labelKey: 'status.conflicted' },
  typechange: { letter: 'T', className: 'text-warning', labelKey: 'status.typechange' },
  ignored: { letter: 'I', className: 'text-fg-muted', labelKey: 'status.ignored' },
};

export function fileStatusMeta(status: FileStatus): FileStatusMeta {
  return FILE_STATUS_META[status] ?? FILE_STATUS_META.modified;
}

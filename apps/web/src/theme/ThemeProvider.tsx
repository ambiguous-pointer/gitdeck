/**
 * Theme engine: dark / light / system + a fully custom accent color.
 *
 * The resolved theme is stored on `<html data-theme="...">` and all Tailwind
 * semantic colors read CSS variables, so switching is instant and does not
 * require a rebuild. Accent derived variables (hover/soft/fg) are computed in
 * JS and applied as inline custom properties.
 */
import type { ThemeMode } from '@gitdeck/shared';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { DEFAULT_ACCENT, buildAccentPalette } from '@/lib/palette';

export const THEME_STORAGE_KEY = 'gitdeck.theme';

export type ResolvedTheme = 'dark' | 'light';

interface PersistedTheme {
  mode: ThemeMode;
  accent: string;
}

interface ThemeContextValue {
  mode: ThemeMode;
  resolved: ResolvedTheme;
  accent: string;
  setMode: (mode: ThemeMode) => void;
  setAccent: (accent: string) => void;
  resetAccent: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function systemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function readPersisted(): PersistedTheme {
  if (typeof window === 'undefined') return { mode: 'dark', accent: DEFAULT_ACCENT };
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (!raw) return { mode: 'dark', accent: DEFAULT_ACCENT };
    const parsed = JSON.parse(raw) as Partial<PersistedTheme>;
    const mode: ThemeMode = parsed.mode === 'light' || parsed.mode === 'system' ? parsed.mode : 'dark';
    const accent = typeof parsed.accent === 'string' && /^#[0-9a-fA-F]{6}$/.test(parsed.accent) ? parsed.accent : DEFAULT_ACCENT;
    return { mode, accent };
  } catch {
    return { mode: 'dark', accent: DEFAULT_ACCENT };
  }
}

function applyThemeToDom(theme: ResolvedTheme, accent: string): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  const palette = buildAccentPalette(accent, theme);
  root.style.setProperty('--accent', palette.accent);
  root.style.setProperty('--accent-hover', palette.hover);
  root.style.setProperty('--accent-soft', palette.soft);
  root.style.setProperty('--accent-fg', palette.fg);
  const meta = document.querySelector('meta[name="color-scheme"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? 'dark light' : 'light dark');
  root.style.colorScheme = theme;
}

export function ThemeProvider({ children }: { children: ReactNode }): JSX.Element {
  const initial = useMemo(readPersisted, []);
  const [mode, setModeState] = useState<ThemeMode>(initial.mode);
  const [accent, setAccentState] = useState<string>(initial.accent);
  const [resolved, setResolved] = useState<ResolvedTheme>(() => (mode === 'system' ? systemTheme() : mode));

  // Re-resolve when the OS preference changes (system mode only).
  useEffect(() => {
    if (mode !== 'system') {
      setResolved(mode);
      return;
    }
    const media = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = () => setResolved(systemTheme());
    onChange();
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [mode]);

  // Apply + persist.
  useEffect(() => {
    applyThemeToDom(resolved, accent);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify({ mode, accent } satisfies PersistedTheme));
    } catch {
      /* storage may be unavailable in private mode */
    }
  }, [resolved, accent, mode]);

  const setMode = useCallback((next: ThemeMode) => setModeState(next), []);
  const setAccent = useCallback((next: string) => {
    if (/^#[0-9a-fA-F]{6}$/.test(next)) setAccentState(next.toLowerCase());
  }, []);
  const resetAccent = useCallback(() => setAccentState(DEFAULT_ACCENT), []);

  const value = useMemo<ThemeContextValue>(
    () => ({ mode, resolved, accent, setMode, setAccent, resetAccent }),
    [mode, resolved, accent, setMode, setAccent, resetAccent],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside <ThemeProvider>');
  return context;
}

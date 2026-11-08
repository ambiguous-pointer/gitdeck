/**
 * Theme engine: dark / light / system + a fully custom accent color.
 *
 * The resolved theme is stored on `<html data-theme="...">` and all Tailwind
 * semantic colors read CSS variables, so switching is instant and does not
 * require a rebuild. Accent derived variables (hover/soft/fg/selection) are
 * computed in JS and applied as inline custom properties so a custom accent
 * stays readable in both themes.
 *
 * Public API is intentionally small and stable:
 *   const { mode, resolved, accent, setMode, setAccent, resetAccent } = useTheme();
 */
import type { ThemeMode } from '@gitdeck/shared';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { DEFAULT_ACCENT, buildAccentPalette, withAlpha } from '@/lib/palette';

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
    const accent =
      typeof parsed.accent === 'string' && /^#[0-9a-fA-F]{6}$/.test(parsed.accent) ? parsed.accent : DEFAULT_ACCENT;
    return { mode, accent };
  } catch {
    return { mode: 'dark', accent: DEFAULT_ACCENT };
  }
}

function applyThemeToDom(theme: ResolvedTheme, accent: string): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);

  // The default accent is theme-aware (slightly deeper in light mode), so only
  // override the stylesheet tokens when the user actually customized it.
  if (accent.toLowerCase() === DEFAULT_ACCENT) {
    root.style.removeProperty('--accent');
    root.style.removeProperty('--accent-hover');
    root.style.removeProperty('--accent-soft');
    root.style.removeProperty('--accent-fg');
    root.style.removeProperty('--selection-bg');
  } else {
    const palette = buildAccentPalette(accent, theme);
    root.style.setProperty('--accent', palette.accent);
    root.style.setProperty('--accent-hover', palette.hover);
    root.style.setProperty('--accent-soft', palette.soft);
    root.style.setProperty('--accent-fg', palette.fg);
    root.style.setProperty('--selection-bg', withAlpha(palette.accent, theme === 'dark' ? 0.3 : 0.2));
  }

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

  // Keep other browser tabs of GitDeck in sync (same localStorage key).
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY || !event.newValue) return;
      try {
        const parsed = JSON.parse(event.newValue) as Partial<PersistedTheme>;
        if (parsed.mode === 'dark' || parsed.mode === 'light' || parsed.mode === 'system') setModeState(parsed.mode);
        if (typeof parsed.accent === 'string' && /^#[0-9a-fA-F]{6}$/.test(parsed.accent)) {
          setAccentState(parsed.accent.toLowerCase());
        }
      } catch {
        /* ignore corrupted payloads from other tabs */
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next === 'light' || next === 'system' ? next : 'dark');
  }, []);
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

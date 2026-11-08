import type { ThemeMode } from '@gitdeck/shared';
import { Check, Monitor, Moon, RotateCcw, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useI18n } from '@/i18n';
import { ACCENT_PRESETS, DEFAULT_ACCENT, graphColorVar } from '@/lib/palette';
import { cn } from '@/lib/cn';
import { SettingsSection } from './shared';

export interface AppearanceTabProps {
  themeMode: ThemeMode;
  onThemeModeChange: (mode: ThemeMode) => void;
  accent: string;
  onAccentChange: (hex: string) => void;
  onAccentReset: () => void;
}

const THEME_OPTIONS: { value: ThemeMode; labelKey: string; fallback: string; icon: typeof Moon }[] = [
  { value: 'dark', labelKey: 'settings.themeDark', fallback: 'Dark', icon: Moon },
  { value: 'light', labelKey: 'settings.themeLight', fallback: 'Light', icon: Sun },
  { value: 'system', labelKey: 'settings.themeSystem', fallback: 'System', icon: Monitor },
];

/** Appearance: theme selection, accent palette/custom color and a live preview. */
export function AppearanceTab({
  themeMode,
  onThemeModeChange,
  accent,
  onAccentChange,
  onAccentReset,
}: AppearanceTabProps): JSX.Element {
  const { t } = useI18n();
  const [hexDraft, setHexDraft] = useState(accent);
  const accentIsDefault = accent.toLowerCase() === DEFAULT_ACCENT;

  useEffect(() => setHexDraft(accent), [accent]);

  const commitHex = (raw: string) => {
    setHexDraft(raw);
    const normalized = raw.trim().startsWith('#') ? raw.trim() : `#${raw.trim()}`;
    if (/^#[0-9a-fA-F]{6}$/.test(normalized)) onAccentChange(normalized.toLowerCase());
  };

  return (
    <div className="space-y-6">
      <SettingsSection title={t('settings.theme', 'Theme')} description={t('settings.themeDescription', '')}>
        <div className="grid grid-cols-3 gap-2 p-3" role="radiogroup" aria-label={t('settings.theme', 'Theme')}>
          {THEME_OPTIONS.map((option) => {
            const active = option.value === themeMode;
            const Icon = option.icon;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onThemeModeChange(option.value)}
                className={cn(
                  'group relative flex flex-col items-center gap-1.5 rounded-md border px-2 py-3 text-xs font-medium transition-colors duration-100',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                  active
                    ? 'border-accent bg-accent-soft text-accent'
                    : 'border-border bg-canvas text-fg-secondary hover:border-border-strong hover:bg-hover hover:text-fg',
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
                <span>{t(option.labelKey, option.fallback)}</span>
                {active ? (
                  <span className="absolute right-1.5 top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-accent text-accent-fg">
                    <Check className="h-2.5 w-2.5" strokeWidth={3} aria-hidden />
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </SettingsSection>

      <SettingsSection
        title={t('settings.accent', 'Accent color')}
        description={t('settings.accentDescription', '')}
        action={
          !accentIsDefault ? (
            <Button variant="ghost" size="xs" icon={<RotateCcw className="h-3 w-3" />} onClick={onAccentReset}>
              {t('settings.accentReset', 'Reset accent')}
            </Button>
          ) : null
        }
      >
        <div className="space-y-3 p-3">
          <div className="grid grid-cols-4 gap-2">
            {ACCENT_PRESETS.map((preset) => {
              const selected = preset.value.toLowerCase() === accent.toLowerCase();
              return (
                <button
                  key={preset.value}
                  type="button"
                  aria-pressed={selected}
                  title={preset.name}
                  onClick={() => onAccentChange(preset.value)}
                  className={cn(
                    'group flex flex-col items-center gap-1 rounded-md border px-1 py-1.5 transition-colors duration-100',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                    selected
                      ? 'border-accent bg-accent-soft'
                      : 'border-transparent hover:border-border hover:bg-hover',
                  )}
                >
                  <span
                    className="flex h-7 w-7 items-center justify-center rounded-full"
                    style={{ backgroundColor: preset.value }}
                  >
                    {selected ? <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} aria-hidden /> : null}
                  </span>
                  <span className={cn('text-2xs', selected ? 'text-accent' : 'text-fg-muted')}>{preset.name}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 rounded-md border border-border bg-canvas px-2.5 py-2">
            <label
              className="relative flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full"
              title={t('settings.accentCustom', 'Custom color')}
            >
              <span aria-hidden className="accent-custom-swatch absolute inset-0 rounded-full" />
              <span
                aria-hidden
                className="absolute inset-1 rounded-full ring-1 ring-black/10"
                style={{ backgroundColor: /^#[0-9a-fA-F]{6}$/.test(accent) ? accent : DEFAULT_ACCENT }}
              />
              <input
                type="color"
                value={/^#[0-9a-fA-F]{6}$/.test(accent) ? accent : DEFAULT_ACCENT}
                onChange={(event) => onAccentChange(event.target.value)}
                aria-label={t('settings.accentCustom', 'Custom color')}
                className="absolute inset-0 z-10 opacity-0"
              />
            </label>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] leading-4 text-fg">{t('settings.accentCustom', 'Custom color')}</p>
              <p className="mono text-2xs uppercase text-fg-muted">{accent}</p>
            </div>
            <Input
              value={hexDraft}
              onChange={(event) => commitHex(event.target.value)}
              onBlur={() => {
                if (!/^#[0-9a-fA-F]{6}$/.test(hexDraft.trim())) setHexDraft(accent);
              }}
              aria-label={t('settings.accentCustom', 'Custom color')}
              className="h-7 w-24 mono text-xs uppercase"
              spellCheck={false}
            />
            <span
              aria-hidden
              className="flex h-7 w-9 items-center justify-center rounded border border-border text-xs font-semibold"
              style={{ backgroundColor: accent, color: 'var(--accent-fg)' }}
            >
              Aa
            </span>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title={t('settings.themePreview', 'Preview')}>
        <div className="space-y-3 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" size="sm">
              {t('settings.previewButton', 'Primary action')}
            </Button>
            <Button variant="secondary" size="sm">
              {t('common.cancel', 'Cancel')}
            </Button>
            <Badge variant="accent" dot>
              {t('settings.previewBadge', 'Accent badge')}
            </Badge>
            <Badge variant="success" dot>
              {t('status.clean', 'Clean working tree')}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex h-8 min-w-0 flex-1 items-center rounded-md border-2 border-accent bg-canvas px-2.5 text-[13px] text-fg">
              <span className="truncate text-fg-muted">{t('settings.previewInput', 'Focused input')}</span>
              <span aria-hidden className="ml-0.5 h-4 w-px bg-accent" />
            </div>
            <div className="flex h-8 items-center rounded-md border border-border bg-elevated px-2.5 text-xs font-medium text-fg">
              {t('common.save', 'Save')}
            </div>
          </div>

          <div className="flex items-center gap-2 rounded bg-accent-soft px-2.5 py-1.5 text-xs font-medium text-accent">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
            {t('settings.previewSelected', 'Selected row')}
          </div>

          <div className="flex items-center gap-1.5" aria-hidden>
            {Array.from({ length: 10 }, (_, index) => (
              <span
                key={index}
                className="h-1.5 w-6 rounded-full"
                style={{ backgroundColor: graphColorVar(index) }}
              />
            ))}
          </div>
        </div>
      </SettingsSection>
    </div>
  );
}

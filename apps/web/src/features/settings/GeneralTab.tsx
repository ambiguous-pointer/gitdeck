import type { Locale, ThemeMode } from '@gitdeck/shared';
import { Monitor, Moon, RotateCcw, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SegmentedControl } from '@/components/ui/segmented';
import { Switch } from '@/components/ui/switch';
import { useI18n } from '@/i18n';
import { ACCENT_PRESETS, DEFAULT_ACCENT } from '@/lib/palette';
import { cn } from '@/lib/cn';
import { SettingRow, SettingsSection } from './shared';

export interface GeneralTabProps {
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
  themeMode: ThemeMode;
  onThemeModeChange: (mode: ThemeMode) => void;
  accent: string;
  onAccentChange: (hex: string) => void;
  onAccentReset: () => void;
  confirmDangerous: boolean;
  onConfirmDangerousChange: (value: boolean) => void;
  commandTimeoutSec: number;
  onCommandTimeoutChange: (value: number) => void;
  timeoutError?: string;
}

/** General: language, theme/accent quick controls and behavior switches. */
export function GeneralTab({
  locale,
  onLocaleChange,
  themeMode,
  onThemeModeChange,
  accent,
  onAccentChange,
  onAccentReset,
  confirmDangerous,
  onConfirmDangerousChange,
  commandTimeoutSec,
  onCommandTimeoutChange,
  timeoutError,
}: GeneralTabProps): JSX.Element {
  const { t } = useI18n();
  const accentIsDefault = accent.toLowerCase() === DEFAULT_ACCENT;

  return (
    <div className="space-y-6">
      <SettingsSection title={t('settings.preferences', 'Preferences')}>
        <SettingRow
          label={t('settings.language', 'Language')}
          description={t('settings.languageDescription', '')}
        >
          <SegmentedControl<Locale>
            value={locale}
            onChange={onLocaleChange}
            options={[
              { value: 'zh', label: t('settings.localeZh', '简体中文') },
              { value: 'en', label: t('settings.localeEn', 'English') },
            ]}
          />
        </SettingRow>
        <SettingRow label={t('settings.theme', 'Theme')} description={t('settings.themeDescription', '')}>
          <SegmentedControl<ThemeMode>
            value={themeMode}
            onChange={onThemeModeChange}
            options={[
              { value: 'dark', label: t('settings.themeDark', 'Dark'), icon: <Moon className="h-3.5 w-3.5" /> },
              { value: 'light', label: t('settings.themeLight', 'Light'), icon: <Sun className="h-3.5 w-3.5" /> },
              {
                value: 'system',
                label: t('settings.themeSystem', 'System'),
                icon: <Monitor className="h-3.5 w-3.5" />,
              },
            ]}
          />
        </SettingRow>
        <SettingRow
          stacked
          label={t('settings.accent', 'Accent color')}
          description={t('settings.accentDescription', '')}
        >
          <div className="flex w-full flex-wrap items-center gap-2">
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t('settings.accentPresets', 'Presets')}>
              {ACCENT_PRESETS.map((preset) => {
                const selected = preset.value.toLowerCase() === accent.toLowerCase();
                return (
                  <button
                    key={preset.value}
                    type="button"
                    title={preset.name}
                    aria-label={preset.name}
                    aria-pressed={selected}
                    onClick={() => onAccentChange(preset.value)}
                    className={cn(
                      'accent-swatch flex h-6 w-6 items-center justify-center rounded-full transition-transform duration-100',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-surface',
                      'hover:scale-110',
                    )}
                    style={{ backgroundColor: preset.value }}
                  >
                    {selected ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : null}
                  </button>
                );
              })}
            </div>
            <div className="ml-1 flex items-center gap-1.5">
              <label
                className="relative flex h-6 w-8 cursor-pointer items-center justify-center overflow-hidden rounded border border-border-strong bg-canvas"
                title={t('settings.accentCustom', 'Custom color')}
              >
                <span
                  aria-hidden
                  className="absolute inset-0.5 rounded-sm"
                  style={{ backgroundColor: accent }}
                />
                <input
                  type="color"
                  value={/^#[0-9a-fA-F]{6}$/.test(accent) ? accent : DEFAULT_ACCENT}
                  onChange={(event) => onAccentChange(event.target.value)}
                  aria-label={t('settings.accentCustom', 'Custom color')}
                  className="absolute inset-0 z-10 opacity-0"
                />
              </label>
              <span className="mono text-2xs uppercase tracking-wide text-fg-muted">{accent}</span>
              {!accentIsDefault ? (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={onAccentReset}
                  title={t('settings.accentReset', 'Reset accent')}
                  aria-label={t('settings.accentReset', 'Reset accent')}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
              ) : null}
            </div>
          </div>
        </SettingRow>
      </SettingsSection>

      <SettingsSection title={t('settings.behavior', 'Behavior')}>
        <SettingRow
          label={t('settings.confirmDangerous', 'Confirm destructive operations')}
          description={t('settings.confirmDangerousDescription', '')}
        >
          <Switch
            checked={confirmDangerous}
            onChange={onConfirmDangerousChange}
            label={t('settings.confirmDangerous', 'Confirm destructive operations')}
          />
        </SettingRow>
        <SettingRow
          label={t('settings.commandTimeout', 'Command timeout')}
          description={
            timeoutError ?? t('settings.commandTimeoutDescription', 'Maximum time a Git command may run before it is aborted.')
          }
          htmlFor="settings-command-timeout"
        >
          <Input
            id="settings-command-timeout"
            type="number"
            inputMode="numeric"
            min={5}
            max={600}
            step={5}
            value={Number.isFinite(commandTimeoutSec) ? commandTimeoutSec : ''}
            invalid={Boolean(timeoutError)}
            onChange={(event) => onCommandTimeoutChange(Number(event.target.value))}
            className="w-20 text-right tnum"
          />
          <span className="text-xs text-fg-muted">{t('settings.commandTimeoutUnit', 'seconds')}</span>
        </SettingRow>
      </SettingsSection>
    </div>
  );
}

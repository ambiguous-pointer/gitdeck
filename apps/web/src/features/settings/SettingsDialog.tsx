import { Monitor, Moon, Settings, Sun } from 'lucide-react';
import { useServerSettings } from '@/api/hooks';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { SegmentedControl } from '@/components/ui/segmented';
import { useI18n } from '@/i18n';
import { ACCENT_PRESETS } from '@/lib/palette';
import { useAppStore } from '@/stores/app-store';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Application settings dialog. STUB: the design-system feature branch replaces
 * this with the full settings experience (appearance, repositories, git, about).
 */
export function SettingsDialog(): JSX.Element {
  const { t, locale, setLocale } = useI18n();
  const { mode, setMode, accent, setAccent, resetAccent } = useTheme();
  const dialog = useAppStore((state) => state.dialog);
  const closeDialog = useAppStore((state) => state.closeDialog);
  const settings = useServerSettings();

  return (
    <Modal
      open={dialog?.id === 'settings'}
      onClose={closeDialog}
      size="lg"
      title={t('settings.title', 'Settings')}
      description={t('settings.subtitle', 'Appearance, repositories, Git identity and remotes')}
      footer={
        <>
          <Button variant="ghost" onClick={closeDialog}>
            {t('common.close', 'Close')}
          </Button>
          <Button variant="primary" onClick={closeDialog}>
            {t('common.done', 'Done')}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-muted">{t('settings.theme', 'Theme')}</h3>
          <SegmentedControl
            value={mode}
            onChange={(value) => setMode(value)}
            options={[
              { value: 'dark', label: t('settings.themeDark', 'Dark'), icon: <Moon className="h-3.5 w-3.5" /> },
              { value: 'light', label: t('settings.themeLight', 'Light'), icon: <Sun className="h-3.5 w-3.5" /> },
              { value: 'system', label: t('settings.themeSystem', 'System'), icon: <Monitor className="h-3.5 w-3.5" /> },
            ]}
          />
        </section>

        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-muted">{t('settings.accent', 'Accent color')}</h3>
          <div className="flex flex-wrap items-center gap-2">
            {ACCENT_PRESETS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => setAccent(preset.value)}
                className="h-7 w-7 rounded-full border-2 transition-transform hover:scale-110"
                style={{ backgroundColor: preset.value, borderColor: accent === preset.value ? 'var(--fg-primary)' : 'transparent' }}
                aria-label={preset.name}
              />
            ))}
            <input type="color" value={accent} onChange={(event) => setAccent(event.target.value)} className="h-7 w-9" aria-label="Custom accent" />
            <Button variant="ghost" size="xs" onClick={resetAccent}>
              {t('settings.accentReset', 'Reset accent')}
            </Button>
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-muted">{t('settings.language', 'Language')}</h3>
          <SegmentedControl
            value={locale}
            onChange={(value) => setLocale(value)}
            options={[
              { value: 'zh', label: '简体中文' },
              { value: 'en', label: 'English' },
            ]}
          />
        </section>

        <section className="space-y-1.5 rounded border border-border bg-canvas p-3 text-xs text-fg-muted">
          <p className="flex items-center gap-1.5 font-medium text-fg-secondary">
            <Settings className="h-3.5 w-3.5" /> {t('settings.backendVersion', 'Server')}: {settings.data ? 'connected' : '…'}
          </p>
          <p>{t('settings.dataDir', 'Data directory')}: {settings.data?.scanRoots?.join(', ') || '—'}</p>
        </section>
      </div>
    </Modal>
  );
}

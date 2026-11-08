import { Copy, Cpu, GitBranch, HardDrive, Home, Terminal } from 'lucide-react';
import { useHomeQuery, useServerSettings } from '@/api/hooks';
import { useToast } from '@/components/feedback/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Shortcut } from '@/components/ui/kbd';
import { Skeleton } from '@/components/ui/skeleton';
import { useI18n } from '@/i18n';
import { SettingRow, SettingsSection, copyText, ValueChip, CopyButton } from './shared';

const SHORTCUT_ROWS: { labelKey: string; fallback: string; keys: string[] }[] = [
  { labelKey: 'settings.shortcutPalette', fallback: 'Command palette', keys: ['Ctrl', 'K'] },
  { labelKey: 'settings.shortcutSearch', fallback: 'Search commits', keys: ['Ctrl', 'F'] },
  { labelKey: 'settings.shortcutCommit', fallback: 'Commit staged changes', keys: ['Ctrl', 'Enter'] },
  { labelKey: 'settings.shortcutNewBranch', fallback: 'Create branch', keys: ['Ctrl', 'B'] },
  { labelKey: 'settings.shortcutRefresh', fallback: 'Refresh repository', keys: ['Ctrl', 'R'] },
  { labelKey: 'settings.shortcutFetch', fallback: 'Fetch', keys: ['Ctrl', 'Shift', 'F'] },
  { labelKey: 'settings.shortcutTheme', fallback: 'Toggle theme', keys: ['Ctrl', 'Shift', 'L'] },
  { labelKey: 'settings.shortcutClose', fallback: 'Close dialog', keys: ['Esc'] },
];

/** About: build/runtime information, data locations and the shortcut reference. */
export function AboutTab(): JSX.Element {
  const { t } = useI18n();
  const toast = useToast();
  const home = useHomeQuery();
  const serverSettings = useServerSettings();
  const app = home.data?.app;
  const gitPath = serverSettings.data?.gitPath ?? '';

  const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.userAgent);
  const mod = isMac ? '⌘' : 'Ctrl';

  const copyDiagnostics = async () => {
    const diagnostics = {
      app: app?.appVersion ?? 'unknown',
      git: app?.gitVersion ?? 'unknown',
      node: app?.nodeVersion ?? 'unknown',
      platform: app?.platform ?? 'unknown',
      dataDir: app?.dataDir ?? 'unknown',
      home: app?.home ?? 'unknown',
      theme: document.documentElement.getAttribute('data-theme') ?? 'unknown',
      locale: document.documentElement.lang || 'unknown',
    };
    const ok = await copyText(JSON.stringify(diagnostics, null, 2));
    if (ok) toast.success(t('settings.diagnosticsCopied', 'Diagnostics copied to clipboard'));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 rounded-md border border-border bg-surface p-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-fg shadow-panel">
          <GitBranch className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold leading-5 text-fg">{t('app.name', 'GitDeck')}</h3>
            <Badge variant="accent" mono>
              {app ? `v${app.appVersion}` : '—'}
            </Badge>
          </div>
          <p className="mt-1 text-xs leading-5 text-fg-muted">{t('app.tagline', '')}</p>
        </div>
      </div>

      <SettingsSection title={t('settings.buildInfo', 'Build & runtime')}>
        {home.isPending ? (
          <div className="space-y-2 p-3">
            <Skeleton className="h-6" />
            <Skeleton className="h-6" />
            <Skeleton className="h-6" />
          </div>
        ) : (
          <>
            <SettingRow label={t('settings.appVersion', 'App version')}>
              <VersionValue value={app?.appVersion} />
            </SettingRow>
            <SettingRow label={t('settings.gitVersion', 'Git')}>
              <VersionValue value={app?.gitVersion} />
            </SettingRow>
            <SettingRow label={t('settings.nodeVersion', 'Node.js')}>
              <VersionValue value={app?.nodeVersion} />
            </SettingRow>
            <SettingRow label={t('settings.platform', 'Platform')}>
              <VersionValue value={app?.platform} />
            </SettingRow>
          </>
        )}
      </SettingsSection>

      <SettingsSection title={t('settings.paths', 'Locations')}>
        <SettingRow label={t('settings.dataDir', 'Data directory')} stacked>
          <div className="flex w-full items-center gap-1">
            <ValueChip className="flex-1">
              <HardDrive className="h-3 w-3 shrink-0 text-fg-muted" aria-hidden />
              <span className="truncate">{app?.dataDir ?? '—'}</span>
            </ValueChip>
            <CopyButton value={app?.dataDir ?? ''} label={t('common.copyPath', 'Copy path')} />
          </div>
        </SettingRow>
        <SettingRow label={t('settings.homeDir', 'Home directory')} stacked>
          <div className="flex w-full items-center gap-1">
            <ValueChip className="flex-1">
              <Home className="h-3 w-3 shrink-0 text-fg-muted" aria-hidden />
              <span className="truncate">{app?.home ?? '—'}</span>
            </ValueChip>
            <CopyButton value={app?.home ?? ''} label={t('common.copyPath', 'Copy path')} />
          </div>
        </SettingRow>
        <SettingRow label={t('settings.gitPath', 'Git executable')} stacked>
          <div className="flex w-full items-center gap-1">
            <ValueChip className="flex-1">
              <Terminal className="h-3 w-3 shrink-0 text-fg-muted" aria-hidden />
              <span className="truncate">{gitPath || '—'}</span>
            </ValueChip>
            <CopyButton value={gitPath} label={t('common.copyPath', 'Copy path')} />
          </div>
        </SettingRow>
      </SettingsSection>

      <SettingsSection title={t('settings.shortcuts', 'Keyboard shortcuts')}>
        {SHORTCUT_ROWS.map((row) => (
          <div
            key={row.labelKey}
            className="flex items-center justify-between gap-3 border-b border-border-subtle px-3 py-1.5 last:border-b-0"
          >
            <span className="text-[13px] text-fg-secondary">{t(row.labelKey, row.fallback)}</span>
            <Shortcut keys={row.keys.map((key) => (key === 'Ctrl' ? mod : key))} />
          </div>
        ))}
      </SettingsSection>

      <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2 text-xs text-fg-muted">
          <Cpu className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="truncate">
            {t('settings.aboutDescription', '')}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="secondary" size="sm" icon={<Copy className="h-3.5 w-3.5" />} onClick={() => void copyDiagnostics()}>
            {t('settings.copyDiagnostics', 'Copy diagnostics')}
          </Button>
        </div>
      </div>
    </div>
  );
}

function VersionValue({ value }: { value?: string }): JSX.Element {
  return (
    <span className="mono max-w-[260px] truncate rounded border border-border bg-canvas px-2 py-0.5 text-xs text-fg-secondary">
      {value ?? '—'}
    </span>
  );
}

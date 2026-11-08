import type { Locale, ThemeMode } from '@gitdeck/shared';
import {
  CircleAlert,
  CircleCheck,
  FolderGit2,
  GitBranch,
  Info,
  Palette,
  Settings2,
  SlidersHorizontal,
} from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { errorMessage } from '@/api/client';
import { useServerSettings, useUpdateSettings } from '@/api/hooks';
import { useToast } from '@/components/feedback/toast';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { useI18n } from '@/i18n';
import { DEFAULT_ACCENT } from '@/lib/palette';
import { cn } from '@/lib/cn';
import { useAppStore } from '@/stores/app-store';
import { useTheme } from '@/theme/ThemeProvider';
import { AboutTab } from './AboutTab';
import { AppearanceTab } from './AppearanceTab';
import { GeneralTab } from './GeneralTab';
import { GitTab } from './GitTab';
import { RepositoriesTab } from './RepositoriesTab';

type SettingsTabId = 'general' | 'appearance' | 'repositories' | 'git' | 'about';

interface SettingsDraft {
  locale: Locale;
  themeMode: ThemeMode;
  accent: string;
  confirmDangerous: boolean;
  commandTimeoutSec: number;
}

const TABS: { id: SettingsTabId; labelKey: string; fallback: string; icon: typeof SlidersHorizontal }[] = [
  { id: 'general', labelKey: 'settings.general', fallback: 'General', icon: SlidersHorizontal },
  { id: 'appearance', labelKey: 'settings.appearance', fallback: 'Appearance', icon: Palette },
  { id: 'repositories', labelKey: 'settings.repositories', fallback: 'Repositories', icon: FolderGit2 },
  { id: 'git', labelKey: 'settings.git', fallback: 'Git', icon: GitBranch },
  { id: 'about', labelKey: 'settings.about', fallback: 'About', icon: Info },
];

const TIMEOUT_MIN = 5;
const TIMEOUT_MAX = 600;

/**
 * Application settings, in the spirit of the GitKraken repository-settings
 * modal: a dense, keyboard-accessible dialog with a left navigation rail and
 * section cards. Appearance changes preview live; Save persists everything to
 * the server, Cancel restores the previously saved appearance.
 */
export function SettingsDialog(): JSX.Element {
  const { t, locale, setLocale } = useI18n();
  const { mode, accent, setMode, setAccent, resetAccent } = useTheme();
  const toast = useToast();
  const dialog = useAppStore((state) => state.dialog);
  const closeDialog = useAppStore((state) => state.closeDialog);
  const settingsQuery = useServerSettings();
  const updateSettings = useUpdateSettings();

  const open = dialog?.id === 'settings';
  const [tab, setTab] = useState<SettingsTabId>('general');
  const [draft, setDraft] = useState<SettingsDraft>(() => ({
    locale,
    themeMode: mode,
    accent,
    confirmDangerous: true,
    commandTimeoutSec: 30,
  }));
  const savedRef = useRef<SettingsDraft>(draft);
  const hydratedRef = useRef(false);
  const navRef = useRef<HTMLDivElement>(null);

  // Initialize the draft every time the dialog opens.
  useEffect(() => {
    if (!open) {
      hydratedRef.current = false;
      return;
    }
    const initial: SettingsDraft = {
      locale,
      themeMode: mode,
      accent,
      confirmDangerous: settingsQuery.data?.confirmDangerous ?? true,
      commandTimeoutSec: Math.round((settingsQuery.data?.commandTimeoutMs ?? 30_000) / 1000),
    };
    setTab('general');
    setDraft(initial);
    savedRef.current = initial;
    hydratedRef.current = Boolean(settingsQuery.data);
    // Only re-initialize on open; live editing must not be clobbered.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Fill server-backed behavior fields once the settings request resolves.
  useEffect(() => {
    if (!open || hydratedRef.current || !settingsQuery.data) return;
    hydratedRef.current = true;
    const serverBacked = {
      confirmDangerous: settingsQuery.data.confirmDangerous,
      commandTimeoutSec: Math.round(settingsQuery.data.commandTimeoutMs / 1000),
    };
    setDraft((current) => ({ ...current, ...serverBacked }));
    savedRef.current = { ...savedRef.current, ...serverBacked };
  }, [open, settingsQuery.data]);

  const saved = savedRef.current;
  const dirty =
    draft.locale !== saved.locale ||
    draft.themeMode !== saved.themeMode ||
    draft.accent !== saved.accent ||
    draft.confirmDangerous !== saved.confirmDangerous ||
    draft.commandTimeoutSec !== saved.commandTimeoutSec;
  const timeoutValid =
    Number.isFinite(draft.commandTimeoutSec) &&
    draft.commandTimeoutSec >= TIMEOUT_MIN &&
    draft.commandTimeoutSec <= TIMEOUT_MAX;
  const timeoutError = timeoutValid
    ? undefined
    : t('settings.commandTimeoutRange', 'Enter a value between {min} and {max} seconds.', {
        min: TIMEOUT_MIN,
        max: TIMEOUT_MAX,
      });

  const changeLocale = (next: Locale) => {
    setDraft((current) => ({ ...current, locale: next }));
    setLocale(next);
  };

  const changeTheme = (next: ThemeMode) => {
    setDraft((current) => ({ ...current, themeMode: next }));
    setMode(next);
  };

  const changeAccent = (next: string) => {
    if (!/^#[0-9a-fA-F]{6}$/.test(next)) return;
    const normalized = next.toLowerCase();
    setDraft((current) => ({ ...current, accent: normalized }));
    setAccent(normalized);
  };

  const changeAccentReset = () => {
    setDraft((current) => ({ ...current, accent: DEFAULT_ACCENT }));
    resetAccent();
  };

  const restoreSavedAppearance = () => {
    if (mode !== saved.themeMode) setMode(saved.themeMode);
    if (accent.toLowerCase() !== saved.accent) setAccent(saved.accent);
    if (locale !== saved.locale) setLocale(saved.locale);
  };

  const handleClose = () => {
    if (updateSettings.isPending) return;
    restoreSavedAppearance();
    closeDialog();
  };

  const handleSave = () => {
    if (!timeoutValid || updateSettings.isPending) return;
    const patch = {
      locale: draft.locale,
      theme: draft.themeMode,
      accent: draft.accent,
      confirmDangerous: draft.confirmDangerous,
      commandTimeoutMs: Math.round(draft.commandTimeoutSec) * 1000,
    };
    updateSettings.mutate(patch, {
      onSuccess: () => {
        savedRef.current = { ...draft };
        toast.success(t('settings.saved', 'Settings saved'));
        closeDialog();
      },
      onError: (error) => {
        toast.error(t('settings.saveFailed', 'Failed to save settings'), errorMessage(error));
      },
    });
  };

  const onNavKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const index = TABS.findIndex((item) => item.id === tab);
    let nextIndex: number | null = null;
    if (event.key === 'ArrowDown') nextIndex = (index + 1) % TABS.length;
    else if (event.key === 'ArrowUp') nextIndex = (index - 1 + TABS.length) % TABS.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = TABS.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    const next = TABS[nextIndex]!;
    setTab(next.id);
    const node = navRef.current?.querySelector<HTMLElement>(`[data-settings-tab="${next.id}"]`);
    node?.focus();
  };

  const footer = (
    <>
      <span className="mr-auto hidden min-w-0 items-center gap-1.5 text-xs text-fg-muted sm:flex">
        {dirty ? (
          <>
            <CircleAlert className="h-3.5 w-3.5 shrink-0 text-warning" aria-hidden />
            <span className="truncate">{t('settings.unsavedHint', 'You have unsaved changes.')}</span>
          </>
        ) : (
          <>
            <CircleCheck className="h-3.5 w-3.5 shrink-0 text-success" aria-hidden />
            <span className="truncate">{t('settings.savedHint', '')}</span>
          </>
        )}
      </span>
      <Button variant="ghost" size="md" onClick={handleClose} disabled={updateSettings.isPending}>
        {t('common.cancel', 'Cancel')}
      </Button>
      <Button
        variant="primary"
        size="md"
        onClick={handleSave}
        loading={updateSettings.isPending}
        disabled={!dirty || !timeoutValid || updateSettings.isPending}
      >
        {updateSettings.isPending ? t('settings.saving', 'Saving…') : t('settings.save', 'Save settings')}
      </Button>
    </>
  );

  return (
    <Modal
      open={open}
      onClose={handleClose}
      size="xl"
      title={
        <span className="flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-fg-muted" aria-hidden />
          {t('settings.title', 'Settings')}
        </span>
      }
      description={t('settings.subtitle', 'Appearance, repositories, Git identity and remotes')}
      footer={footer}
      closeLabel={t('common.close', 'Close')}
      dismissible={!updateSettings.isPending}
      className="h-[min(780px,calc(100vh-3rem))] max-w-5xl"
      bodyClassName="overflow-hidden p-0"
    >
      <div className="flex h-full min-h-0 flex-col sm:flex-row">
        <div className="shrink-0 border-b border-border bg-canvas p-1.5 sm:flex sm:w-[212px] sm:flex-col sm:border-b-0 sm:border-r">
          <div
            ref={navRef}
            role="tablist"
            aria-orientation="vertical"
            aria-label={t('settings.title', 'Settings')}
            onKeyDown={onNavKeyDown}
            className="no-scrollbar flex gap-1 overflow-x-auto sm:flex-col"
          >
            {TABS.map((item) => {
              const active = item.id === tab;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  data-settings-tab={item.id}
                  aria-selected={active}
                  tabIndex={active ? 0 : -1}
                  onClick={() => setTab(item.id)}
                  className={cn(
                    'flex h-8 shrink-0 select-none items-center gap-2 rounded px-2 text-left text-[13px] font-medium transition-colors duration-100',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                    active
                      ? 'bg-accent-soft text-accent'
                      : 'text-fg-secondary hover:bg-hover hover:text-fg',
                  )}
                >
                  <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-accent' : 'text-fg-muted')} aria-hidden />
                  <span className="truncate">{t(item.labelKey, item.fallback)}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-canvas">
          {settingsQuery.isError ? (
            <div className="flex items-center gap-2 border-b border-border bg-canvas px-4 py-2 text-xs text-danger">
              <CircleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{t('error.network', 'Cannot reach the GitDeck server. Is it running?')}</span>
              <Button variant="ghost" size="xs" onClick={() => void settingsQuery.refetch()}>
                {t('common.retry', 'Retry')}
              </Button>
            </div>
          ) : null}
          <div className="p-4 sm:p-5">
            {tab === 'general' ? (
              <GeneralTab
                locale={draft.locale}
                onLocaleChange={changeLocale}
                themeMode={draft.themeMode}
                onThemeModeChange={changeTheme}
                accent={draft.accent}
                onAccentChange={changeAccent}
                onAccentReset={changeAccentReset}
                confirmDangerous={draft.confirmDangerous}
                onConfirmDangerousChange={(value) => setDraft((current) => ({ ...current, confirmDangerous: value }))}
                commandTimeoutSec={draft.commandTimeoutSec}
                onCommandTimeoutChange={(value) => setDraft((current) => ({ ...current, commandTimeoutSec: value }))}
                timeoutError={timeoutError}
              />
            ) : null}
            {tab === 'appearance' ? (
              <AppearanceTab
                themeMode={draft.themeMode}
                onThemeModeChange={changeTheme}
                accent={draft.accent}
                onAccentChange={changeAccent}
                onAccentReset={changeAccentReset}
              />
            ) : null}
            {tab === 'repositories' ? <RepositoriesTab onClose={handleClose} /> : null}
            {tab === 'git' ? <GitTab onOpenRepositories={() => setTab('repositories')} /> : null}
            {tab === 'about' ? <AboutTab /> : null}
          </div>
        </div>
      </div>
    </Modal>
  );
}

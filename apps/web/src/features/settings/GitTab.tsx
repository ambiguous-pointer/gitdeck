import type { ConfigEntry, GitScope } from '@gitdeck/shared';
import { FolderGit2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { errorMessage } from '@/api/client';
import { useConfig, useConfigSet, useConfigUnset, useServerSettings } from '@/api/hooks';
import { useToast } from '@/components/feedback/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { SegmentedControl } from '@/components/ui/segmented';
import { useI18n } from '@/i18n';
import { useAppStore } from '@/stores/app-store';
import { CopyButton, SettingRow, SettingsSection, ValueChip } from './shared';

type WritableScope = Extract<GitScope, 'local' | 'global'>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PROXY_PATTERN = /^(https?|socks5h?):\/\/\S+$/i;

function toScopeMap(entries: ConfigEntry[] | undefined, scope: WritableScope): Map<string, string> {
  const map = new Map<string, string>();
  for (const entry of entries ?? []) {
    if (entry.scope === scope) map.set(entry.key, entry.value);
  }
  return map;
}

function effectiveValue(entries: ConfigEntry[] | undefined, key: string): { value: string; scope?: GitScope } {
  const all = entries ?? [];
  const local = all.find((entry) => entry.scope === 'local' && entry.key === key);
  if (local) return { value: local.value, scope: 'local' };
  const global = all.find((entry) => entry.scope === 'global' && entry.key === key);
  if (global) return { value: global.value, scope: 'global' };
  return { value: '' };
}

/**
 * Git settings: repository/global user identity and HTTP(S) proxy, written with
 * `git config` through the server so they are real Git configuration values.
 */
export function GitTab({ onOpenRepositories }: { onOpenRepositories: () => void }): JSX.Element {
  const { t } = useI18n();
  const toast = useToast();
  const repoId = useAppStore((state) => state.activeRepoId);
  const settingsQuery = useServerSettings();
  const config = useConfig(repoId, 'all');
  const configSet = useConfigSet(repoId);
  const configUnset = useConfigUnset(repoId);

  const [scope, setScope] = useState<WritableScope>('local');
  const [identity, setIdentity] = useState({ name: '', email: '' });
  const [identityTouched, setIdentityTouched] = useState(false);
  const [identityError, setIdentityError] = useState<string | undefined>();
  const [proxy, setProxy] = useState({ http: '', https: '' });
  const [proxyTouched, setProxyTouched] = useState(false);
  const [proxyError, setProxyError] = useState<string | undefined>();

  const entries = config.data?.entries;
  const scoped = useMemo(() => toScopeMap(entries, scope), [entries, scope]);
  const identityStamp = config.dataUpdatedAt;
  const saving = configSet.isPending || configUnset.isPending;

  // Hydrate the identity fields from Git config (local overrides global).
  useEffect(() => {
    if (!repoId) return;
    setIdentity({ name: effectiveValue(entries, 'user.name').value, email: effectiveValue(entries, 'user.email').value });
    setIdentityTouched(false);
    setIdentityError(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repoId, identityStamp]);

  // Hydrate proxy fields from the selected scope.
  useEffect(() => {
    if (!repoId) return;
    const map = toScopeMap(entries, scope);
    setProxy({ http: map.get('http.proxy') ?? '', https: map.get('https.proxy') ?? '' });
    setProxyTouched(false);
    setProxyError(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repoId, scope, identityStamp]);

  if (!repoId) {
    return (
      <SettingsSection title={t('settings.git', 'Git')}>
        <EmptyState
          icon={<FolderGit2 className="h-5 w-5" />}
          title={t('settings.gitNoRepo', 'No repository selected')}
          description={t('settings.gitNoRepoDescription', 'Open a repository to edit its Git identity and proxy configuration.')}
          action={
            <Button variant="secondary" size="sm" onClick={onOpenRepositories}>
              {t('settings.goToRepositories', 'Go to Repositories')}
            </Button>
          }
        />
      </SettingsSection>
    );
  }

  const validateIdentity = (): string | undefined => {
    const name = identity.name.trim();
    const email = identity.email.trim();
    if (!name || !email) return t('settings.identityIncomplete', 'Enter both a user name and an email.');
    if (!EMAIL_PATTERN.test(email)) return t('settings.identityInvalidEmail', 'Enter a valid email address.');
    return undefined;
  };

  const saveIdentity = async () => {
    const validationError = validateIdentity();
    setIdentityError(validationError);
    if (validationError) return;
    const name = identity.name.trim();
    const email = identity.email.trim();
    const operations: Promise<unknown>[] = [];
    if (name !== (scoped.get('user.name') ?? '')) {
      operations.push(configSet.mutateAsync({ scope, key: 'user.name', value: name }));
    }
    if (email !== (scoped.get('user.email') ?? '')) {
      operations.push(configSet.mutateAsync({ scope, key: 'user.email', value: email }));
    }
    if (operations.length === 0) {
      setIdentityTouched(false);
      return;
    }
    try {
      await Promise.all(operations);
      toast.success(t('settings.identitySaved', 'Git identity saved'));
      setIdentityTouched(false);
    } catch (error) {
      toast.error(t('toast.failed', 'Operation failed'), errorMessage(error));
    }
  };

  const removeIdentity = async () => {
    const operations: Promise<unknown>[] = [];
    if (scoped.has('user.name')) operations.push(configUnset.mutateAsync({ scope, key: 'user.name' }));
    if (scoped.has('user.email')) operations.push(configUnset.mutateAsync({ scope, key: 'user.email' }));
    if (operations.length === 0) return;
    try {
      await Promise.all(operations);
      toast.success(t('settings.identityRemoved', 'Git identity removed'));
    } catch (error) {
      toast.error(t('toast.failed', 'Operation failed'), errorMessage(error));
    }
  };

  const validateProxy = (): string | undefined => {
    for (const value of [proxy.http.trim(), proxy.https.trim()]) {
      if (value && !PROXY_PATTERN.test(value)) {
        return t('settings.proxyInvalid', 'Enter a valid proxy URL, for example http://127.0.0.1:7890.');
      }
    }
    return undefined;
  };

  const saveProxy = async () => {
    const validationError = validateProxy();
    setProxyError(validationError);
    if (validationError) return;
    const next: { key: string; value: string }[] = [
      { key: 'http.proxy', value: proxy.http.trim() },
      { key: 'https.proxy', value: proxy.https.trim() },
    ];
    const operations: Promise<unknown>[] = [];
    for (const { key, value } of next) {
      const current = scoped.get(key) ?? '';
      if (value === current) continue;
      if (value) operations.push(configSet.mutateAsync({ scope, key, value }));
      else if (current) operations.push(configUnset.mutateAsync({ scope, key }));
    }
    if (operations.length === 0) {
      setProxyTouched(false);
      return;
    }
    try {
      await Promise.all(operations);
      toast.success(t('settings.proxySaved', 'Proxy settings saved'));
      setProxyTouched(false);
    } catch (error) {
      toast.error(t('toast.failed', 'Operation failed'), errorMessage(error));
    }
  };

  const unsetProxy = async () => {
    const operations: Promise<unknown>[] = [];
    if (scoped.has('http.proxy')) operations.push(configUnset.mutateAsync({ scope, key: 'http.proxy' }));
    if (scoped.has('https.proxy')) operations.push(configUnset.mutateAsync({ scope, key: 'https.proxy' }));
    if (operations.length === 0) return;
    try {
      await Promise.all(operations);
      toast.success(t('settings.proxySaved', 'Proxy settings saved'));
    } catch (error) {
      toast.error(t('toast.failed', 'Operation failed'), errorMessage(error));
    }
  };

  const effectiveName = effectiveValue(entries, 'user.name');
  const effectiveEmail = effectiveValue(entries, 'user.email');
  const httpProxy = effectiveValue(entries, 'http.proxy');
  const httpsProxy = effectiveValue(entries, 'https.proxy');
  const gitExecutable = settingsQuery.data?.gitPath ?? '';

  return (
    <div className="space-y-6">
      <SettingsSection
        title={t('settings.gitScope', 'Configuration scope')}
        description={t('settings.gitScopeDescription', '')}
      >
        <SettingRow label={t('dialog.config.scope', 'Scope')}>
          <SegmentedControl<WritableScope>
            value={scope}
            onChange={setScope}
            options={[
              { value: 'local', label: t('dialog.config.local', 'Local (this repository)') },
              { value: 'global', label: t('dialog.config.global', 'Global (all repositories)') },
            ]}
          />
        </SettingRow>
      </SettingsSection>

      <SettingsSection
        title={t('settings.gitIdentity', 'User identity')}
        description={t('settings.gitIdentityDescription', '')}
      >
        <SettingRow
          label={t('settings.userName', 'User name')}
          description={
            identityError ? <span className="text-danger">{identityError}</span> : undefined
          }
          htmlFor="settings-git-user-name"
        >
          <Input
            id="settings-git-user-name"
            value={identity.name}
            onChange={(event) => {
              setIdentityTouched(true);
              setIdentityError(undefined);
              setIdentity((current) => ({ ...current, name: event.target.value }));
            }}
            placeholder={t('dialog.user.name', 'User name')}
            invalid={Boolean(identityError) && !identity.name.trim()}
            className="w-64"
            spellCheck={false}
          />
        </SettingRow>
        <SettingRow label={t('settings.userEmail', 'User email')} htmlFor="settings-git-user-email">
          <Input
            id="settings-git-user-email"
            type="email"
            value={identity.email}
            onChange={(event) => {
              setIdentityTouched(true);
              setIdentityError(undefined);
              setIdentity((current) => ({ ...current, email: event.target.value }));
            }}
            placeholder="you@example.com"
            invalid={Boolean(identityError) && Boolean(identity.email.trim()) && !EMAIL_PATTERN.test(identity.email.trim())}
            className="w-64"
            spellCheck={false}
          />
        </SettingRow>
        <div className="flex items-center justify-end gap-2 border-t border-border bg-canvas px-3 py-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void removeIdentity()}
            disabled={saving || (!scoped.has('user.name') && !scoped.has('user.email'))}
            className="mr-auto text-danger hover:text-danger"
          >
            {t('settings.removeIdentity', 'Remove identity')}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => void saveIdentity()}
            loading={saving}
            disabled={!identityTouched || saving}
          >
            {t('settings.saveIdentity', 'Save identity')}
          </Button>
        </div>
      </SettingsSection>

      <SettingsSection title={t('settings.proxy', 'Proxy')} description={t('settings.proxyDescription', '')}>
        <SettingRow
          label={t('dialog.proxy.http', 'HTTP proxy')}
          description={proxyError ? <span className="text-danger">{proxyError}</span> : undefined}
          htmlFor="settings-http-proxy"
        >
          <Input
            id="settings-http-proxy"
            value={proxy.http}
            onChange={(event) => {
              setProxyTouched(true);
              setProxyError(undefined);
              setProxy((current) => ({ ...current, http: event.target.value }));
            }}
            placeholder="http://127.0.0.1:7890"
            invalid={Boolean(proxyError)}
            className="w-64 mono text-xs"
            spellCheck={false}
          />
        </SettingRow>
        <SettingRow label={t('dialog.proxy.https', 'HTTPS proxy')} htmlFor="settings-https-proxy">
          <Input
            id="settings-https-proxy"
            value={proxy.https}
            onChange={(event) => {
              setProxyTouched(true);
              setProxyError(undefined);
              setProxy((current) => ({ ...current, https: event.target.value }));
            }}
            placeholder="http://127.0.0.1:7890"
            className="w-64 mono text-xs"
            spellCheck={false}
          />
        </SettingRow>
        <div className="flex items-center justify-end gap-2 border-t border-border bg-canvas px-3 py-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void unsetProxy()}
            disabled={saving || (!scoped.has('http.proxy') && !scoped.has('https.proxy'))}
            className="mr-auto"
          >
            {t('common.reset', 'Reset')}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => void saveProxy()}
            loading={saving}
            disabled={!proxyTouched || saving}
          >
            {t('common.save', 'Save')}
          </Button>
        </div>
      </SettingsSection>

      <SettingsSection title={t('settings.effectiveConfig', 'Current configuration')}>
        {[
          { key: 'user.name', value: effectiveName },
          { key: 'user.email', value: effectiveEmail },
          { key: 'http.proxy', value: httpProxy },
          { key: 'https.proxy', value: httpsProxy },
        ].map((row) => (
          <div
            key={row.key}
            className="flex items-center gap-3 border-b border-border-subtle px-3 py-2 last:border-b-0"
          >
            <span className="mono w-32 shrink-0 text-xs text-fg-muted">{row.key}</span>
            <span className="min-w-0 flex-1 truncate text-xs text-fg-secondary">
              {row.value.value || <span className="text-fg-muted">{t('common.none', 'None')}</span>}
            </span>
            {row.value.scope ? (
              <Badge variant={row.value.scope === 'local' ? 'accent' : 'default'}>{row.value.scope}</Badge>
            ) : null}
            {row.value.value ? <CopyButton value={row.value.value} /> : null}
          </div>
        ))}
        <SettingRow label={t('settings.gitPath', 'Git executable')} stacked>
          <div className="flex w-full items-center gap-1">
            <ValueChip className="flex-1">{gitExecutable || '—'}</ValueChip>
            <CopyButton value={gitExecutable} />
          </div>
        </SettingRow>
      </SettingsSection>
    </div>
  );
}

import type { ScannedRepo, ScanResult, SettingsPatchInput } from '@gitdeck/shared';
import { FolderGit2, FolderOpen, GitFork, Plus, Radar, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { errorMessage } from '@/api/client';
import { useHomeQuery, useOpenRepo, useScanRepos, useServerSettings, useUpdateSettings } from '@/api/hooks';
import { useToast } from '@/components/feedback/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { SkeletonRows } from '@/components/ui/skeleton';
import { useI18n } from '@/i18n';
import { formatRelativeTime } from '@/lib/format';
import { useAppStore } from '@/stores/app-store';
import { CopyButton, SettingRow, SettingsSection, ValueChip } from './shared';

/**
 * Repositories settings: scan folders, repository discovery (with worktrees),
 * opening a discovered repository and storage locations.
 */
export function RepositoriesTab({ onClose }: { onClose: () => void }): JSX.Element {
  const { t, locale } = useI18n();
  const toast = useToast();
  const settingsQuery = useServerSettings();
  const homeQuery = useHomeQuery();
  const updateSettings = useUpdateSettings();
  const scan = useScanRepos();
  const openRepo = useOpenRepo();
  const setActiveRepo = useAppStore((state) => state.setActiveRepo);

  const [newRoot, setNewRoot] = useState('');
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [openingPath, setOpeningPath] = useState<string | null>(null);

  const roots = settingsQuery.data?.scanRoots ?? [];
  const dataDir = homeQuery.data?.app.dataDir ?? '';
  const gitExecutable = settingsQuery.data?.gitPath ?? '';

  const patchSettings = (patch: SettingsPatchInput, successMessage: string) => {
    updateSettings.mutate(patch, {
      onSuccess: () => toast.success(successMessage),
      onError: (error) => toast.error(t('settings.saveFailed', 'Failed to save settings'), errorMessage(error)),
    });
  };

  const addRoot = () => {
    const value = newRoot.trim();
    if (!value) {
      toast.info(t('settings.scanRootInvalid', 'Enter a folder path first.'));
      return;
    }
    if (roots.some((root) => root.toLowerCase() === value.toLowerCase())) {
      toast.info(t('settings.scanRootDuplicate', 'This folder is already in the scan list.'));
      return;
    }
    setNewRoot('');
    patchSettings({ scanRoots: [...roots, value] }, t('settings.scanRootAdded', 'Scan folder added'));
  };

  const removeRoot = (root: string) => {
    patchSettings(
      { scanRoots: roots.filter((candidate) => candidate !== root) },
      t('settings.scanRootRemoved', 'Scan folder removed'),
    );
  };

  const runScan = () => {
    if (roots.length === 0) {
      toast.info(t('settings.scanNoRoots', 'Add at least one scan folder before scanning.'));
      return;
    }
    scan.mutate(
      { roots, maxDepth: settingsQuery.data?.maxScanDepth },
      {
        onSuccess: (result) => {
          setScanResult(result);
          if (result.found.length === 0) toast.info(t('settings.scanFoundNone', 'No repositories found.'));
        },
        onError: (error) => toast.error(t('settings.scanFailed', 'Scan failed'), errorMessage(error)),
      },
    );
  };

  const openDiscovered = (repo: ScannedRepo) => {
    setOpeningPath(repo.path);
    openRepo.mutate(
      { path: repo.path },
      {
        onSuccess: (result) => {
          setActiveRepo(result.repo.id);
          toast.success(t('toast.repoOpened', 'Repository opened'), result.repo.name);
          onClose();
        },
        onError: (error) => toast.error(t('settings.repoOpenFailed', 'Could not open repository'), errorMessage(error)),
        onSettled: () => setOpeningPath(null),
      },
    );
  };

  return (
    <div className="space-y-6">
      <SettingsSection
        title={t('settings.scanRoots', 'Scan folders')}
        description={t('settings.scanRootsDescription', '')}
        action={
          <Button
            variant="primary"
            size="sm"
            icon={<Radar className="h-3.5 w-3.5" />}
            loading={scan.isPending}
            onClick={runScan}
            disabled={roots.length === 0}
          >
            {scan.isPending ? t('settings.scanning', 'Scanning…') : t('settings.scanNow', 'Scan now')}
          </Button>
        }
      >
        <div className="p-3">
          {roots.length === 0 ? (
            <p className="px-1 py-2 text-xs text-fg-muted">
              {t('settings.scanRootsEmpty', 'No scan folders yet. Add a folder to discover repositories and worktrees.')}
            </p>
          ) : (
            <ul className="mb-2 divide-y divide-border-subtle">
              {roots.map((root) => (
                <li key={root} className="group flex items-center gap-2 py-1.5">
                  <FolderOpen className="h-3.5 w-3.5 shrink-0 text-fg-muted" aria-hidden />
                  <span className="min-w-0 flex-1 truncate mono text-xs text-fg-secondary" title={root}>
                    {root}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t('settings.removeRoot', 'Remove scan folder')}
                    title={t('settings.removeRoot', 'Remove scan folder')}
                    disabled={updateSettings.isPending}
                    onClick={() => removeRoot(root)}
                    className="text-fg-muted opacity-0 transition-opacity hover:text-danger group-hover:opacity-100 focus-visible:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-center gap-2">
            <Input
              value={newRoot}
              onChange={(event) => setNewRoot(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  addRoot();
                }
              }}
              placeholder={t('settings.addRootPlaceholder', 'D:\\projects or /home/me/projects')}
              aria-label={t('settings.addRoot', 'Add folder')}
              className="h-7 mono text-xs"
              spellCheck={false}
            />
            <Button
              variant="secondary"
              size="sm"
              icon={<Plus className="h-3.5 w-3.5" />}
              onClick={addRoot}
              disabled={!newRoot.trim() || updateSettings.isPending}
            >
              {t('settings.addRoot', 'Add folder')}
            </Button>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title={t('settings.scanResults', 'Scan results')}
        description={
          scanResult
            ? t('settings.scanFound', 'Found {count} repositories and worktrees', { count: scanResult.found.length }) +
              ' · ' +
              t('settings.scanDuration', 'Scanned in {ms} ms', { ms: Math.round(scanResult.durationMs) })
            : t('repo.autoScanDescription', 'GitDeck scans these folders for Git repositories and linked worktrees.')
        }
      >
        {scan.isPending ? (
          <SkeletonRows rows={3} className="p-3" />
        ) : scanResult === null ? (
          <EmptyState
            compact
            icon={<Radar className="h-4 w-4" />}
            title={t('settings.scanNotYet', 'No scan results yet')}
            description={t(
              'settings.scanNotYetDescription',
              'Run a scan to discover Git repositories and worktrees in your folders.',
            )}
          />
        ) : scanResult.found.length === 0 ? (
          <EmptyState
            compact
            icon={<FolderGit2 className="h-4 w-4" />}
            title={t('settings.scanFoundNone', 'No repositories found in the configured folders.')}
          />
        ) : (
          <div className="max-h-72 overflow-y-auto">
            {scanResult.skipped.length > 0 ? (
              <div className="border-b border-border-subtle bg-canvas px-3 py-1.5 text-2xs text-fg-muted">
                {t('settings.scanSkipped', '{count} skipped', { count: scanResult.skipped.length })}
              </div>
            ) : null}
            {scanResult.found.map((repo) => {
              const isWorktree = repo.kind === 'worktree';
              return (
                <div
                  key={repo.path}
                  className="flex items-center gap-2.5 border-b border-border-subtle px-3 py-2 last:border-b-0 hover:bg-hover"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-border bg-canvas text-fg-muted">
                    {isWorktree ? <GitFork className="h-3.5 w-3.5" /> : <FolderGit2 className="h-3.5 w-3.5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate text-[13px] font-medium text-fg">{repo.name}</span>
                      <Badge variant={isWorktree ? 'info' : 'default'}>
                        {isWorktree
                          ? t('settings.discoveredWorktree', 'Worktree')
                          : t('settings.discoveredRepo', 'Repository')}
                      </Badge>
                      {repo.branch ? (
                        <Badge variant="accent" mono className="hidden sm:inline-flex">
                          {repo.branch}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="truncate-path mono text-2xs leading-4 text-fg-muted" title={repo.path}>
                      {repo.path}
                    </p>
                  </div>
                  {repo.lastCommitDate ? (
                    <span
                      className="hidden shrink-0 text-2xs text-fg-muted md:block"
                      title={t('settings.lastCommit', 'Last commit {date}', {
                        date: formatRelativeTime(repo.lastCommitDate, locale),
                      })}
                    >
                      {formatRelativeTime(repo.lastCommitDate, locale)}
                    </span>
                  ) : null}
                  <Button
                    variant="secondary"
                    size="xs"
                    loading={openingPath === repo.path}
                    disabled={openingPath !== null && openingPath !== repo.path}
                    onClick={() => openDiscovered(repo)}
                    aria-label={`${t('settings.openDiscovered', 'Open repository')} ${repo.name}`}
                  >
                    {t('common.open', 'Open')}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </SettingsSection>

      <SettingsSection title={t('settings.storage', 'Storage & Git')}>
        <SettingRow label={t('settings.dataDir', 'Data directory')} description={t('settings.dataDirDescription', '')} stacked>
          <div className="flex w-full items-center gap-1">
            <ValueChip className="flex-1">{dataDir || '—'}</ValueChip>
            <CopyButton value={dataDir} />
          </div>
        </SettingRow>
        <SettingRow
          label={t('settings.gitPath', 'Git executable')}
          description={t('settings.gitExecutableDescription', 'Git binary used by the server for all operations.')}
          stacked
        >
          <div className="flex w-full items-center gap-1">
            <ValueChip className="flex-1">{gitExecutable || '—'}</ValueChip>
            <CopyButton value={gitExecutable} />
          </div>
        </SettingRow>
      </SettingsSection>
    </div>
  );
}

/**
 * "Add repository" dialog: open a path directly or run a scan over the
 * configured scan roots and pick a discovered repository / worktree.
 */
import { FolderGit2, FolderSearch, GitBranch, Plus, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import type { OpenRepoInput, ScannedRepo } from '@gitdeck/shared';
import { useOpenRepo, useReposQuery, useScanRepos, useServerSettings } from '@/api/hooks';
import { errorMessage } from '@/api/client';
import { useToast } from '@/components/feedback/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Field, Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { useI18n } from '@/i18n';
import { useAppStore } from '@/stores/app-store';
import { DialogAlert, DialogShell } from './dialog-shell';
import { useCloseDialog } from './use-dialog';

export function AddRepoDialog(): JSX.Element {
  const { t } = useI18n();
  const toast = useToast();
  const closeDialog = useCloseDialog();
  const setActiveRepo = useAppStore((state) => state.setActiveRepo);
  const openRepo = useOpenRepo();
  const scanRepos = useScanRepos();
  const settings = useServerSettings();
  const repos = useReposQuery();

  const [path, setPath] = useState('');
  const [scanned, setScanned] = useState<ScannedRepo[] | null>(null);

  const trimmedPath = path.trim();
  const scanRoots = settings.data?.scanRoots ?? [];
  const recent = repos.data?.repos ?? [];

  const open = (target: string) => {
    openRepo.mutate(
      { path: target } satisfies OpenRepoInput,
      {
        onSuccess: (data) => {
          setActiveRepo(data.repo.id);
          toast.success(t('toast.repoOpened', 'Repository opened'), data.repo.path);
          closeDialog();
        },
        onError: (error) => toast.error(t('toast.failed', 'Operation failed'), errorMessage(error)),
      },
    );
  };

  const scan = () => {
    scanRepos.mutate(
      {
        roots: scanRoots.length > 0 ? scanRoots : undefined,
        maxDepth: settings.data?.maxScanDepth,
      },
      {
        onSuccess: (result) => {
          setScanned(result.found);
          if (result.found.length === 0) {
            toast.info(t('repo.scanEmpty', 'No repositories found in the selected folders.'));
          }
        },
        onError: (error) => toast.error(t('toast.failed', 'Operation failed'), errorMessage(error)),
      },
    );
  };

  return (
    <DialogShell
      title={t('dialog.addRepo.title', 'Add repository')}
      description={t('repo.openSubtitle', 'Point GitDeck at a local Git repository or scan a folder to discover repositories and worktrees.')}
      size="lg"
      submitLabel={t('repo.openButton', 'Open repository')}
      submitDisabled={!trimmedPath || openRepo.isPending}
      busy={openRepo.isPending}
      error={openRepo.error}
      onSubmit={() => open(trimmedPath)}
      onClose={closeDialog}
    >
      <Field label={t('repo.pathLabel', 'Repository path')} required>
        <Input
          value={path}
          onChange={(event) => setPath(event.target.value)}
          placeholder={t('repo.pathPlaceholder', 'D:\\projects\\my-repo or /home/me/my-repo')}
          spellCheck={false}
          autoFocus
        />
      </Field>

      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={scan} loading={scanRepos.isPending} icon={<FolderSearch className="h-3.5 w-3.5" />}>
          {t('dialog.addRepo.scan', 'Scan folders')}
        </Button>
        <span className="min-w-0 flex-1 truncate text-2xs text-fg-muted">
          {scanRoots.length > 0
            ? t('repo.scanRoots', 'Folders to scan') + ': ' + scanRoots.join(' · ')
            : t('dialog.addRepo.noScanRoots', 'No scan folders configured — add them in Settings › Repositories.')}
        </span>
      </div>

      {scanRepos.isPending ? (
        <div className="flex items-center justify-center gap-2 rounded-md border border-border bg-canvas py-6 text-xs text-fg-muted">
          <Spinner size={14} /> {t('repo.scanning', 'Scanning…')}
        </div>
      ) : null}

      {scanned && !scanRepos.isPending ? (
        scanned.length === 0 ? (
          <EmptyState
            compact
            icon={<FolderGit2 className="h-6 w-6" />}
            title={t('repo.scanEmpty', 'No repositories found in the selected folders.')}
          />
        ) : (
          <div className="overflow-hidden rounded-md border border-border">
            <div className="flex items-center gap-2 border-b border-border-subtle bg-surface px-2.5 py-1.5 text-2xs font-medium uppercase tracking-wide text-fg-muted">
              <span>{t('repo.foundRepos', 'Repositories found')}</span>
              <Badge variant="accent">{scanned.length}</Badge>
              <Button variant="ghost" size="icon-sm" className="ml-auto" onClick={scan} aria-label={t('repo.scan', 'Scan for repositories')}>
                <RefreshCw className="h-3 w-3" />
              </Button>
            </div>
            <div className="max-h-56 overflow-y-auto scrollbar-thin">
              {scanned.map((repo) => (
                <div
                  key={repo.path}
                  className="flex items-center gap-2 border-b border-border-subtle px-2.5 py-1.5 last:border-b-0 hover:bg-hover"
                >
                  <FolderGit2 className="h-3.5 w-3.5 shrink-0 text-fg-muted" />
                  <button
                    type="button"
                    onClick={() => setPath(repo.path)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-xs font-medium text-fg">{repo.name}</span>
                      {repo.kind === 'worktree' ? (
                        <Badge variant="outline">{t('repo.worktreeBadge', 'worktree')}</Badge>
                      ) : null}
                      {repo.branch ? (
                        <span className="flex shrink-0 items-center gap-1 text-2xs text-fg-muted">
                          <GitBranch className="h-2.5 w-2.5" />
                          {repo.branch}
                        </span>
                      ) : null}
                    </span>
                    <span className="block truncate text-2xs text-fg-muted">{repo.path}</span>
                  </button>
                  <Button variant="ghost" size="icon-sm" onClick={() => open(repo.path)} aria-label={t('repo.openButton', 'Open repository')}>
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )
      ) : null}

      {recent.length > 0 ? (
        <div className="overflow-hidden rounded-md border border-border">
          <div className="border-b border-border-subtle bg-surface px-2.5 py-1.5 text-2xs font-medium uppercase tracking-wide text-fg-muted">
            {t('repo.recent', 'Recent repositories')}
          </div>
          <div className="max-h-36 overflow-y-auto scrollbar-thin">
            {recent.slice(0, 8).map((repo) => (
              <button
                key={repo.id}
                type="button"
                onClick={() => {
                  setActiveRepo(repo.id);
                  closeDialog();
                }}
                className="flex w-full items-center gap-2 border-b border-border-subtle px-2.5 py-1.5 text-left last:border-b-0 hover:bg-hover"
              >
                <FolderGit2 className="h-3.5 w-3.5 shrink-0 text-fg-muted" />
                <span className="min-w-0 flex-1 truncate text-xs text-fg-secondary">{repo.path}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {scanRoots.length === 0 ? (
        <DialogAlert variant="info">
          {t(
            'dialog.addRepo.scanHint',
            'Tip: configure scan folders in Settings › Repositories to discover repositories and linked worktrees automatically.',
          )}
        </DialogAlert>
      ) : null}
    </DialogShell>
  );
}

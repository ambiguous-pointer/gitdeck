import { FolderOpen, GitBranch, GitCommitHorizontal, History, Search } from 'lucide-react';
import { useState } from 'react';
import { useOpenRepo, useReposQuery, useScanRepos } from '@/api/hooks';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Field, Input } from '@/components/ui/input';
import { useToast } from '@/components/feedback/toast';
import { useI18n } from '@/i18n';
import { errorMessage } from '@/api/client';
import { useAppStore } from '@/stores/app-store';

/** Landing screen shown when no repository is open. */
export function WelcomeScreen(): JSX.Element {
  const { t } = useI18n();
  const toast = useToast();
  const [path, setPath] = useState('');
  const openRepo = useOpenRepo();
  const scanRepos = useScanRepos();
  const repos = useReposQuery();
  const setActiveRepo = useAppStore((state) => state.setActiveRepo);

  const open = (target: string) => {
    openRepo.mutate(
      { path: target },
      {
        onSuccess: (result) => setActiveRepo(result.repo.id),
        onError: (error) => toast.error(t('toast.failed', 'Operation failed'), errorMessage(error)),
      },
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto scrollbar-thin">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-8 py-14">
        <div className="flex flex-col gap-2">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent text-accent-fg shadow-panel">
            <GitBranch className="h-6 w-6" />
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{t('repo.welcomeTitle', 'Your Git workbench')}</h1>
          <p className="max-w-xl text-sm leading-6 text-fg-secondary">
            {t('repo.welcomeSubtitle', 'Visualize history, review diffs, stage changes and run every day Git operations — in the browser.')}
          </p>
        </div>

        <div className="panel p-4">
          <div className="flex items-end gap-2">
            <Field label={t('repo.pathLabel', 'Repository path')} className="flex-1">
              <Input
                value={path}
                onChange={(event) => setPath(event.target.value)}
                placeholder={t('repo.pathPlaceholder', 'D:\\projects\\my-repo')}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && path.trim()) open(path.trim());
                }}
              />
            </Field>
            <Button variant="primary" loading={openRepo.isPending} onClick={() => path.trim() && open(path.trim())}>
              <FolderOpen className="h-4 w-4" />
              {t('repo.openButton', 'Open repository')}
            </Button>
            <Button
              variant="secondary"
              loading={scanRepos.isPending}
              onClick={() =>
                scanRepos.mutate(
                  { roots: [], maxDepth: 3 },
                  {
                    onSuccess: (result) => {
                      toast.success(
                        t('repo.scanResult', 'Found {count} repositories', { count: result.found.length }),
                        result.found.map((repo) => repo.path).join('\n') || t('repo.scanEmpty', 'No repositories found'),
                      );
                    },
                    onError: (error) => toast.error(t('toast.failed', 'Operation failed'), errorMessage(error)),
                  },
                )
              }
            >
              <Search className="h-4 w-4" />
              {t('repo.scan', 'Scan for repositories')}
            </Button>
          </div>
        </div>

        {(repos.data?.repos.length ?? 0) > 0 ? (
          <div className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-fg-muted">
              {t('repo.recent', 'Recent repositories')}
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {(repos.data?.repos ?? []).map((repo) => (
                <button
                  key={repo.id}
                  type="button"
                  onClick={() => setActiveRepo(repo.id)}
                  className="flex items-center gap-2.5 rounded-md border border-border bg-surface px-3 py-2.5 text-left transition-colors hover:border-border-strong hover:bg-hover"
                >
                  <GitCommitHorizontal className="h-4 w-4 text-fg-muted" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium">{repo.name}</span>
                    <span className="block truncate text-2xs text-fg-muted">{repo.path}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: <History className="h-4 w-4" />, title: t('repo.featureGraph', 'Commit graph'), desc: t('repo.featureGraphDesc', '') },
              { icon: <GitCommitHorizontal className="h-4 w-4" />, title: t('repo.featureDiff', 'Diffs & staging'), desc: t('repo.featureDiffDesc', '') },
              { icon: <GitBranch className="h-4 w-4" />, title: t('repo.featureOps', 'Full Git operations'), desc: t('repo.featureOpsDesc', '') },
              { icon: <FolderOpen className="h-4 w-4" />, title: t('repo.featureWorktree', 'Worktree manager'), desc: t('repo.featureWorktreeDesc', '') },
            ].map((feature) => (
              <div key={feature.title} className="rounded-md border border-border bg-surface p-3">
                <div className="mb-1.5 flex items-center gap-2 text-accent">{feature.icon}</div>
                <p className="text-[13px] font-medium">{feature.title}</p>
                <p className="mt-0.5 text-xs leading-5 text-fg-muted">{feature.desc}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import { FilePlus2, FileX2, GitCommitHorizontal, Plus, Minus, Undo2 } from 'lucide-react';
import { useState } from 'react';
import { useCommit, useDiscard, useRepoStatus, useStage, useUnstage } from '@/api/hooks';
import { errorMessage } from '@/api/client';
import { useToast } from '@/components/feedback/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Textarea } from '@/components/ui/input';
import { useI18n } from '@/i18n';
import { fileStatusMeta } from '@/lib/palette';
import { useAppStore } from '@/stores/app-store';
import type { FileChange } from '@gitdeck/shared';

/** Working tree panel: staged/unstaged/untracked groups + commit composer. */
export function WorkingTreePanel(): JSX.Element {
  const { t } = useI18n();
  const toast = useToast();
  const activeRepoId = useAppStore((state) => state.activeRepoId);
  const openDiff = useAppStore((state) => state.openDiff);
  const status = useRepoStatus(activeRepoId);
  const stage = useStage(activeRepoId);
  const unstage = useUnstage(activeRepoId);
  const discard = useDiscard(activeRepoId);
  const commit = useCommit(activeRepoId);
  const [message, setMessage] = useState('');

  const data = status.data;
  const groups: { key: string; title: string; files: FileChange[]; staged: boolean }[] = [
    { key: 'conflicts', title: t('changes.conflicts', 'Merge conflicts'), files: data?.conflicted ?? [], staged: false },
    { key: 'staged', title: t('changes.staged', 'Staged changes'), files: data?.staged ?? [], staged: true },
    { key: 'unstaged', title: t('changes.unstaged', 'Changes'), files: data?.unstaged ?? [], staged: false },
    { key: 'untracked', title: t('changes.untracked', 'Untracked files'), files: data?.untracked ?? [], staged: false },
  ];

  const total = groups.reduce((sum, group) => sum + group.files.length, 0);

  const submit = () => {
    if (!message.trim()) return;
    commit.mutate(
      { message },
      {
        onSuccess: () => {
          setMessage('');
          toast.success(t('toast.committed', 'Commit created'));
        },
        onError: (error) => toast.error(t('toast.failed', 'Operation failed'), errorMessage(error)),
      },
    );
  };

  return (
    <div className="flex h-full min-h-0">
      <div className="min-w-0 flex-1 overflow-y-auto scrollbar-thin p-2">
        {total === 0 ? (
          <EmptyState icon={<FilePlus2 className="h-7 w-7" />} title={t('changes.noChanges', 'Working tree clean')} description={t('changes.noChangesHint', '')} compact />
        ) : (
          <div className="space-y-2">
            {groups.map((group) =>
              group.files.length === 0 ? null : (
                <div key={group.key}>
                  <div className="mb-1 flex items-center gap-1.5 px-1 text-2xs font-semibold uppercase tracking-wide text-fg-muted">
                    <span>{group.title}</span>
                    <Badge variant={group.key === 'conflicts' ? 'danger' : 'default'}>{group.files.length}</Badge>
                    <span className="ml-auto flex items-center gap-1">
                      {group.staged ? (
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() =>
                            unstage.mutate(
                              { paths: group.files.map((file) => file.path), all: false },
                              { onSuccess: () => toast.success(t('toast.unstaged', 'Changes unstaged')) },
                            )
                          }
                        >
                          <Minus className="h-3 w-3" /> {t('changes.unstageAll', 'Unstage all')}
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() =>
                            stage.mutate(
                              { paths: group.files.map((file) => file.path), all: false },
                              { onSuccess: () => toast.success(t('toast.staged', 'Changes staged')) },
                            )
                          }
                        >
                          <Plus className="h-3 w-3" /> {t('changes.stageAll', 'Stage all')}
                        </Button>
                      )}
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    {group.files.map((file) => {
                      const meta = fileStatusMeta(file.status);
                      return (
                        <div
                          key={`${group.key}-${file.path}`}
                          className="group flex h-7 items-center gap-2 rounded px-1.5 hover:bg-hover"
                        >
                          <button
                            type="button"
                            className="min-w-0 flex-1 truncate text-left text-xs text-fg-secondary"
                            onClick={() =>
                              openDiff({ scope: group.staged ? 'staged' : 'worktree', path: file.path, title: file.path })
                            }
                          >
                            {file.path}
                          </button>
                          <span className={`shrink-0 font-mono text-2xs ${meta.className}`}>{meta.letter}</span>
                          <span className="hidden shrink-0 items-center gap-1 group-hover:flex">
                            {group.staged ? (
                              <Button variant="ghost" size="xs" onClick={() => unstage.mutate({ paths: [file.path] })}>
                                <Minus className="h-3 w-3" />
                              </Button>
                            ) : (
                              <>
                                <Button variant="ghost" size="xs" onClick={() => stage.mutate({ paths: [file.path] })}>
                                  <Plus className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="xs"
                                  onClick={() => discard.mutate({ paths: [file.path], untracked: group.key === 'untracked' })}
                                >
                                  <Undo2 className="h-3 w-3" />
                                </Button>
                              </>
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ),
            )}
          </div>
        )}
      </div>

      <div className="flex w-[380px] shrink-0 flex-col gap-2 border-l border-border p-2">
        <div className="flex items-center gap-2 text-2xs text-fg-muted">
          <GitCommitHorizontal className="h-3.5 w-3.5" /> {t('changes.commitHint', 'Stage changes first, then describe what you changed.')}
        </div>
        <Textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder={t('changes.commitPlaceholder', 'Commit message (Ctrl+Enter to commit)')}
          className="min-h-0 flex-1 resize-none font-sans"
          onKeyDown={(event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') submit();
          }}
        />
        <div className="flex items-center gap-2">
          <Button variant="primary" className="flex-1" disabled={!message.trim()} loading={commit.isPending} onClick={submit}>
            <GitCommitHorizontal className="h-4 w-4" /> {t('changes.commitButton', 'Commit')}
          </Button>
        </div>
      </div>
    </div>
  );
}

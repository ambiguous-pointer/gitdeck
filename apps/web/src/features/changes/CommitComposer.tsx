/**
 * Commit composer in the working-tree panel: message, amend / sign off /
 * stage-all options, commit and commit-and-push (Ctrl/Cmd+Enter to commit).
 */
import { useEffect, useState } from 'react';
import { GitCommitHorizontal } from 'lucide-react';
import type { RepoStatus } from '@gitdeck/shared';
import { errorMessage } from '@/api/client';
import { useCommit, usePush, useRemotes, useRepoSummary } from '@/api/hooks';
import { useToast } from '@/components/feedback/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/input';
import { Kbd } from '@/components/ui/kbd';
import { useI18n } from '@/i18n';
import { notifyOperation } from '@/features/dialogs/helpers';
import { useAppStore } from '@/stores/app-store';

export interface CommitComposerProps {
  /** Live status from `useRepoStatus` (owned by the parent panel). */
  status: RepoStatus | undefined;
}

export function CommitComposer({ status }: CommitComposerProps): JSX.Element {
  const { t } = useI18n();
  const toast = useToast();
  const repoId = useAppStore((state) => state.activeRepoId);
  const summary = useRepoSummary(repoId);
  const remotes = useRemotes(repoId);
  const commit = useCommit(repoId);
  const push = usePush(repoId);

  const [message, setMessage] = useState('');
  const [amend, setAmend] = useState(false);
  const [signoff, setSignoff] = useState(false);
  const [stageAllOnCommit, setStageAllOnCommit] = useState(false);

  const stagedCount = status?.staged.length ?? 0;
  const conflictCount = status?.conflicted.length ?? 0;
  const totalChanges = status
    ? status.counts.staged + status.counts.unstaged + status.counts.untracked + status.counts.conflicted
    : 0;
  const lastSubject = summary.data?.lastCommit?.subject;

  // Start from an empty composer whenever the repository changes.
  useEffect(() => {
    setMessage('');
    setAmend(false);
    setStageAllOnCommit(false);
  }, [repoId]);

  // Amending pre-fills the previous commit subject when the message is empty.
  useEffect(() => {
    if (!amend) return;
    setMessage((current) => (current.trim().length > 0 ? current : lastSubject ?? ''));
  }, [amend, lastSubject]);

  const trimmed = message.trim();
  const pending = commit.isPending || push.isPending;
  const disabled = pending || !trimmed || conflictCount > 0 || (stagedCount === 0 && !stageAllOnCommit && !amend);
  const nothingToCommit = totalChanges === 0 && !amend;

  const hint = conflictCount > 0
    ? t('changes.conflictHint', 'Resolve the conflicts below before committing.')
    : nothingToCommit
      ? t('changes.nothingToCommit', 'There is nothing to commit in the working tree.')
      : stagedCount === 0 && !stageAllOnCommit && !amend
        ? t('changes.nothingStaged', 'Stage some changes first, or enable "Stage all changes".')
        : null;

  const submit = async (pushAfter: boolean) => {
    const text = message.trim();
    if (!text || !repoId || pending) return;
    try {
      const data = await commit.mutateAsync({ message: text, amend, signoff, stageAll: stageAllOnCommit });
      if (!notifyOperation(toast, t, data, t('toast.committed', 'Commit created'))) return;
      setMessage('');
      setAmend(false);
      if (pushAfter) {
        const summaryData = summary.data;
        const remote = remotes.data?.remotes[0]?.name ?? summaryData?.remotes[0]?.name;
        const pushed = await push.mutateAsync({
          remote,
          branch: summaryData?.branch,
          setUpstream: !summaryData?.upstream || undefined,
          force: 'none',
        });
        notifyOperation(toast, t, pushed, t('toast.pushed', 'Push completed'));
      }
    } catch (error) {
      toast.error(t('toast.failed', 'Operation failed'), errorMessage(error));
    }
  };

  return (
    <div className="flex w-[340px] shrink-0 flex-col border-l border-border bg-surface">
      <div className="flex h-7 shrink-0 items-center gap-1.5 border-b border-border px-2 text-2xs font-medium text-fg-muted">
        <GitCommitHorizontal className="h-3.5 w-3.5" />
        <span>{t('changes.commitButton', 'Commit')}</span>
        {stagedCount > 0 ? <Badge variant="accent">{stagedCount}</Badge> : null}
        <span className="ml-auto hidden items-center gap-0.5 text-2xs text-fg-muted sm:flex">
          <Kbd>Ctrl</Kbd>
          <span>+</span>
          <Kbd>Enter</Kbd>
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-1.5 p-2">
        <Textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={(event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
              event.preventDefault();
              void submit(false);
            }
          }}
          placeholder={t('changes.commitPlaceholder', 'Commit message (Ctrl+Enter to commit)')}
          className="min-h-[54px] flex-1 resize-none"
          disabled={pending}
          spellCheck={false}
        />

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Checkbox
            checked={amend}
            onChange={setAmend}
            disabled={pending}
            label={t('changes.commitAmend', 'Amend last commit')}
          />
          <Checkbox
            checked={signoff}
            onChange={setSignoff}
            disabled={pending}
            label={t('changes.commitSignoff', 'Sign off')}
          />
          <Checkbox
            checked={stageAllOnCommit}
            onChange={setStageAllOnCommit}
            disabled={pending}
            label={t('changes.stageAllOnCommit', 'Stage all changes')}
          />
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="primary"
            className="min-w-0 flex-1"
            disabled={disabled}
            loading={commit.isPending}
            onClick={() => void submit(false)}
          >
            {t('changes.commitButton', 'Commit')}
          </Button>
          <Button
            variant="secondary"
            disabled={disabled}
            loading={push.isPending}
            onClick={() => void submit(true)}
            title={t('changes.commitAndPushHint', 'Commit the staged changes, then push the current branch.')}
          >
            {t('changes.commitAndPush', 'Commit & push')}
          </Button>
        </div>

        {hint ? <p className="text-2xs leading-4 text-fg-muted">{hint}</p> : null}
      </div>
    </div>
  );
}

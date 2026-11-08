/**
 * History rewriting dialogs: cherry-pick, revert and reset.
 */
import { useState } from 'react';
import type { CherryPickInput, RevertInput, ResetInput } from '@gitdeck/shared';
import { useCherryPick, useRepoLog, useReset, useRevert } from '@/api/hooks';
import { Checkbox } from '@/components/ui/checkbox';
import { SegmentedControl } from '@/components/ui/segmented';
import { useI18n } from '@/i18n';
import { DialogAlert, DialogPreview, DialogShell } from './dialog-shell';
import { CommitPicker, RefField } from './fields';
import { failedOutput, gitCommand, shellQuote } from './helpers';
import { useCloseDialog, useDialogProps, useDialogRepoId } from './use-dialog';
import { useDialogOperation } from './use-dialog-operation';

type CommitListProps = { commits?: string[] };

/* ------------------------------------------------------------------ */
/* Cherry pick                                                         */
/* ------------------------------------------------------------------ */

export function CherryPickDialog(): JSX.Element {
  const { t } = useI18n();
  const repoId = useDialogRepoId();
  const closeDialog = useCloseDialog();
  const props = useDialogProps<CommitListProps>();
  const cherryPick = useCherryPick(repoId);

  const [commits, setCommits] = useState<string[]>(props.commits ?? []);

  const preview = gitCommand('cherry-pick', ...(commits.length > 0 ? commits.map(shellQuote) : ['<commit>']));
  const operation = useDialogOperation<CherryPickInput>(
    cherryPick,
    t('toast.cherryPicked', 'Cherry pick completed'),
  );

  return (
    <DialogShell
      title={t('dialog.cherryPick.title', 'Cherry pick')}
      description={t('dialog.cherryPick.description', 'Apply the selected commits onto the current branch.')}
      submitLabel={t('dialog.cherryPick.confirm', 'Cherry pick')}
      submitDisabled={commits.length === 0}
      busy={operation.pending}
      error={operation.error}
      failure={failedOutput(operation.result)}
      onSubmit={() => operation.run({ commits })}
      onClose={closeDialog}
    >
      <CommitPicker
        repoId={repoId}
        value={commits}
        onChange={setCommits}
        label={t('dialog.cherryPick.commits', 'Commits')}
        hint={t(
          'dialog.cherryPick.commitsHint',
          'Pick commits from the list or paste hashes; they are applied in the order shown.',
        )}
      />
      <DialogPreview command={preview} />
    </DialogShell>
  );
}

/* ------------------------------------------------------------------ */
/* Revert                                                              */
/* ------------------------------------------------------------------ */

export function RevertDialog(): JSX.Element {
  const { t } = useI18n();
  const repoId = useDialogRepoId();
  const closeDialog = useCloseDialog();
  const props = useDialogProps<CommitListProps>();
  const revert = useRevert(repoId);

  const [commits, setCommits] = useState<string[]>(props.commits ?? []);
  const [noCommit, setNoCommit] = useState(false);

  const preview = gitCommand(
    'revert',
    noCommit && '--no-commit',
    ...(commits.length > 0 ? commits.map(shellQuote) : ['<commit>']),
  );
  const operation = useDialogOperation<RevertInput>(revert, t('toast.reverted', 'Revert completed'));

  return (
    <DialogShell
      title={t('dialog.revert.title', 'Revert commit')}
      description={t('dialog.revert.description', 'Create new commits that undo the selected changes.')}
      submitLabel={t('dialog.revert.confirm', 'Revert')}
      submitDisabled={commits.length === 0}
      busy={operation.pending}
      error={operation.error}
      failure={failedOutput(operation.result)}
      onSubmit={() => operation.run({ commits, noCommit })}
      onClose={closeDialog}
    >
      <CommitPicker
        repoId={repoId}
        value={commits}
        onChange={setCommits}
        label={t('dialog.revert.commits', 'Commits to revert')}
      />
      <Checkbox
        checked={noCommit}
        onChange={setNoCommit}
        label={t('dialog.revert.noCommit', 'Do not create commits (--no-commit)')}
      />
      <DialogPreview command={preview} />
    </DialogShell>
  );
}

/* ------------------------------------------------------------------ */
/* Reset                                                               */
/* ------------------------------------------------------------------ */

type ResetMode = ResetInput['mode'];
type ResetDialogProps = { target?: string };

const RESET_MODES: { value: ResetMode; labelKey: string; fallback: string }[] = [
  { value: 'soft', labelKey: 'dialog.reset.modeSoft', fallback: 'Soft' },
  { value: 'mixed', labelKey: 'dialog.reset.modeMixed', fallback: 'Mixed' },
  { value: 'hard', labelKey: 'dialog.reset.modeHard', fallback: 'Hard' },
];

export function ResetDialog(): JSX.Element {
  const { t } = useI18n();
  const repoId = useDialogRepoId();
  const closeDialog = useCloseDialog();
  const props = useDialogProps<ResetDialogProps>();
  const reset = useReset(repoId);
  const log = useRepoLog(repoId, { limit: 20 }, Boolean(repoId));

  const [target, setTarget] = useState(props.target ?? 'HEAD');
  const [mode, setMode] = useState<ResetMode>('mixed');

  const trimmedTarget = target.trim();
  const hard = mode === 'hard';
  const options = (log.data?.commits ?? []).map((commit) => commit.shortHash);

  const preview = gitCommand('reset', `--${mode}`, shellQuote(trimmedTarget || '<target>'));
  const operation = useDialogOperation<ResetInput>(reset, t('toast.reset', 'Branch reset'));

  return (
    <DialogShell
      title={t('dialog.reset.title', 'Reset branch')}
      description={t('dialog.reset.description', 'Move the current branch to {target}.', {
        target: trimmedTarget || '…',
      })}
      submitLabel={t('dialog.reset.confirm', 'Reset')}
      danger={hard}
      submitDisabled={!trimmedTarget}
      busy={operation.pending}
      error={operation.error}
      failure={failedOutput(operation.result)}
      onSubmit={() => operation.run({ target: trimmedTarget, mode })}
      onClose={closeDialog}
    >
      <RefField
        label={t('dialog.reset.target', 'Reset to')}
        value={target}
        onChange={setTarget}
        options={options}
        placeholder="HEAD~1"
        hint={t('dialog.reset.targetHint', 'A commit hash, a ref like HEAD~2, or a branch name.')}
        required
        autoFocus
      />
      <div>
        <span className="mb-1 block text-xs font-medium text-fg-secondary">{t('dialog.reset.mode', 'Reset mode')}</span>
        <SegmentedControl<ResetMode>
          value={mode}
          onChange={setMode}
          className="w-full"
          options={RESET_MODES.map((item) => ({
            value: item.value,
            label: t(item.labelKey, item.fallback),
          }))}
        />
      </div>
      <DialogAlert variant={hard ? 'danger' : 'warning'}>
        {t('dialog.reset.warning', 'Hard reset permanently discards uncommitted changes. Continue with care.')}
      </DialogAlert>
      <DialogPreview command={preview} danger={hard} />
    </DialogShell>
  );
}

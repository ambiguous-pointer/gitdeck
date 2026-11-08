/**
 * Stash dialogs: create a stash and inspect an existing one.
 */
import { useState } from 'react';
import type { StashIndexInput, StashPushInput } from '@gitdeck/shared';
import { useApplyStash, useCreateStash, useDropStash, usePopStash, useStashShow, useStashes } from '@/api/hooks';
import { errorMessage } from '@/api/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { useI18n } from '@/i18n';
import { DiffFilesView } from '@/features/diff/diff-view';
import { formatRelativeTime } from '@/lib/format';
import { DialogAlert, DialogPreview, DialogShell } from './dialog-shell';
import { failedOutput, gitCommand, shellQuote } from './helpers';
import { useCloseDialog, useDialogProps, useDialogRepoId } from './use-dialog';
import { useDialogOperation } from './use-dialog-operation';

/* ------------------------------------------------------------------ */
/* Create                                                              */
/* ------------------------------------------------------------------ */

export function StashCreateDialog(): JSX.Element {
  const { t } = useI18n();
  const repoId = useDialogRepoId();
  const closeDialog = useCloseDialog();
  const createStash = useCreateStash(repoId);

  const [message, setMessage] = useState('');
  const [includeUntracked, setIncludeUntracked] = useState(true);
  const [keepIndex, setKeepIndex] = useState(false);

  const trimmedMessage = message.trim();
  const preview = gitCommand(
    'stash',
    'push',
    trimmedMessage && `-m ${shellQuote(trimmedMessage)}`,
    includeUntracked && '--include-untracked',
    keepIndex && '--keep-index',
  );

  const operation = useDialogOperation<StashPushInput>(createStash, t('toast.stashed', 'Changes stashed'));

  return (
    <DialogShell
      title={t('dialog.stash.title', 'Stash changes')}
      description={t('dialog.stash.description', 'Save the current working tree changes on the stash stack.')}
      submitLabel={t('dialog.stash.confirm', 'Stash')}
      busy={operation.pending}
      error={operation.error}
      failure={failedOutput(operation.result)}
      onSubmit={() =>
        operation.run({
          message: trimmedMessage || undefined,
          includeUntracked: includeUntracked || undefined,
          keepIndex: keepIndex || undefined,
        })
      }
      onClose={closeDialog}
    >
      <Field label={t('dialog.stash.message', 'Stash message')}>
        <Input
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder={t('dialog.stash.messagePlaceholder', 'Work in progress')}
          autoFocus
        />
      </Field>
      <div className="space-y-1.5">
        <Checkbox
          checked={includeUntracked}
          onChange={setIncludeUntracked}
          label={t('dialog.stash.includeUntracked', 'Include untracked files')}
        />
        <Checkbox
          checked={keepIndex}
          onChange={setKeepIndex}
          label={t('dialog.stash.keepIndex', 'Keep staged changes in the index')}
        />
      </div>
      <DialogPreview command={preview} />
    </DialogShell>
  );
}

/* ------------------------------------------------------------------ */
/* View                                                                */
/* ------------------------------------------------------------------ */

type StashViewDialogProps = { index?: number };

export function StashViewDialog(): JSX.Element {
  const { t, locale } = useI18n();
  const repoId = useDialogRepoId();
  const closeDialog = useCloseDialog();
  const props = useDialogProps<StashViewDialogProps>();
  const index = typeof props.index === 'number' ? props.index : 0;

  const stashes = useStashes(repoId);
  const stashShow = useStashShow(repoId, index);
  const applyStash = useApplyStash(repoId);
  const popStash = usePopStash(repoId);
  const dropStash = useDropStash(repoId);

  const [confirmDrop, setConfirmDrop] = useState(false);

  const stash = stashes.data?.stashes.find((item) => item.index === index);
  const applyOp = useDialogOperation<StashIndexInput>(applyStash, t('toast.stashApplied', 'Stash applied'));
  const popOp = useDialogOperation<StashIndexInput>(popStash, t('toast.stashPopped', 'Stash popped'));
  const dropOp = useDialogOperation<StashIndexInput>(dropStash, t('toast.stashDropped', 'Stash dropped'));

  const pending = applyOp.pending || popOp.pending || dropOp.pending;
  const failure = failedOutput(applyOp.result) ?? failedOutput(popOp.result) ?? failedOutput(dropOp.result);
  const error = applyOp.error ?? popOp.error ?? dropOp.error;
  const files = stashShow.data?.diff ?? [];

  return (
    <DialogShell
      title={stash ? `stash@{${stash.index}} · ${stash.name}` : `stash@{${index}}`}
      description={
        stash
          ? [
              stash.message,
              stash.branch
                ? t('dialog.stashView.onBranch', 'on {branch}', { branch: stash.branch })
                : null,
              stash.date ? formatRelativeTime(stash.date, locale) : null,
            ]
              .filter(Boolean)
              .join(' · ')
          : t('dialog.stashView.title', 'Stash')
      }
      size="xl"
      danger={confirmDrop}
      submitLabel={confirmDrop ? t('dialog.stashView.confirmDrop', 'Confirm drop') : t('common.apply', 'Apply')}
      busy={pending}
      submitDisabled={stashShow.isLoading}
      error={error}
      failure={failure}
      extraFooter={
        confirmDrop ? (
          <Button variant="ghost" onClick={() => setConfirmDrop(false)} disabled={pending}>
            {t('common.cancel', 'Cancel')}
          </Button>
        ) : (
          <>
            <Button variant="secondary" onClick={() => popOp.run({ index })} disabled={pending}>
              {t('menu.popStash', 'Pop stash')}
            </Button>
            <Button variant="ghost" className="text-danger hover:bg-danger/10" onClick={() => setConfirmDrop(true)} disabled={pending}>
              {t('menu.dropStash', 'Drop stash')}
            </Button>
          </>
        )
      }
      onSubmit={() => (confirmDrop ? dropOp.run({ index }) : applyOp.run({ index }))}
      onClose={closeDialog}
    >
      {confirmDrop ? (
        <DialogAlert variant="danger">
          {t('dialog.stashView.dropWarning', 'Dropping this stash permanently deletes it.')}
        </DialogAlert>
      ) : null}
      <div className="flex flex-wrap items-center gap-2 text-xs text-fg-muted">
        {stash ? (
          <>
            <Badge variant="outline" className="font-mono">
              {stash.shortHash}
            </Badge>
            <code className="font-mono text-2xs text-fg-muted">{gitCommand('stash', 'show', '-p', shellQuote(`stash@{${index}}`))}</code>
          </>
        ) : null}
        <span className="ml-auto">
          {t('diff.hunks', '{count} hunks', {
            count: files.reduce((sum, file) => sum + file.hunks.length, 0),
          })}
        </span>
      </div>
      {stashShow.isError ? (
        <DialogAlert variant="danger">
          {t('toast.failed', 'Operation failed')}: {errorMessage(stashShow.error)}
        </DialogAlert>
      ) : stashShow.isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <Spinner />
        </div>
      ) : (
        <div className="h-[46vh] min-h-[220px] overflow-hidden rounded-md border border-border">
          <DiffFilesView files={files} emptyHint={t('diff.noChanges', 'No changes to show.')} />
        </div>
      )}
    </DialogShell>
  );
}

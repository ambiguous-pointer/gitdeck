/**
 * Rebase dialog: rebase the current branch onto a ref, with autostash.
 */
import { useState } from 'react';
import type { RebaseInput } from '@gitdeck/shared';
import { useBranches, useRebase } from '@/api/hooks';
import { Checkbox } from '@/components/ui/checkbox';
import { useI18n } from '@/i18n';
import { DialogAlert, DialogPreview, DialogShell } from './dialog-shell';
import { branchNames, RefField } from './fields';
import { failedOutput, gitCommand, isValidRefName, shellQuote } from './helpers';
import { useCloseDialog, useDialogProps, useDialogRepoId } from './use-dialog';
import { useDialogOperation } from './use-dialog-operation';

type RebaseDialogProps = { onto?: string };

export function RebaseDialog(): JSX.Element {
  const { t } = useI18n();
  const repoId = useDialogRepoId();
  const closeDialog = useCloseDialog();
  const props = useDialogProps<RebaseDialogProps>();
  const branches = useBranches(repoId);
  const rebase = useRebase(repoId);

  const [onto, setOnto] = useState(props.onto ?? '');
  const [autostash, setAutostash] = useState(true);

  const trimmedOnto = onto.trim();
  const invalid = trimmedOnto.length > 0 && !isValidRefName(trimmedOnto);

  const preview = gitCommand(
    'rebase',
    autostash && '--autostash',
    shellQuote(trimmedOnto || '<onto>'),
  );

  const operation = useDialogOperation<RebaseInput>(rebase, t('toast.rebased', 'Rebase completed'));

  return (
    <DialogShell
      title={t('dialog.rebase.title', 'Rebase branch')}
      description={t('dialog.rebase.description', 'Rebase the current branch onto "{onto}".', {
        onto: trimmedOnto || '…',
      })}
      submitLabel={t('dialog.rebase.confirm', 'Rebase')}
      submitDisabled={!trimmedOnto || invalid}
      busy={operation.pending}
      error={operation.error}
      failure={failedOutput(operation.result)}
      onSubmit={() => operation.run({ onto: trimmedOnto, autostash })}
      onClose={closeDialog}
    >
      <DialogAlert variant="warning">{t('dialog.rebase.warning', 'Rebasing rewrites history. Do not rebase branches that other people are working on.')}</DialogAlert>
      <RefField
        label={t('dialog.rebase.onto', 'Rebase onto')}
        value={onto}
        onChange={setOnto}
        options={branchNames(branches.data?.branches)}
        placeholder={t('dialog.rebase.ontoPlaceholder', 'origin/main')}
        hint={t('dialog.rebase.ontoHint', 'The new base of the current branch.')}
        error={invalid ? t('dialog.branch.invalidName', 'Enter a valid Git ref name.') : undefined}
        required
        autoFocus
      />
      <Checkbox
        checked={autostash}
        onChange={setAutostash}
        label={t('dialog.rebase.autostash', 'Automatically stash changes (--autostash)')}
      />
      <DialogPreview command={preview} />
    </DialogShell>
  );
}

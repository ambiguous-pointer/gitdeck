/**
 * Branch dialogs: create, delete and rename.
 */
import { useState } from 'react';
import type { BranchCreateInput, BranchDeleteInput, BranchRenameInput } from '@gitdeck/shared';
import { useBranches, useCreateBranch, useDeleteBranch, useRenameBranch } from '@/api/hooks';
import { Checkbox } from '@/components/ui/checkbox';
import { useI18n } from '@/i18n';
import { DialogAlert, DialogPreview, DialogShell } from './dialog-shell';
import { branchNames, RefField } from './fields';
import { failedOutput, gitCommand, isValidRefName, shellQuote } from './helpers';
import { useCloseDialog, useDialogProps, useDialogRepoId } from './use-dialog';
import { useDialogOperation } from './use-dialog-operation';

/* ------------------------------------------------------------------ */
/* Create                                                              */
/* ------------------------------------------------------------------ */

type BranchCreateDialogProps = { startPoint?: string };

export function BranchCreateDialog(): JSX.Element {
  const { t } = useI18n();
  const repoId = useDialogRepoId();
  const closeDialog = useCloseDialog();
  const props = useDialogProps<BranchCreateDialogProps>();
  const branches = useBranches(repoId);
  const createBranch = useCreateBranch(repoId);

  const [name, setName] = useState('');
  const [startPoint, setStartPoint] = useState(props.startPoint ?? 'HEAD');
  const [checkout, setCheckout] = useState(true);

  const trimmedName = name.trim();
  const trimmedStart = startPoint.trim();
  const nameInvalid = trimmedName.length > 0 && !isValidRefName(trimmedName);
  const startInvalid = trimmedStart.length > 0 && !isValidRefName(trimmedStart);

  const preview = gitCommand(
    checkout ? 'checkout' : 'branch',
    checkout && '-b',
    shellQuote(trimmedName || '<name>'),
    shellQuote(trimmedStart || 'HEAD'),
  );

  const operation = useDialogOperation<BranchCreateInput>(
    createBranch,
    t('toast.branchCreated', 'Branch created'),
  );

  return (
    <DialogShell
      title={t('dialog.branch.title', 'Create branch')}
      description={t('dialog.branch.description', 'Create a new branch from {start}.', {
        start: trimmedStart || 'HEAD',
      })}
      submitLabel={t('dialog.branch.confirm', 'Create branch')}
      submitDisabled={!trimmedName || nameInvalid || startInvalid}
      busy={operation.pending}
      error={operation.error}
      failure={failedOutput(operation.result)}
      onSubmit={() =>
        operation.run({
          name: trimmedName,
          startPoint: trimmedStart && trimmedStart !== 'HEAD' ? trimmedStart : undefined,
          checkout,
        })
      }
      onClose={closeDialog}
    >
      <RefField
        label={t('dialog.branch.name', 'Branch name')}
        value={name}
        onChange={setName}
        placeholder="feature/my-change"
        error={nameInvalid ? t('dialog.branch.invalidName', 'Enter a valid Git branch name.') : undefined}
        required
        autoFocus
      />
      <RefField
        label={t('dialog.branch.startPoint', 'Start point')}
        value={startPoint}
        onChange={setStartPoint}
        options={branchNames(branches.data?.branches)}
        placeholder="HEAD"
        hint={t('dialog.branch.startPointHint', 'Defaults to HEAD (the current commit).')}
        error={startInvalid ? t('dialog.branch.invalidName', 'Enter a valid Git ref name.') : undefined}
      />
      <Checkbox
        checked={checkout}
        onChange={setCheckout}
        label={t('dialog.branch.checkout', 'Checkout after creating')}
      />
      <DialogPreview command={preview} />
    </DialogShell>
  );
}

/* ------------------------------------------------------------------ */
/* Delete                                                              */
/* ------------------------------------------------------------------ */

type BranchDeleteDialogProps = { name?: string };

export function BranchDeleteDialog(): JSX.Element {
  const { t } = useI18n();
  const repoId = useDialogRepoId();
  const closeDialog = useCloseDialog();
  const props = useDialogProps<BranchDeleteDialogProps>();
  const branches = useBranches(repoId);
  const deleteBranch = useDeleteBranch(repoId);

  const [name, setName] = useState(props.name ?? '');
  const [force, setForce] = useState(false);
  const [remote, setRemote] = useState(false);

  const trimmedName = name.trim();
  const invalid = trimmedName.length > 0 && !isValidRefName(trimmedName);

  const preview = gitCommand('branch', force ? '-D' : '-d', shellQuote(trimmedName || '<branch>'));
  const operation = useDialogOperation<BranchDeleteInput>(
    deleteBranch,
    t('toast.branchDeleted', 'Branch deleted'),
  );

  return (
    <DialogShell
      title={t('dialog.branchDelete.title', 'Delete branch')}
      description={t('dialog.branchDelete.description', 'Delete the local branch "{name}".', {
        name: trimmedName || '…',
      })}
      danger
      submitLabel={t('common.delete', 'Delete')}
      submitDisabled={!trimmedName || invalid}
      busy={operation.pending}
      error={operation.error}
      failure={failedOutput(operation.result)}
      onSubmit={() => operation.run({ name: trimmedName, force, remote })}
      onClose={closeDialog}
    >
      <DialogAlert variant="danger">
        {t('dialog.branchDelete.warning', 'Unmerged commits on this branch can be lost forever.')}
      </DialogAlert>
      <RefField
        label={t('dialog.branch.name', 'Branch name')}
        value={name}
        onChange={setName}
        options={branchNames(branches.data?.branches)}
        error={invalid ? t('dialog.branch.invalidName', 'Enter a valid Git branch name.') : undefined}
        required
        autoFocus
      />
      <div className="space-y-1.5">
        <Checkbox
          checked={force}
          onChange={setForce}
          label={t('dialog.branchDelete.force', 'Force delete (-D, even if not merged)')}
        />
        <Checkbox
          checked={remote}
          onChange={setRemote}
          label={t('dialog.branchDelete.remote', 'Also delete the matching remote branch')}
        />
      </div>
      {remote ? (
        <DialogAlert variant="warning">
          {t('dialog.branchDelete.remoteHint', 'The branch is deleted from its remote as well — use with care.')}
        </DialogAlert>
      ) : null}
      <DialogPreview command={preview} danger />
    </DialogShell>
  );
}

/* ------------------------------------------------------------------ */
/* Rename                                                              */
/* ------------------------------------------------------------------ */

type BranchRenameDialogProps = { name?: string };

export function BranchRenameDialog(): JSX.Element {
  const { t } = useI18n();
  const repoId = useDialogRepoId();
  const closeDialog = useCloseDialog();
  const props = useDialogProps<BranchRenameDialogProps>();
  const branches = useBranches(repoId);
  const renameBranch = useRenameBranch(repoId);

  const [from, setFrom] = useState(props.name ?? '');
  const [to, setTo] = useState('');

  const trimmedFrom = from.trim();
  const trimmedTo = to.trim();
  const fromInvalid = trimmedFrom.length > 0 && !isValidRefName(trimmedFrom);
  const toInvalid = trimmedTo.length > 0 && !isValidRefName(trimmedTo);

  const preview = gitCommand('branch', '-m', shellQuote(trimmedFrom || '<from>'), shellQuote(trimmedTo || '<to>'));
  const operation = useDialogOperation<BranchRenameInput>(
    renameBranch,
    t('toast.branchRenamed', 'Branch renamed'),
  );

  return (
    <DialogShell
      title={t('dialog.branchRename.title', 'Rename branch')}
      description={t('dialog.branchRename.description', 'Rename "{from}" and keep its history.', {
        from: trimmedFrom || '…',
      })}
      submitLabel={t('common.rename', 'Rename')}
      submitDisabled={!trimmedFrom || !trimmedTo || fromInvalid || toInvalid || trimmedFrom === trimmedTo}
      busy={operation.pending}
      error={operation.error}
      failure={failedOutput(operation.result)}
      onSubmit={() => operation.run({ from: trimmedFrom, to: trimmedTo })}
      onClose={closeDialog}
    >
      <RefField
        label={t('dialog.branchRename.from', 'Current name')}
        value={from}
        onChange={setFrom}
        options={branchNames(branches.data?.branches)}
        error={fromInvalid ? t('dialog.branch.invalidName', 'Enter a valid Git branch name.') : undefined}
        required
      />
      <RefField
        label={t('dialog.branchRename.to', 'New name')}
        value={to}
        onChange={setTo}
        placeholder="feature/new-name"
        error={toInvalid ? t('dialog.branch.invalidName', 'Enter a valid Git branch name.') : undefined}
        required
        autoFocus
      />
      <DialogPreview command={preview} />
    </DialogShell>
  );
}

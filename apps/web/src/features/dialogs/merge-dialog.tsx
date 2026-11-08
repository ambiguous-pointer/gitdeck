/**
 * Merge dialog: merge a branch into the current one, optionally creating a
 * merge commit or squashing, with an exact command preview.
 */
import { useState } from 'react';
import type { MergeInput } from '@gitdeck/shared';
import { useBranches, useMerge } from '@/api/hooks';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, Input } from '@/components/ui/input';
import { useI18n } from '@/i18n';
import { DialogPreview, DialogShell } from './dialog-shell';
import { branchNames, RefField } from './fields';
import { failedOutput, gitCommand, isValidRefName, shellQuote } from './helpers';
import { useCloseDialog, useDialogProps, useDialogRepoId } from './use-dialog';
import { useDialogOperation } from './use-dialog-operation';

type MergeDialogProps = { branch?: string };

export function MergeDialog(): JSX.Element {
  const { t } = useI18n();
  const repoId = useDialogRepoId();
  const closeDialog = useCloseDialog();
  const props = useDialogProps<MergeDialogProps>();
  const branches = useBranches(repoId);
  const merge = useMerge(repoId);

  const [branch, setBranch] = useState(props.branch ?? '');
  const [noFf, setNoFf] = useState(true);
  const [squash, setSquash] = useState(false);
  const [message, setMessage] = useState('');

  const trimmedBranch = branch.trim();
  const trimmedMessage = message.trim();
  const branchInvalid = trimmedBranch.length > 0 && !isValidRefName(trimmedBranch);
  const suggestion = branches.data?.branches.find((item) => item.name === trimmedBranch)?.current;

  const preview = gitCommand(
    'merge',
    noFf && !squash && '--no-ff',
    squash && '--squash',
    trimmedMessage && !squash && `-m ${shellQuote(trimmedMessage)}`,
    shellQuote(trimmedBranch || '<branch>'),
  );

  const operation = useDialogOperation<MergeInput>(merge, t('toast.merged', 'Merge completed'));

  return (
    <DialogShell
      title={t('dialog.merge.title', 'Merge branch')}
      description={t('dialog.merge.description', 'Merge "{branch}" into the current branch.', {
        branch: trimmedBranch || '…',
      })}
      submitLabel={t('dialog.merge.confirm', 'Merge')}
      submitDisabled={!trimmedBranch || branchInvalid || Boolean(suggestion)}
      busy={operation.pending}
      error={operation.error}
      failure={failedOutput(operation.result)}
      onSubmit={() =>
        operation.run({
          branch: trimmedBranch,
          noFf: noFf && !squash,
          squash,
          message: trimmedMessage || undefined,
        })
      }
      onClose={closeDialog}
    >
      <RefField
        label={t('dialog.merge.branch', 'Branch to merge')}
        value={branch}
        onChange={setBranch}
        options={branchNames(branches.data?.branches)}
        placeholder={t('dialog.merge.targetPlaceholder', 'feature/my-branch')}
        hint={
          suggestion
            ? t('dialog.merge.currentBranch', 'This is the branch you are already on.')
            : t('dialog.merge.targetHint', 'Branch, tag or commit to merge into the current branch.')
        }
        error={branchInvalid ? t('dialog.branch.invalidName', 'Enter a valid Git ref name.') : undefined}
        required
        autoFocus
      />
      <div className="space-y-1.5">
        <Checkbox
          checked={noFf && !squash}
          onChange={(checked) => setNoFf(checked)}
          disabled={squash}
          label={t('dialog.merge.noFf', 'Create a merge commit (--no-ff)')}
        />
        <Checkbox
          checked={squash}
          onChange={(checked) => setSquash(checked)}
          label={t('dialog.merge.squash', 'Squash commits (--squash)')}
        />
      </div>
      {noFf && !squash ? (
        <Field label={t('dialog.merge.message', 'Merge commit message')}>
          <Input
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder={t('dialog.merge.messagePlaceholder', 'Leave empty to use the default message')}
          />
        </Field>
      ) : null}
      <DialogPreview command={preview} />
    </DialogShell>
  );
}

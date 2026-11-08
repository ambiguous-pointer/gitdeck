/**
 * Checkout dialog: switch to a branch/tag/commit, optionally detaching HEAD or
 * forcing the checkout (discarding local changes).
 */
import { useState } from 'react';
import type { CheckoutInput } from '@gitdeck/shared';
import { useBranches, useCheckout } from '@/api/hooks';
import { Checkbox } from '@/components/ui/checkbox';
import { useI18n } from '@/i18n';
import { DialogAlert, DialogPreview, DialogShell } from './dialog-shell';
import { branchNames, RefField } from './fields';
import { failedOutput, gitCommand, isValidRefName, shellQuote } from './helpers';
import { useCloseDialog, useDialogProps, useDialogRepoId } from './use-dialog';
import { useDialogOperation } from './use-dialog-operation';

type CheckoutDialogProps = { target?: string };

export function CheckoutDialog(): JSX.Element {
  const { t } = useI18n();
  const repoId = useDialogRepoId();
  const closeDialog = useCloseDialog();
  const props = useDialogProps<CheckoutDialogProps>();
  const branches = useBranches(repoId);
  const checkout = useCheckout(repoId);

  const [target, setTarget] = useState(props.target ?? '');
  const [detach, setDetach] = useState(false);
  const [force, setForce] = useState(false);

  const trimmedTarget = target.trim();
  const invalid = trimmedTarget.length > 0 && !isValidRefName(trimmedTarget);

  const preview = gitCommand(
    'checkout',
    detach && '--detach',
    force && '--force',
    shellQuote(trimmedTarget || '<target>'),
  );

  const operation = useDialogOperation<CheckoutInput>(
    checkout,
    t('toast.checkedOut', 'Checked out {target}', { target: trimmedTarget }),
  );

  return (
    <DialogShell
      title={t('dialog.checkout.title', 'Checkout')}
      description={t('dialog.checkout.description', 'Switch the working tree to a branch, tag or commit.')}
      submitLabel={t('dialog.checkout.confirm', 'Checkout')}
      submitDisabled={!trimmedTarget || invalid}
      busy={operation.pending}
      error={operation.error}
      failure={failedOutput(operation.result)}
      onSubmit={() => operation.run({ target: trimmedTarget, detach, force })}
      onClose={closeDialog}
    >
      <RefField
        label={t('dialog.checkout.target', 'Branch, tag or commit')}
        value={target}
        onChange={setTarget}
        options={branchNames(branches.data?.branches)}
        placeholder="main / v1.2.0 / 3f9c2a1"
        required
        autoFocus
        error={invalid ? t('dialog.branch.invalidName', 'Enter a valid Git ref name.') : undefined}
      />
      <div className="space-y-1.5">
        <Checkbox
          checked={detach}
          onChange={setDetach}
          label={t('dialog.checkout.detach', 'Detach HEAD')}
        />
        <Checkbox
          checked={force}
          onChange={setForce}
          label={t('dialog.checkout.force', 'Force checkout (discard local changes)')}
        />
      </div>
      {force ? (
        <DialogAlert variant="danger">
          {t('dialog.checkout.forceWarning', 'Force checkout throws away uncommitted changes in the working tree.')}
        </DialogAlert>
      ) : null}
      <DialogPreview command={preview} danger={force} />
    </DialogShell>
  );
}

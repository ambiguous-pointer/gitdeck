/**
 * Worktree dialogs: create a linked worktree and remove one.
 */
import { useState } from 'react';
import type { WorktreeAddInput, WorktreeRemoveInput } from '@gitdeck/shared';
import { useAddWorktree, useBranches, useRemoveWorktree, useWorktrees } from '@/api/hooks';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, Input } from '@/components/ui/input';
import { SegmentedControl } from '@/components/ui/segmented';
import { useI18n } from '@/i18n';
import { DialogAlert, DialogPreview, DialogShell } from './dialog-shell';
import { branchNames, RefField } from './fields';
import { failedOutput, gitCommand, isValidRefName, shellQuote } from './helpers';
import { useCloseDialog, useDialogProps, useDialogRepoId } from './use-dialog';
import { useDialogOperation } from './use-dialog-operation';

type WorktreeMode = 'branch' | 'new-branch' | 'detach';

/* ------------------------------------------------------------------ */
/* Add                                                                 */
/* ------------------------------------------------------------------ */

type WorktreeAddDialogProps = { branch?: string };

export function WorktreeAddDialog(): JSX.Element {
  const { t } = useI18n();
  const repoId = useDialogRepoId();
  const closeDialog = useCloseDialog();
  const props = useDialogProps<WorktreeAddDialogProps>();
  const branches = useBranches(repoId);
  const addWorktree = useAddWorktree(repoId);

  const [path, setPath] = useState('');
  const [mode, setMode] = useState<WorktreeMode>(props.branch ? 'branch' : 'new-branch');
  const [branch, setBranch] = useState(props.branch ?? '');
  const [newBranch, setNewBranch] = useState('');
  const [startPoint, setStartPoint] = useState('HEAD');
  const [force, setForce] = useState(false);

  const trimmedPath = path.trim();
  const trimmedBranch = branch.trim();
  const trimmedNewBranch = newBranch.trim();
  const trimmedStart = startPoint.trim();

  const branchInvalid = mode === 'branch' && trimmedBranch.length > 0 && !isValidRefName(trimmedBranch);
  const newBranchInvalid = mode === 'new-branch' && trimmedNewBranch.length > 0 && !isValidRefName(trimmedNewBranch);
  const startInvalid = trimmedStart.length > 0 && !isValidRefName(trimmedStart);

  const preview =
    mode === 'branch'
      ? gitCommand('worktree', 'add', force && '--force', shellQuote(trimmedPath || '<path>'), shellQuote(trimmedBranch || '<branch>'))
      : mode === 'new-branch'
        ? gitCommand(
            'worktree',
            'add',
            force && '--force',
            '-b',
            shellQuote(trimmedNewBranch || '<new-branch>'),
            shellQuote(trimmedPath || '<path>'),
            shellQuote(trimmedStart),
          )
        : gitCommand(
            'worktree',
            'add',
            force && '--force',
            '--detach',
            shellQuote(trimmedPath || '<path>'),
            shellQuote(trimmedStart),
          );

  const submitDisabled =
    !trimmedPath ||
    (mode === 'branch' && (!trimmedBranch || branchInvalid)) ||
    (mode === 'new-branch' && (!trimmedNewBranch || newBranchInvalid)) ||
    startInvalid;

  const operation = useDialogOperation<WorktreeAddInput>(
    addWorktree,
    t('toast.worktreeAdded', 'Worktree created'),
  );

  return (
    <DialogShell
      title={t('dialog.worktree.addTitle', 'Create worktree')}
      description={t(
        'dialog.worktree.addDescription',
        'Check out a branch in a separate directory while keeping this working tree untouched.',
      )}
      size="lg"
      submitLabel={t('dialog.worktree.add', 'Create worktree')}
      submitDisabled={submitDisabled}
      busy={operation.pending}
      error={operation.error}
      failure={failedOutput(operation.result)}
      onSubmit={() =>
        operation.run({
          path: trimmedPath,
          branch: mode === 'branch' ? trimmedBranch : undefined,
          newBranch: mode === 'new-branch' ? trimmedNewBranch : undefined,
          detach: mode === 'detach' || undefined,
          startPoint: mode === 'branch' ? undefined : trimmedStart || undefined,
          force: force || undefined,
        })
      }
      onClose={closeDialog}
    >
      <Field
        label={t('dialog.worktree.path', 'Worktree path')}
        hint={t('dialog.worktree.pathHint', 'An empty or non-existing directory outside this checkout.')}
        required
      >
        <Input
          value={path}
          onChange={(event) => setPath(event.target.value)}
          placeholder={t('dialog.worktree.pathPlaceholder', 'D:\\projects\\my-repo-feature')}
          spellCheck={false}
          autoFocus
        />
      </Field>
      <div>
        <span className="mb-1 block text-xs font-medium text-fg-secondary">{t('dialog.worktree.kind', 'Worktree type')}</span>
        <SegmentedControl<WorktreeMode>
          value={mode}
          onChange={setMode}
          className="w-full"
          options={[
            { value: 'branch', label: t('dialog.worktree.branch', 'Existing branch') },
            { value: 'new-branch', label: t('dialog.worktree.newBranch', 'New branch') },
            { value: 'detach', label: t('dialog.worktree.detach', 'Detached') },
          ]}
        />
      </div>
      {mode === 'branch' ? (
        <RefField
          label={t('dialog.worktree.branchLabel', 'Branch to check out')}
          value={branch}
          onChange={setBranch}
          options={branchNames(branches.data?.branches).filter((name) => !name.includes('/'))}
          placeholder="feature/my-branch"
          error={branchInvalid ? t('dialog.branch.invalidName', 'Enter a valid Git branch name.') : undefined}
          required
        />
      ) : null}
      {mode === 'new-branch' ? (
        <RefField
          label={t('dialog.worktree.newBranchLabel', 'New branch name')}
          value={newBranch}
          onChange={setNewBranch}
          placeholder="feature/my-branch"
          error={newBranchInvalid ? t('dialog.branch.invalidName', 'Enter a valid Git branch name.') : undefined}
          required
        />
      ) : null}
      {mode !== 'branch' ? (
        <RefField
          label={t('dialog.worktree.startPoint', 'Start point')}
          value={startPoint}
          onChange={setStartPoint}
          options={branchNames(branches.data?.branches)}
          placeholder="HEAD"
          error={startInvalid ? t('dialog.branch.invalidName', 'Enter a valid Git ref name.') : undefined}
        />
      ) : null}
      <Checkbox
        checked={force}
        onChange={setForce}
        label={t('dialog.worktree.force', 'Force (path already exists)')}
      />
      {force ? (
        <DialogAlert variant="warning">
          {t('dialog.worktree.forceWarning', 'Force overwrites an existing directory that already contains files.')}
        </DialogAlert>
      ) : null}
      <DialogPreview command={preview} />
    </DialogShell>
  );
}

/* ------------------------------------------------------------------ */
/* Remove                                                              */
/* ------------------------------------------------------------------ */

type WorktreeRemoveDialogProps = { path?: string };

export function WorktreeRemoveDialog(): JSX.Element {
  const { t } = useI18n();
  const repoId = useDialogRepoId();
  const closeDialog = useCloseDialog();
  const props = useDialogProps<WorktreeRemoveDialogProps>();
  const worktrees = useWorktrees(repoId);
  const removeWorktree = useRemoveWorktree(repoId);

  const [path, setPath] = useState(props.path ?? '');
  const [force, setForce] = useState(false);

  const trimmedPath = path.trim();
  const known = worktrees.data?.worktrees.find((item) => item.path === trimmedPath);
  const blocked = Boolean(known?.isMain);

  const preview = gitCommand('worktree', 'remove', force && '--force', shellQuote(trimmedPath || '<path>'));
  const operation = useDialogOperation<WorktreeRemoveInput>(
    removeWorktree,
    t('toast.worktreeRemoved', 'Worktree removed'),
  );

  return (
    <DialogShell
      title={t('dialog.worktree.removeTitle', 'Remove worktree')}
      description={
        trimmedPath
          ? t('dialog.worktree.removeMessage', 'Remove the worktree at {path}? The branch will not be deleted.', {
              path: trimmedPath,
            })
          : t('dialog.worktree.removeDescription', 'Delete a linked worktree directory.')
      }
      danger
      submitLabel={t('common.remove', 'Remove')}
      submitDisabled={!trimmedPath || blocked}
      busy={operation.pending}
      error={operation.error}
      failure={failedOutput(operation.result)}
      onSubmit={() => operation.run({ path: trimmedPath, force: force || undefined })}
      onClose={closeDialog}
    >
      <DialogAlert variant="danger">
        {t(
          'dialog.worktree.removeWarning',
          'Uncommitted changes inside the worktree are lost unless the worktree is force-removed. The branch itself is kept.',
        )}
      </DialogAlert>
      {blocked ? (
        <DialogAlert variant="warning">
          {t('dialog.worktree.mainBlocked', 'The main worktree of a repository cannot be removed.')}
        </DialogAlert>
      ) : null}
      <RefField
        label={t('dialog.worktree.path', 'Worktree path')}
        value={path}
        onChange={setPath}
        options={(worktrees.data?.worktrees ?? []).map((item) => item.path)}
        required
        autoFocus
      />
      <Checkbox
        checked={force}
        onChange={setForce}
        label={t('dialog.worktree.forceRemove', 'Force removal')}
      />
      <DialogPreview command={preview} danger />
    </DialogShell>
  );
}

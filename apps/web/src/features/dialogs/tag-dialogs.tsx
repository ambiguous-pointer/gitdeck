/**
 * Tag dialogs: create (lightweight or annotated) and delete.
 */
import { useState } from 'react';
import type { TagCreateInput, TagDeleteInput } from '@gitdeck/shared';
import { useCreateTag, useDeleteTag, useRemotes } from '@/api/hooks';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, Input } from '@/components/ui/input';
import { useI18n } from '@/i18n';
import { DialogAlert, DialogPreview, DialogShell } from './dialog-shell';
import { RefField, RemoteSelect } from './fields';
import { failedOutput, gitCommand, isValidRefName, shellQuote } from './helpers';
import { useCloseDialog, useDialogProps, useDialogRepoId } from './use-dialog';
import { useDialogOperation } from './use-dialog-operation';

/* ------------------------------------------------------------------ */
/* Create                                                              */
/* ------------------------------------------------------------------ */

type TagCreateDialogProps = { target?: string };

export function TagCreateDialog(): JSX.Element {
  const { t } = useI18n();
  const repoId = useDialogRepoId();
  const closeDialog = useCloseDialog();
  const props = useDialogProps<TagCreateDialogProps>();
  const remotes = useRemotes(repoId);
  const createTag = useCreateTag(repoId);

  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [target, setTarget] = useState(props.target ?? '');
  const [push, setPush] = useState(false);
  const [remote, setRemote] = useState('');

  const trimmedName = name.trim();
  const trimmedMessage = message.trim();
  const trimmedTarget = target.trim();
  const annotated = trimmedMessage.length > 0;
  const nameInvalid = trimmedName.length > 0 && !isValidRefName(trimmedName);
  const targetInvalid = trimmedTarget.length > 0 && !isValidRefName(trimmedTarget);

  const remoteNames = remotes.data?.remotes.map((item) => item.name) ?? [];
  const selectedRemote = remote || remoteNames[0] || 'origin';
  const createPreview = gitCommand(
    'tag',
    annotated && '-a',
    shellQuote(trimmedName || '<name>'),
    annotated && `-m ${shellQuote(trimmedMessage)}`,
    shellQuote(trimmedTarget),
  );
  const pushPreview = push ? gitCommand('push', shellQuote(selectedRemote), shellQuote(trimmedName)) : '';
  const preview = pushPreview ? `${createPreview}\n${pushPreview}` : createPreview;

  const operation = useDialogOperation<TagCreateInput>(createTag, t('toast.tagCreated', 'Tag created'));

  return (
    <DialogShell
      title={t('dialog.tag.title', 'Create tag')}
      description={t('dialog.tag.description', 'Create a lightweight or annotated tag on a commit.')}
      submitLabel={t('dialog.tag.confirm', 'Create tag')}
      submitDisabled={!trimmedName || nameInvalid || targetInvalid || (push && remoteNames.length === 0)}
      busy={operation.pending}
      error={operation.error}
      failure={failedOutput(operation.result)}
      onSubmit={() =>
        operation.run({
          name: trimmedName,
          message: trimmedMessage || undefined,
          target: trimmedTarget || undefined,
          push: push || undefined,
          remote: push ? selectedRemote : undefined,
        })
      }
      onClose={closeDialog}
    >
      <RefField
        label={t('dialog.tag.name', 'Tag name')}
        value={name}
        onChange={setName}
        placeholder="v1.2.0"
        error={nameInvalid ? t('dialog.branch.invalidName', 'Enter a valid Git ref name.') : undefined}
        required
        autoFocus
      />
      <RefField
        label={t('dialog.tag.target', 'Target commit')}
        value={target}
        onChange={setTarget}
        placeholder={t('dialog.tag.targetPlaceholder', 'HEAD (default)')}
        hint={t('dialog.tag.targetHint', 'Commit hash or ref; defaults to HEAD.')}
        error={targetInvalid ? t('dialog.branch.invalidName', 'Enter a valid Git ref name.') : undefined}
      />
      <Field label={t('dialog.tag.message', 'Tag message (creates an annotated tag)')}>
        <Input
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder={t('dialog.tag.messagePlaceholder', 'Release v1.2.0')}
        />
      </Field>
      <div className="space-y-2">
        <Checkbox
          checked={push}
          onChange={setPush}
          label={t('dialog.tag.push', 'Push tag to remote after creating')}
        />
        {push ? (
          <RemoteSelect
            label={t('dialog.push.remote', 'Remote')}
            value={selectedRemote}
            onChange={setRemote}
            remotes={remotes.data?.remotes}
          />
        ) : null}
      </div>
      <DialogPreview command={preview} />
    </DialogShell>
  );
}

/* ------------------------------------------------------------------ */
/* Delete                                                              */
/* ------------------------------------------------------------------ */

type TagDeleteDialogProps = { name?: string };

export function TagDeleteDialog(): JSX.Element {
  const { t } = useI18n();
  const repoId = useDialogRepoId();
  const closeDialog = useCloseDialog();
  const props = useDialogProps<TagDeleteDialogProps>();
  const remotes = useRemotes(repoId);
  const deleteTag = useDeleteTag(repoId);

  const [name, setName] = useState(props.name ?? '');
  const [deleteRemote, setDeleteRemote] = useState(false);
  const [remote, setRemote] = useState('');

  const trimmedName = name.trim();
  const invalid = trimmedName.length > 0 && !isValidRefName(trimmedName);
  const remoteNames = remotes.data?.remotes.map((item) => item.name) ?? [];
  const selectedRemote = remote || remoteNames[0] || 'origin';

  const localPreview = gitCommand('tag', '-d', shellQuote(trimmedName || '<tag>'));
  const remotePreview = deleteRemote
    ? gitCommand('push', shellQuote(selectedRemote), shellQuote(`:refs/tags/${trimmedName || '<tag>'}`))
    : '';
  const preview = remotePreview ? `${localPreview}\n${remotePreview}` : localPreview;

  const operation = useDialogOperation<TagDeleteInput>(deleteTag, t('toast.tagDeleted', 'Tag deleted'));

  return (
    <DialogShell
      title={t('dialog.tagDelete.title', 'Delete tag')}
      description={t('dialog.tagDelete.description', 'Delete the tag "{name}".', { name: trimmedName || '…' })}
      danger
      submitLabel={t('common.delete', 'Delete')}
      submitDisabled={!trimmedName || invalid}
      busy={operation.pending}
      error={operation.error}
      failure={failedOutput(operation.result)}
      onSubmit={() =>
        operation.run({
          name: trimmedName,
          remote: deleteRemote ? selectedRemote : undefined,
        })
      }
      onClose={closeDialog}
    >
      <DialogAlert variant="danger">
        {t('dialog.tagDelete.warning', 'Deleting a published tag rewrites a reference other people may rely on.')}
      </DialogAlert>
      <RefField
        label={t('dialog.tag.name', 'Tag name')}
        value={name}
        onChange={setName}
        error={invalid ? t('dialog.branch.invalidName', 'Enter a valid Git ref name.') : undefined}
        required
        autoFocus
      />
      <Checkbox
        checked={deleteRemote}
        onChange={setDeleteRemote}
        label={t('dialog.tagDelete.remote', 'Also delete the tag on the remote')}
      />
      {deleteRemote ? (
        <RemoteSelect
          label={t('dialog.push.remote', 'Remote')}
          value={selectedRemote}
          onChange={setRemote}
          remotes={remotes.data?.remotes}
        />
      ) : null}
      <DialogPreview command={preview} danger />
    </DialogShell>
  );
}

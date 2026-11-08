/**
 * Remote dialogs: add, edit (rename + urls) and remove.
 */
import { useState } from 'react';
import type { RemoteAddInput, RemoteRemoveInput, RemoteUpdateInput } from '@gitdeck/shared';
import { useAddRemote, useRemotes, useRemoveRemote, useUpdateRemote } from '@/api/hooks';
import { Field, Input } from '@/components/ui/input';
import { useI18n } from '@/i18n';
import { DialogAlert, DialogPreview, DialogShell } from './dialog-shell';
import { failedOutput, gitCommand, isValidRefName, shellQuote } from './helpers';
import { useCloseDialog, useDialogProps, useDialogRepoId } from './use-dialog';
import { useDialogOperation } from './use-dialog-operation';

/* ------------------------------------------------------------------ */
/* Add                                                                 */
/* ------------------------------------------------------------------ */

type RemoteAddDialogProps = Record<string, never>;

export function RemoteAddDialog(): JSX.Element {
  const { t } = useI18n();
  const repoId = useDialogRepoId();
  const closeDialog = useCloseDialog();
  useDialogProps<RemoteAddDialogProps>();
  const addRemote = useAddRemote(repoId);

  const [name, setName] = useState('origin');
  const [url, setUrl] = useState('');
  const [pushUrl, setPushUrl] = useState('');

  const trimmedName = name.trim();
  const trimmedUrl = url.trim();
  const trimmedPushUrl = pushUrl.trim();
  const nameInvalid = trimmedName.length > 0 && !isValidRefName(trimmedName);

  const preview = [
    gitCommand('remote', 'add', shellQuote(trimmedName || '<name>'), shellQuote(trimmedUrl || '<url>')),
    trimmedPushUrl ? gitCommand('remote', 'set-url', '--push', shellQuote(trimmedName), shellQuote(trimmedPushUrl)) : '',
  ]
    .filter(Boolean)
    .join('\n');

  const operation = useDialogOperation<RemoteAddInput>(addRemote, t('toast.remoteAdded', 'Remote added'));

  return (
    <DialogShell
      title={t('dialog.remote.addTitle', 'Add remote')}
      description={t('dialog.remote.addDescription', 'Register a remote repository (HTTPS, SSH or a local path).')}
      submitLabel={t('dialog.remote.add', 'Add remote')}
      submitDisabled={!trimmedName || !trimmedUrl || nameInvalid}
      busy={operation.pending}
      error={operation.error}
      failure={failedOutput(operation.result)}
      onSubmit={() =>
        operation.run({
          name: trimmedName,
          url: trimmedUrl,
          pushUrl: trimmedPushUrl || undefined,
        })
      }
      onClose={closeDialog}
    >
      <Field
        label={t('dialog.remote.name', 'Remote name')}
        error={nameInvalid ? t('dialog.remote.invalidName', 'Use a single word like "origin".') : undefined}
        required
      >
        <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="origin" spellCheck={false} autoFocus />
      </Field>
      <Field label={t('dialog.remote.url', 'Fetch URL')} hint={t('dialog.remote.urlHint', 'https://host/owner/repo.git or git@host:owner/repo.git')} required>
        <Input
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://github.com/owner/repo.git"
          spellCheck={false}
        />
      </Field>
      <Field label={t('dialog.remote.pushUrl', 'Push URL (optional)')}>
        <Input
          value={pushUrl}
          onChange={(event) => setPushUrl(event.target.value)}
          placeholder={trimmedUrl || 'https://github.com/owner/repo.git'}
          spellCheck={false}
        />
      </Field>
      <DialogPreview command={preview} />
    </DialogShell>
  );
}

/* ------------------------------------------------------------------ */
/* Edit                                                                */
/* ------------------------------------------------------------------ */

type RemoteEditDialogProps = { name?: string };

export function RemoteEditDialog(): JSX.Element {
  const { t } = useI18n();
  const repoId = useDialogRepoId();
  const closeDialog = useCloseDialog();
  const props = useDialogProps<RemoteEditDialogProps>();
  const remotes = useRemotes(repoId);
  const updateRemote = useUpdateRemote(repoId);

  const current = remotes.data?.remotes.find((remote) => remote.name === props.name);
  const originalName = props.name ?? current?.name ?? '';

  const [newName, setNewName] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [pushUrl, setPushUrl] = useState<string | null>(null);

  const effectiveName = newName ?? originalName;
  const originalUrl = current?.fetchUrl ?? '';
  const effectiveUrl = url ?? originalUrl;
  const effectivePushUrl = pushUrl ?? (current?.pushUrl && current.pushUrl !== current.fetchUrl ? current.pushUrl : '');

  const nameInvalid = effectiveName.length > 0 && !isValidRefName(effectiveName);
  const nameChanged = effectiveName !== originalName;
  const urlChanged = effectiveUrl !== originalUrl;
  const pushUrlChanged = effectivePushUrl !== (current?.pushUrl && current.pushUrl !== current.fetchUrl ? current.pushUrl : '');
  const dirty = nameChanged || urlChanged || pushUrlChanged;

  const previewParts: string[] = [];
  if (nameChanged) previewParts.push(gitCommand('remote', 'rename', shellQuote(originalName), shellQuote(effectiveName)));
  if (urlChanged) previewParts.push(gitCommand('remote', 'set-url', shellQuote(effectiveName), shellQuote(effectiveUrl)));
  if (pushUrlChanged) {
    previewParts.push(
      gitCommand('remote', 'set-url', '--push', shellQuote(effectiveName), shellQuote(effectivePushUrl)),
    );
  }
  const preview = previewParts.length > 0 ? previewParts.join('\n') : `# ${t('dialog.remote.noChanges', 'Nothing to update')}`;

  const operation = useDialogOperation<RemoteUpdateInput>(
    updateRemote,
    t('toast.remoteUpdated', 'Remote updated'),
  );

  return (
    <DialogShell
      title={t('dialog.remote.editTitle', 'Edit remote')}
      description={t('dialog.remote.editDescription', 'Rename the remote or update its fetch and push URLs.')}
      submitLabel={t('dialog.remote.save', 'Save remote')}
      submitDisabled={!originalName || !dirty || nameInvalid || !effectiveUrl}
      busy={operation.pending}
      error={operation.error}
      failure={failedOutput(operation.result)}
      onSubmit={() =>
        operation.run({
          name: originalName,
          newName: nameChanged ? effectiveName : undefined,
          url: urlChanged ? effectiveUrl : undefined,
          pushUrl: pushUrlChanged ? effectivePushUrl : undefined,
        })
      }
      onClose={closeDialog}
    >
      {remoteMissing(current, remotes.isSuccess) ? (
        <DialogAlert variant="warning">{t('dialog.remote.notFound', 'That remote no longer exists.')}</DialogAlert>
      ) : null}
      <Field
        label={t('dialog.remote.name', 'Remote name')}
        error={nameInvalid ? t('dialog.remote.invalidName', 'Use a single word like "origin".') : undefined}
        required
      >
        <Input value={effectiveName} onChange={(event) => setNewName(event.target.value)} spellCheck={false} autoFocus />
      </Field>
      <Field label={t('dialog.remote.url', 'Fetch URL')} required>
        <Input value={effectiveUrl} onChange={(event) => setUrl(event.target.value)} spellCheck={false} />
      </Field>
      <Field label={t('dialog.remote.pushUrl', 'Push URL (optional)')} hint={t('dialog.remote.pushUrlHint', 'Defaults to the fetch URL when empty.')}>
        <Input value={effectivePushUrl} onChange={(event) => setPushUrl(event.target.value)} spellCheck={false} />
      </Field>
      <DialogPreview command={preview} />
    </DialogShell>
  );
}

/* ------------------------------------------------------------------ */
/* Remove                                                              */
/* ------------------------------------------------------------------ */

type RemoteRemoveDialogProps = { name?: string };

export function RemoteRemoveDialog(): JSX.Element {
  const { t } = useI18n();
  const repoId = useDialogRepoId();
  const closeDialog = useCloseDialog();
  const props = useDialogProps<RemoteRemoveDialogProps>();
  const remotes = useRemotes(repoId);
  const removeRemote = useRemoveRemote(repoId);

  const [name, setName] = useState(props.name ?? '');
  const trimmedName = name.trim();
  const known = remotes.data?.remotes.find((remote) => remote.name === trimmedName);

  const preview = gitCommand('remote', 'remove', shellQuote(trimmedName || '<name>'));
  const operation = useDialogOperation<RemoteRemoveInput>(
    removeRemote,
    t('toast.remoteRemoved', 'Remote removed'),
  );

  return (
    <DialogShell
      title={t('dialog.remote.removeTitle', 'Remove remote')}
      description={t('dialog.remote.removeDescription', 'Remove the remote "{name}" and its remote-tracking branches.', {
        name: trimmedName || '…',
      })}
      danger
      submitLabel={t('common.remove', 'Remove')}
      submitDisabled={!trimmedName}
      busy={operation.pending}
      error={operation.error}
      failure={failedOutput(operation.result)}
      onSubmit={() => operation.run({ name: trimmedName })}
      onClose={closeDialog}
    >
      <DialogAlert variant="danger">
        {t('dialog.remote.removeWarning', 'Remote-tracking branches are removed with the remote. Local branches are kept.')}
      </DialogAlert>
      <Field label={t('dialog.remote.name', 'Remote name')} required>
        <Input value={name} onChange={(event) => setName(event.target.value)} spellCheck={false} autoFocus />
      </Field>
      {known ? (
        <p className="break-all text-2xs text-fg-muted">
          {known.fetchUrl}
          {known.pushUrl && known.pushUrl !== known.fetchUrl ? ` → ${known.pushUrl}` : ''}
        </p>
      ) : null}
      <DialogPreview command={preview} danger />
    </DialogShell>
  );
}

function remoteMissing(
  current: { name: string } | undefined,
  loaded: boolean,
): boolean {
  return loaded && !current;
}

/**
 * `git config` dialog: set a local or global configuration value.
 */
import { useState } from 'react';
import type { ConfigSetInput } from '@gitdeck/shared';
import { useConfigSet } from '@/api/hooks';
import { Field, Input } from '@/components/ui/input';
import { SegmentedControl } from '@/components/ui/segmented';
import { useI18n } from '@/i18n';
import { DialogPreview, DialogShell } from './dialog-shell';
import { failedOutput, gitCommand, shellQuote } from './helpers';
import { useCloseDialog, useDialogProps, useDialogRepoId } from './use-dialog';
import { useDialogOperation } from './use-dialog-operation';

type ConfigScope = ConfigSetInput['scope'];

const KEY_SUGGESTIONS = [
  'user.name',
  'user.email',
  'core.autocrlf',
  'core.editor',
  'pull.rebase',
  'push.default',
  'commit.gpgsign',
  'http.proxy',
  'https.proxy',
  'init.defaultBranch',
];

function isValidConfigKey(key: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9.-]*$/.test(key);
}

type ConfigSetDialogProps = { key?: string; scope?: ConfigScope };

export function ConfigSetDialog(): JSX.Element {
  const { t } = useI18n();
  const repoId = useDialogRepoId();
  const closeDialog = useCloseDialog();
  const props = useDialogProps<ConfigSetDialogProps>();
  const configSet = useConfigSet(repoId);

  const [scope, setScope] = useState<ConfigScope>(props.scope ?? 'local');
  const [key, setKey] = useState(props.key ?? '');
  const [value, setValue] = useState('');

  const trimmedKey = key.trim();
  const keyInvalid = trimmedKey.length > 0 && !isValidConfigKey(trimmedKey);
  const listId = 'gitdeck-config-keys';

  const preview = gitCommand('config', `--${scope}`, shellQuote(trimmedKey || '<key>'), shellQuote(value));
  const operation = useDialogOperation<ConfigSetInput>(
    configSet,
    t('toast.configSaved', 'Configuration updated'),
  );

  return (
    <DialogShell
      title={t('dialog.config.title', 'Git configuration')}
      description={t('dialog.config.setDescription', 'Write one configuration entry to the selected scope.')}
      submitLabel={t('dialog.config.set', 'Set value')}
      submitDisabled={!trimmedKey || keyInvalid}
      busy={operation.pending}
      error={operation.error}
      failure={failedOutput(operation.result)}
      onSubmit={() => operation.run({ scope, key: trimmedKey, value })}
      onClose={closeDialog}
    >
      <div>
        <span className="mb-1 block text-xs font-medium text-fg-secondary">{t('dialog.config.scope', 'Scope')}</span>
        <SegmentedControl<ConfigScope>
          value={scope}
          onChange={setScope}
          className="w-full"
          options={[
            { value: 'local', label: t('dialog.config.local', 'Local (this repository)') },
            { value: 'global', label: t('dialog.config.global', 'Global (all repositories)') },
          ]}
        />
      </div>
      <Field
        label={t('dialog.config.key', 'Key')}
        error={keyInvalid ? t('dialog.config.invalidKey', 'Use a dotted key such as user.name.') : undefined}
        hint={t('dialog.config.keyHint', 'For example user.email, pull.rebase or http.proxy.')}
        required
      >
        <Input
          value={key}
          onChange={(event) => setKey(event.target.value)}
          placeholder="user.email"
          list={listId}
          spellCheck={false}
          autoComplete="off"
          autoFocus
        />
        <datalist id={listId}>
          {KEY_SUGGESTIONS.map((item) => (
            <option key={item} value={item} />
          ))}
        </datalist>
      </Field>
      <Field label={t('dialog.config.value', 'Value')}>
        <Input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="you@example.com"
          spellCheck={false}
        />
      </Field>
      <DialogPreview command={preview} />
    </DialogShell>
  );
}

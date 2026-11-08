/**
 * Raw command console ("advanced"): run `git` with a hand-written argv inside
 * the active repository. The subcommand allowlist mirrors the server; commands
 * that can modify the repository require an explicit confirmation.
 */
import { useEffect, useState } from 'react';
import { Play, Terminal } from 'lucide-react';
import type { ExecInput } from '@gitdeck/shared';
import { useExec } from '@/api/hooks';
import { errorMessage } from '@/api/client';
import { useToast } from '@/components/feedback/toast';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, Input } from '@/components/ui/input';
import { useI18n } from '@/i18n';
import { formatDuration } from '@/lib/format';
import { DialogAlert, DialogOutput, DialogPreview, DialogShell } from './dialog-shell';
import {
  formatCommandArgs,
  isAllowedExecSubcommand,
  isMutatingGitArgs,
  operationOutput,
  parseCommandArgs,
} from './helpers';
import { useCloseDialog, useDialogRepoId } from './use-dialog';

interface ExecResultView {
  command: string;
  stdout: string;
  stderr: string;
  ok: boolean;
  exitCode: number;
  durationMs: number;
}

export function CommandRunDialog(): JSX.Element {
  const { t } = useI18n();
  const toast = useToast();
  const repoId = useDialogRepoId();
  const closeDialog = useCloseDialog();
  const exec = useExec(repoId);

  const [input, setInput] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [result, setResult] = useState<ExecResultView | null>(null);

  // A changed command invalidates the danger acknowledgement and old output.
  useEffect(() => {
    setAcknowledged(false);
    setResult(null);
  }, [input]);

  const parsed = parseCommandArgs(input);
  const args = parsed[0] === 'git' ? parsed.slice(1) : parsed;
  const subcommand = args[0] ?? '';
  const allowed = subcommand.length > 0 && isAllowedExecSubcommand(subcommand);
  const mutating = isMutatingGitArgs(args);
  const preview = args.length > 0 ? formatCommandArgs(args) : 'git';

  const validationError =
    input.trim().length === 0
      ? t('console.runCommandRequired', 'Enter a git command, e.g. log --oneline -5')
      : !allowed
        ? t(
            'console.runCommandNotAllowed',
            '"{subcommand}" is not in the allowed subcommand list.',
            { subcommand: subcommand || '?' },
          )
        : undefined;

  const run = () => {
    if (validationError || !subcommand) return;
    if (mutating && !acknowledged) return;
    exec.mutate(
      { args } satisfies ExecInput,
      {
        onSuccess: (data) => {
          setResult({
            command: data.result.command,
            stdout: data.result.stdout,
            stderr: data.result.stderr,
            ok: data.result.ok,
            exitCode: data.result.exitCode,
            durationMs: data.result.durationMs,
          });
          if (data.result.ok) toast.success(t('console.success', 'Command succeeded'), data.result.command);
          else toast.error(t('console.failed', 'Command failed'), operationOutput(data.result));
        },
        onError: (error) => toast.error(t('toast.failed', 'Operation failed'), errorMessage(error)),
      },
    );
  };

  const output = result ? [result.stderr.trim(), result.stdout.trim()].filter(Boolean).join('\n') : '';

  return (
    <DialogShell
      title={t('dialog.command.title', 'Run Git command')}
      description={t('console.runCommandHint', 'Advanced: runs `git` with the given arguments inside the repository. Commands that modify the repository require explicit confirmation.')}
      size="lg"
      submitLabel={t('console.run', 'Run')}
      submitVariant={mutating ? 'danger' : 'primary'}
      submitDisabled={Boolean(validationError) || (mutating && !acknowledged) || exec.isPending}
      busy={exec.isPending}
      error={exec.error}
      cancelLabel={t('common.close', 'Close')}
      onSubmit={run}
      onClose={closeDialog}
    >
      <Field label={t('dialog.command.args', 'Arguments')} error={validationError} required>
        <Input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={t('console.runCommandPlaceholder', 'e.g. log --oneline -5 (without the leading "git")')}
          spellCheck={false}
          autoComplete="off"
          className="font-mono"
          autoFocus
        />
      </Field>
      <p className="flex items-center gap-1.5 text-2xs text-fg-muted">
        <Terminal className="h-3 w-3" />
        {t('console.allowedHint', 'Allowed subcommands')}: status, log, show, diff, rev-parse, ls-files, branch, tag, stash, fetch, pull, push, merge, rebase, reset, add, commit, checkout, …
      </p>
      {mutating ? (
        <>
          <DialogAlert variant="danger">{t('console.dangerHint', 'This command can modify your repository. Double-check the arguments before running.')}</DialogAlert>
          <Checkbox
            checked={acknowledged}
            onChange={setAcknowledged}
            label={t('console.dangerConfirm', 'I understand this command can modify the repository.')}
          />
        </>
      ) : null}
      <DialogPreview command={preview} danger={mutating} />
      {result ? (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-2xs text-fg-muted">
            <span>{result.ok ? t('console.success', 'Command succeeded') : t('console.failed', 'Command failed')}</span>
            <span>·</span>
            <span>
              {t('console.exitCode', 'Exit code')}: {result.exitCode}
            </span>
            <span>·</span>
            <span>{formatDuration(result.durationMs)}</span>
          </div>
          <DialogOutput command={result.command} output={output} tone={result.ok ? 'default' : 'danger'} maxHeight="max-h-64" />
        </div>
      ) : null}
      <p className="flex items-center gap-1.5 text-2xs text-fg-muted">
        <Play className="h-3 w-3" />
        {t('console.commandLoggedHint', 'Everything you run is appended to the command console.')}
      </p>
    </DialogShell>
  );
}

/**
 * Network dialogs: push, pull and fetch.
 */
import { useState } from 'react';
import type { FetchInput, PullInput, PushInput } from '@gitdeck/shared';
import { useFetch, usePull, usePush, useRemotes, useRepoSummary } from '@/api/hooks';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { SegmentedControl } from '@/components/ui/segmented';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/cn';
import { DialogAlert, DialogPreview, DialogShell } from './dialog-shell';
import { RefField, RemoteSelect } from './fields';
import { failedOutput, gitCommand, isValidRefName, shellQuote } from './helpers';
import { useCloseDialog, useDialogProps, useDialogRepoId } from './use-dialog';
import { useDialogOperation } from './use-dialog-operation';

/* ------------------------------------------------------------------ */
/* Push                                                                */
/* ------------------------------------------------------------------ */

type PushDialogProps = { branch?: string; remote?: string };

export function PushDialog(): JSX.Element {
  const { t } = useI18n();
  const repoId = useDialogRepoId();
  const closeDialog = useCloseDialog();
  const props = useDialogProps<PushDialogProps>();
  const remotes = useRemotes(repoId);
  const summary = useRepoSummary(repoId);
  const push = usePush(repoId);

  const [remote, setRemote] = useState<string | null>(null);
  const [branch, setBranch] = useState<string | null>(null);
  const [upstreamChoice, setUpstreamChoice] = useState<boolean | null>(null);
  const [forceLease, setForceLease] = useState(false);
  const [tags, setTags] = useState(false);

  const summaryData = summary.data;
  const remoteNames = (remotes.data?.remotes ?? summaryData?.remotes ?? []).map((item) => item.name);
  const effectiveRemote = remote ?? props.remote ?? remoteNames[0] ?? '';
  const effectiveBranch = branch ?? props.branch ?? summaryData?.branch ?? '';
  const setUpstream = upstreamChoice ?? !summaryData?.upstream;

  const invalidBranch = effectiveBranch.trim().length > 0 && !isValidRefName(effectiveBranch);
  const disabled = remoteNames.length === 0 || !effectiveRemote || !effectiveBranch.trim() || invalidBranch;

  const preview = gitCommand(
    'push',
    setUpstream && '--set-upstream',
    shellQuote(effectiveRemote || '<remote>'),
    shellQuote(effectiveBranch || '<branch>'),
    forceLease && '--force-with-lease',
    tags && '--tags',
  );

  const operation = useDialogOperation<PushInput>(push, t('toast.pushed', 'Push completed'));

  return (
    <DialogShell
      title={t('dialog.push.title', 'Push')}
      description={t('dialog.push.description', 'Publish "{branch}" to {remote}.', {
        branch: effectiveBranch || '…',
        remote: effectiveRemote || '…',
      })}
      submitLabel={t('dialog.push.confirm', 'Push')}
      submitDisabled={disabled}
      busy={operation.pending}
      error={operation.error}
      failure={failedOutput(operation.result)}
      onSubmit={() =>
        operation.run({
          remote: effectiveRemote,
          branch: effectiveBranch.trim(),
          setUpstream: setUpstream || undefined,
          force: forceLease ? 'with-lease' : 'none',
          tags: tags || undefined,
        })
      }
      onClose={closeDialog}
    >
      {remoteNames.length === 0 ? (
        <DialogAlert variant="warning">
          {t('dialog.push.noRemotes', 'No remotes are configured for this repository. Add a remote first.')}
        </DialogAlert>
      ) : (
        <RemoteSelect
          label={t('dialog.push.remote', 'Remote')}
          value={effectiveRemote}
          onChange={setRemote}
          remotes={remotes.data?.remotes ?? summaryData?.remotes}
        />
      )}
      <RefField
        label={t('dialog.push.branch', 'Branch')}
        value={effectiveBranch}
        onChange={setBranch}
        placeholder={summaryData?.branch ?? 'main'}
        hint={
          summaryData?.upstream
            ? t('dialog.push.upstreamHint', 'Upstream: {upstream}', { upstream: summaryData.upstream })
            : t('dialog.push.noUpstreamHint', 'This branch has no upstream yet. Enable "Set upstream" to publish it.')
        }
        error={invalidBranch ? t('dialog.branch.invalidName', 'Enter a valid Git branch name.') : undefined}
        required
      />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <Checkbox
          checked={setUpstream}
          onChange={setUpstreamChoice}
          label={t('dialog.push.setUpstream', 'Set upstream (-u)')}
        />
        <Checkbox checked={tags} onChange={setTags} label={t('dialog.push.tags', 'Also push tags')} />
        <Checkbox
          checked={forceLease}
          onChange={setForceLease}
          label={t('dialog.push.force', 'Force push (--force-with-lease)')}
        />
      </div>
      {summaryData ? (
        <div className="flex flex-wrap items-center gap-1.5 text-2xs text-fg-muted">
          <span>{t('status.branch', 'branch')}:</span>
          <Badge variant="outline">{summaryData.branch}</Badge>
          {summaryData.ahead > 0 ? (
            <Badge variant="accent">{t('status.ahead', '{count} ahead', { count: summaryData.ahead })}</Badge>
          ) : null}
          {summaryData.behind > 0 ? (
            <Badge variant="warning">{t('status.behind', '{count} behind', { count: summaryData.behind })}</Badge>
          ) : null}
        </div>
      ) : null}
      {forceLease ? (
        <DialogAlert variant="danger">
          {t(
            'dialog.push.forceWarning',
            'Force pushing rewrites the remote branch. --force-with-lease still overwrites commits other people pushed in the meantime.',
          )}
        </DialogAlert>
      ) : null}
      <DialogPreview command={preview} danger={forceLease} />
    </DialogShell>
  );
}

/* ------------------------------------------------------------------ */
/* Pull                                                                */
/* ------------------------------------------------------------------ */

type PullStrategy = 'default' | 'merge' | 'rebase' | 'ff-only';
type PullDialogProps = Record<string, never>;

const PULL_STRATEGIES: { value: PullStrategy; labelKey: string; fallback: string }[] = [
  { value: 'default', labelKey: 'common.default', fallback: 'Default' },
  { value: 'merge', labelKey: 'dialog.pull.merge', fallback: 'Merge' },
  { value: 'rebase', labelKey: 'dialog.pull.rebase', fallback: 'Rebase' },
  { value: 'ff-only', labelKey: 'dialog.pull.ffOnly', fallback: 'Fast-forward only' },
];

export function PullDialog(): JSX.Element {
  const { t } = useI18n();
  const repoId = useDialogRepoId();
  const closeDialog = useCloseDialog();
  const remotes = useRemotes(repoId);
  const summary = useRepoSummary(repoId);
  const pull = usePull(repoId);

  const [remote, setRemote] = useState<string | null>(null);
  const [branch, setBranch] = useState<string | null>(null);
  const [strategy, setStrategy] = useState<PullStrategy>('default');
  const [autostash, setAutostash] = useState(false);

  const summaryData = summary.data;
  const remoteNames = (remotes.data?.remotes ?? summaryData?.remotes ?? []).map((item) => item.name);
  const upstreamRemote = summaryData?.upstream?.includes('/')
    ? summaryData.upstream.slice(0, summaryData.upstream.indexOf('/'))
    : undefined;
  const effectiveRemote = remote ?? upstreamRemote ?? remoteNames[0] ?? '';
  const effectiveBranch = branch ?? summaryData?.branch ?? '';

  const preview = gitCommand(
    'pull',
    strategy === 'rebase' && '--rebase',
    strategy === 'merge' && '--no-rebase',
    strategy === 'ff-only' && '--ff-only',
    autostash && '--autostash',
    shellQuote(effectiveRemote),
    shellQuote(effectiveBranch),
  );

  const operation = useDialogOperation<PullInput>(pull, t('toast.pulled', 'Pull completed'));

  return (
    <DialogShell
      title={t('dialog.pull.title', 'Pull')}
      description={t('dialog.pull.description', 'Fetch and integrate changes from the remote branch.')}
      submitLabel={t('dialog.pull.confirm', 'Pull')}
      busy={operation.pending}
      error={operation.error}
      failure={failedOutput(operation.result)}
      onSubmit={() =>
        operation.run({
          remote: effectiveRemote || undefined,
          branch: effectiveBranch || undefined,
          strategy: strategy === 'default' ? undefined : strategy,
          autostash: autostash || undefined,
        })
      }
      onClose={closeDialog}
    >
      <div className="grid grid-cols-2 gap-3">
        <RemoteSelect
          label={t('dialog.pull.remote', 'Remote')}
          value={effectiveRemote}
          onChange={setRemote}
          remotes={remotes.data?.remotes ?? summaryData?.remotes}
        />
        <RefField
          label={t('dialog.pull.branch', 'Branch')}
          value={effectiveBranch}
          onChange={setBranch}
          placeholder={summaryData?.branch ?? 'main'}
        />
      </div>
      <div>
        <span className="mb-1 block text-xs font-medium text-fg-secondary">{t('dialog.pull.strategy', 'Strategy')}</span>
        <SegmentedControl<PullStrategy>
          value={strategy}
          onChange={setStrategy}
          className="w-full"
          options={PULL_STRATEGIES.map((item) => ({
            value: item.value,
            label: t(item.labelKey, item.fallback),
          }))}
        />
      </div>
      <Checkbox
        checked={autostash}
        onChange={setAutostash}
        label={t('dialog.pull.autostash', 'Autostash local changes')}
      />
      <DialogPreview command={preview} />
    </DialogShell>
  );
}

/* ------------------------------------------------------------------ */
/* Fetch                                                               */
/* ------------------------------------------------------------------ */

type FetchDialogProps = Record<string, never>;
type FetchTarget = 'default' | 'all';

export function FetchDialog(): JSX.Element {
  const { t } = useI18n();
  const repoId = useDialogRepoId();
  const closeDialog = useCloseDialog();
  const remotes = useRemotes(repoId);
  const summary = useRepoSummary(repoId);
  const fetch = useFetch(repoId);

  const [target, setTarget] = useState<FetchTarget>('default');
  const [remote, setRemote] = useState<string | null>(null);
  const [prune, setPrune] = useState(false);

  const remoteNames = (remotes.data?.remotes ?? summary.data?.remotes ?? []).map((item) => item.name);
  const effectiveRemote = remote ?? remoteNames[0] ?? '';
  const all = target === 'all';

  const preview = all
    ? gitCommand('fetch', '--all', prune && '--prune')
    : gitCommand('fetch', shellQuote(effectiveRemote || '<remote>'), prune && '--prune');

  const operation = useDialogOperation<FetchInput>(fetch, t('toast.fetched', 'Fetch completed'));

  return (
    <DialogShell
      title={t('dialog.fetch.title', 'Fetch')}
      description={t('dialog.fetch.description', 'Download remote refs without changing your local branches.')}
      submitLabel={t('dialog.fetch.confirm', 'Fetch')}
      busy={operation.pending}
      error={operation.error}
      failure={failedOutput(operation.result)}
      onSubmit={() =>
        operation.run({
          remote: all ? undefined : effectiveRemote || undefined,
          all: all || undefined,
          prune: prune || undefined,
        })
      }
      onClose={closeDialog}
    >
      <div>
        <span className="mb-1 block text-xs font-medium text-fg-secondary">{t('dialog.fetch.target', 'Fetch from')}</span>
        <SegmentedControl<FetchTarget>
          value={target}
          onChange={setTarget}
          className={cn('w-full', all && 'pointer-events-none opacity-60')}
          options={[
            { value: 'default', label: t('dialog.fetch.oneRemote', 'One remote') },
            { value: 'all', label: t('dialog.fetch.all', 'Fetch all remotes') },
          ]}
        />
      </div>
      {!all ? (
        <RemoteSelect
          label={t('dialog.fetch.remote', 'Remote')}
          value={effectiveRemote}
          onChange={setRemote}
          remotes={remotes.data?.remotes ?? summary.data?.remotes}
        />
      ) : null}
      <Checkbox
        checked={prune}
        onChange={setPrune}
        label={t('dialog.fetch.prune', 'Prune deleted remote branches')}
      />
      <DialogPreview command={preview} />
    </DialogShell>
  );
}

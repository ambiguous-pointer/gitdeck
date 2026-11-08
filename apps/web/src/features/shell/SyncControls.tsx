import { ArrowDown, ArrowDownToLine, ArrowUp, ArrowUpFromLine, CloudOff, RefreshCw } from 'lucide-react';
import { useRepoSummary } from '@/api/hooks';
import { Tooltip } from '@/components/ui/tooltip';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/cn';
import { useAppStore } from '@/stores/app-store';

/**
 * Fetch / pull / push controls plus the ahead-behind sync indicator.
 * Buttons only open the corresponding dialog (owned by the actions branch)
 * with the current branch pre-filled.
 */
export function SyncControls(): JSX.Element | null {
  const { t } = useI18n();
  const activeRepoId = useAppStore((state) => state.activeRepoId);
  const openDialog = useAppStore((state) => state.openDialog);
  const summary = useRepoSummary(activeRepoId);

  if (!activeRepoId || !summary.data) return null;

  const data = summary.data;
  const remote = data.remotes[0]?.name;
  const ahead = data.ahead;
  const behind = data.behind;
  const hasUpstream = Boolean(data.upstream);
  const synced = hasUpstream && ahead === 0 && behind === 0;
  const detached = data.detached;

  const pushProps = { branch: data.branch, remote };
  const buttonClass =
    'flex h-6 items-center gap-1 rounded px-1.5 text-2xs font-medium text-fg-secondary transition-colors hover:bg-hover hover:text-fg disabled:pointer-events-none disabled:opacity-40';

  return (
    <div className="flex items-center gap-1.5">
      <Tooltip label={t('status.synced', 'Up to date')}>
        <button
          type="button"
          disabled={detached}
          onClick={() => {
            if (!hasUpstream) {
              openDialog('push', pushProps);
              return;
            }
            if (behind > 0) {
              openDialog('pull', { remote, branch: data.branch });
              return;
            }
            openDialog('push', pushProps);
          }}
          className={cn(
            'flex h-6 items-center gap-1 rounded border px-1.5 text-2xs font-medium transition-colors',
            !hasUpstream
              ? 'border-warning/40 bg-warning/10 text-warning hover:bg-warning/20'
              : synced
                ? 'border-success/40 bg-success/10 text-success hover:bg-success/20'
                : 'border-border bg-canvas text-fg-secondary hover:bg-hover',
          )}
        >
          {!hasUpstream ? (
            <>
              <CloudOff className="h-3 w-3" />
              {t('status.setUpstream', 'Set upstream')}
            </>
          ) : (
            <>
              <span className="flex items-center">
                <ArrowDown className="h-3 w-3" />
                {behind}
              </span>
              <span className="flex items-center">
                <ArrowUp className="h-3 w-3" />
                {ahead}
              </span>
              {synced ? <span className="ml-0.5">{t('status.synced', 'Up to date')}</span> : null}
            </>
          )}
        </button>
      </Tooltip>

      <div className="flex h-7 items-center overflow-hidden rounded-md border border-border bg-canvas">
        <Tooltip label={t('actions.fetch', 'Fetch')}>
          <button
            type="button"
            onClick={() => openDialog('fetch')}
            disabled={detached}
            className={buttonClass}
            aria-label={t('actions.fetch', 'Fetch')}
          >
            <ArrowDownToLine className="h-3.5 w-3.5 text-fg-muted" />
            <span className="hidden md:inline">{t('actions.fetch', 'Fetch')}</span>
          </button>
        </Tooltip>
        <span className="h-4 w-px bg-border" />
        <Tooltip label={t('actions.pull', 'Pull')}>
          <button
            type="button"
            onClick={() => openDialog('pull', { remote, branch: data.branch })}
            disabled={detached}
            className={buttonClass}
            aria-label={t('actions.pull', 'Pull')}
          >
            <RefreshCw className="h-3.5 w-3.5 text-fg-muted" />
            <span className="hidden md:inline">{t('actions.pull', 'Pull')}</span>
            {behind > 0 ? (
              <span className="rounded bg-warning/20 px-1 text-2xs text-warning">{behind}</span>
            ) : null}
          </button>
        </Tooltip>
        <span className="h-4 w-px bg-border" />
        <Tooltip label={t('actions.push', 'Push')}>
          <button
            type="button"
            onClick={() => openDialog('push', pushProps)}
            disabled={detached}
            className={buttonClass}
            aria-label={t('actions.push', 'Push')}
          >
            <ArrowUpFromLine className="h-3.5 w-3.5 text-fg-muted" />
            <span className="hidden md:inline">{t('actions.push', 'Push')}</span>
            {ahead > 0 ? (
              <span className="rounded bg-accent-soft px-1 text-2xs text-accent">{ahead}</span>
            ) : null}
          </button>
        </Tooltip>
      </div>
    </div>
  );
}

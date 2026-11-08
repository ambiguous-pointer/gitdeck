/**
 * Command console: every git command GitDeck executed, with status, duration,
 * relative time, expandable stdout/stderr and copy helpers. The bottom
 * "run command" row opens the advanced command dialog.
 */
import { useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  ChevronRight,
  Copy,
  Terminal,
  TerminalSquare,
  Trash2,
  XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/cn';
import { formatDateTime, formatDuration, formatRelativeTime } from '@/lib/format';
import { copyText } from '@/features/dialogs/helpers';
import { useAppStore } from '@/stores/app-store';

export function CommandLogPanel(): JSX.Element {
  const { t, locale } = useI18n();
  const entries = useAppStore((state) => state.commandLog);
  const clear = useAppStore((state) => state.clearCommandLog);
  const openDialog = useAppStore((state) => state.openDialog);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const failedCount = useMemo(() => entries.filter((entry) => !entry.ok).length, [entries]);

  const copy = async (id: string, text: string) => {
    if (await copyText(text)) {
      setCopiedId(id);
      window.setTimeout(() => setCopiedId((current) => (current === id ? null : current)), 1_500);
    }
  };

  const runCommand = () => openDialog('command-run');

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-7 shrink-0 items-center gap-2 border-b border-border-subtle px-2">
        <TerminalSquare className="h-3.5 w-3.5 text-fg-muted" />
        <span className="text-2xs text-fg-muted">
          {t('console.commandCount', '{count} commands', { count: entries.length })}
        </span>
        {failedCount > 0 ? (
          <Badge variant="danger">
            {t('console.failedCount', '{count} failed', { count: failedCount })}
          </Badge>
        ) : null}
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="xs" onClick={runCommand} icon={<Terminal className="h-3 w-3" />}>
            {t('console.runCommand', 'Run a Git command')}
          </Button>
          <Button
            variant="ghost"
            size="xs"
            onClick={clear}
            disabled={entries.length === 0}
            icon={<Trash2 className="h-3 w-3" />}
          >
            {t('console.clear', 'Clear console')}
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
        {entries.length === 0 ? (
          <EmptyState
            compact
            icon={<Terminal className="h-7 w-7" />}
            title={t('console.empty', 'No commands yet')}
            description={t(
              'console.emptyHint',
              'Every Git operation GitDeck runs appears here with its full command and output.',
            )}
            action={
              <Button variant="secondary" size="sm" onClick={runCommand} icon={<Terminal className="h-3.5 w-3.5" />}>
                {t('console.runCommand', 'Run a Git command')}
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-border-subtle">
            {entries.map((entry) => {
              const expanded = expandedId === entry.id;
              const timestamp = new Date(entry.timestamp).toISOString();
              const absoluteTime = formatDateTime(timestamp, locale);
              return (
                <li key={entry.id} className={cn(expanded && 'bg-surface')}>
                  <div className="group/entry flex h-7 items-center gap-1.5 px-2 transition-colors hover:bg-hover">
                    <button
                      type="button"
                      onClick={() => setExpandedId(expanded ? null : entry.id)}
                      className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                      aria-expanded={expanded}
                    >
                      <ChevronRight
                        className={cn('h-3 w-3 shrink-0 text-fg-muted transition-transform', expanded && 'rotate-90')}
                      />
                      {entry.ok ? (
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 shrink-0 text-danger" />
                      )}
                      <code
                        className={cn(
                          'min-w-0 flex-1 truncate font-mono text-xs',
                          entry.ok ? 'text-fg-secondary' : 'text-danger',
                        )}
                        title={entry.command}
                      >
                        {entry.command}
                      </code>
                      <span className="hidden shrink-0 font-mono text-2xs text-fg-muted sm:inline">
                        {formatDuration(entry.durationMs)}
                      </span>
                      <span className="shrink-0 text-2xs text-fg-muted" title={absoluteTime}>
                        {formatRelativeTime(timestamp, locale)}
                      </span>
                    </button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="opacity-0 transition-opacity group-hover/entry:opacity-100 focus-visible:opacity-100"
                      onClick={() => void copy(`${entry.id}-command`, entry.command)}
                      title={t('console.copyCommand', 'Copy command')}
                      aria-label={t('console.copyCommand', 'Copy command')}
                    >
                      {copiedId === `${entry.id}-command` ? (
                        <Check className="h-3 w-3 text-success" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </div>

                  {expanded ? (
                    <div className="border-t border-border-subtle bg-canvas px-2 py-1.5">
                      <div className="mb-1 flex items-center gap-2 text-2xs text-fg-muted">
                        <Badge variant={entry.ok ? 'success' : 'danger'}>
                          {t('console.exitCode', 'Exit code')}: {entry.exitCode}
                        </Badge>
                        <span>{formatDuration(entry.durationMs)}</span>
                        <span>·</span>
                        <span>{absoluteTime}</span>
                        {entry.repoId ? (
                          <code className="ml-auto truncate font-mono text-2xs text-fg-muted">{entry.repoId.slice(0, 8)}</code>
                        ) : null}
                        <Button
                          variant="ghost"
                          size="xs"
                          className="shrink-0"
                          onClick={() => void copy(`${entry.id}-output`, entry.output)}
                          icon={
                            copiedId === `${entry.id}-output` ? (
                              <Check className="h-3 w-3 text-success" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )
                          }
                        >
                          {t('console.copyOutput', 'Copy output')}
                        </Button>
                      </div>
                      <pre
                        className={cn(
                          'max-h-44 overflow-auto whitespace-pre-wrap break-all rounded border border-border bg-canvas p-2 font-mono text-2xs leading-5',
                          entry.ok ? 'text-fg-secondary' : 'text-danger',
                        )}
                      >
                        {entry.output || t('console.noOutput', '(no output)')}
                      </pre>
                    </div>
                  ) : null}
                </li>
              );
            })}
            <li>
              <button
                type="button"
                onClick={runCommand}
                className="flex w-full items-center justify-center gap-1.5 border-t border-dashed border-border px-2 py-1.5 text-2xs text-fg-muted transition-colors hover:bg-hover hover:text-fg"
              >
                <Terminal className="h-3 w-3" />
                {t('console.runCommand', 'Run a Git command')}
              </button>
            </li>
          </ul>
        )}
      </div>
    </div>
  );
}

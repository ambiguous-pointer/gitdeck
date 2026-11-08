import { CheckCircle2, Terminal, Trash2, XCircle } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/cn';
import { formatDuration, formatRelativeTime } from '@/lib/format';
import { useAppStore } from '@/stores/app-store';

/** Live log of every Git command GitDeck executed (command + output). */
export function CommandLogPanel(): JSX.Element {
  const { t, locale } = useI18n();
  const entries = useAppStore((state) => state.commandLog);
  const clear = useAppStore((state) => state.clearCommandLog);
  const [expanded, setExpanded] = useState<string | null>(entries[0]?.id ?? null);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-7 shrink-0 items-center gap-2 border-b border-border-subtle px-2 text-2xs text-fg-muted">
        <Terminal className="h-3.5 w-3.5" />
        <span>{t('console.commandCount', '{count} commands', { count: entries.length })}</span>
        <Button variant="ghost" size="xs" className="ml-auto" onClick={clear} disabled={entries.length === 0}>
          <Trash2 className="h-3 w-3" /> {t('console.clear', 'Clear console')}
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
        {entries.length === 0 ? (
          <EmptyState compact icon={<Terminal className="h-7 w-7" />} title={t('console.empty', 'No commands yet')} description={t('console.emptyHint', '')} />
        ) : (
          <ul className="divide-y divide-border-subtle">
            {entries.map((entry) => (
              <li key={entry.id} className="px-2 py-1">
                <button
                  type="button"
                  onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
                  className="flex w-full items-center gap-2 text-left"
                >
                  {entry.ok ? (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 shrink-0 text-danger" />
                  )}
                  <code className="min-w-0 flex-1 truncate font-mono text-xs text-fg-secondary">{entry.command}</code>
                  <span className="shrink-0 text-2xs text-fg-muted">{formatDuration(entry.durationMs)}</span>
                  <span className="shrink-0 text-2xs text-fg-muted">{formatRelativeTime(new Date(entry.timestamp).toISOString(), locale)}</span>
                </button>
                {expanded === entry.id ? (
                  <pre
                    className={cn(
                      'mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded border border-border bg-canvas p-2 font-mono text-2xs leading-5',
                      entry.ok ? 'text-fg-muted' : 'text-danger',
                    )}
                  >
                    {entry.output || t('console.output', 'Output') + ': —'}
                  </pre>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/**
 * Banner shown above the working-tree groups while a merge / rebase /
 * cherry-pick / revert / bisect is in progress.
 */
import { AlertTriangle } from 'lucide-react';
import type { RepoOperation } from '@gitdeck/shared';
import { Badge } from '@/components/ui/badge';
import { useI18n } from '@/i18n';

const OPERATION_LABEL_KEYS: Record<RepoOperation['state'], { key: string; fallback: string }> = {
  merging: { key: 'status.merging', fallback: 'Merging' },
  rebasing: { key: 'status.rebasing', fallback: 'Rebasing' },
  'cherry-picking': { key: 'status.cherryPicking', fallback: 'Cherry-picking' },
  reverting: { key: 'status.reverting', fallback: 'Reverting' },
  bisecting: { key: 'status.bisecting', fallback: 'Bisecting' },
};

export function OperationBanner({ operation }: { operation?: RepoOperation }): JSX.Element | null {
  const { t } = useI18n();
  if (!operation) return null;

  const label = OPERATION_LABEL_KEYS[operation.state] ?? OPERATION_LABEL_KEYS.merging;
  const conflicts = operation.conflictCount ?? 0;

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-warning/30 bg-warning/10 px-2 py-1 text-2xs">
      <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warning" />
      <span className="font-medium text-warning">{t(label.key, label.fallback)}</span>
      {operation.details ? (
        <span className="min-w-0 truncate font-mono text-fg-muted">{operation.details}</span>
      ) : null}
      {conflicts > 0 ? (
        <Badge variant="danger" className="ml-auto">
          {t('status.conflicts', '{count} conflicts', { count: conflicts })}
        </Badge>
      ) : (
        <span className="ml-auto text-fg-muted">
          {t('changes.operationHint', 'Finish the operation by committing the result.')}
        </span>
      )}
    </div>
  );
}

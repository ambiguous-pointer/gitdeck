import { FileDiff as FileDiffIcon } from 'lucide-react';
import { useDiff } from '@/api/hooks';
import { EmptyState } from '@/components/ui/empty-state';
import { Modal } from '@/components/ui/modal';
import { Spinner } from '@/components/ui/spinner';
import { useI18n } from '@/i18n';
import { useAppStore } from '@/stores/app-store';

/** Full screen diff overlay, driven by `useAppStore().diffTarget`. */
export function DiffOverlay(): JSX.Element | null {
  const { t } = useI18n();
  const activeRepoId = useAppStore((state) => state.activeRepoId);
  const diffTarget = useAppStore((state) => state.diffTarget);
  const closeDiff = useAppStore((state) => state.closeDiff);
  const diff = useDiff(activeRepoId, diffTarget ? { scope: diffTarget.scope, from: diffTarget.from, to: diffTarget.to, path: diffTarget.path } : null);

  if (!diffTarget) return null;

  return (
    <Modal
      open
      onClose={closeDiff}
      size="xl"
      title={diffTarget.title ?? diffTarget.path ?? t('diff.title', 'Diff')}
      description={diffTarget.scope === 'staged' ? t('changes.staged', 'Staged changes') : t('changes.unstaged', 'Changes')}
    >
      {diff.isLoading ? (
        <div className="flex justify-center p-10">
          <Spinner />
        </div>
      ) : (diff.data?.files.length ?? 0) === 0 ? (
        <EmptyState icon={<FileDiffIcon className="h-8 w-8" />} title={t('diff.noChanges', 'No changes to show.')} />
      ) : (
        <div className="space-y-4">
          {diff.data!.files.map((file) => (
            <div key={file.path} className="overflow-hidden rounded border border-border">
              <div className="flex items-center gap-2 border-b border-border bg-canvas px-2 py-1 font-mono text-xs text-fg-secondary">
                <span className="truncate">{file.path}</span>
                {file.binary ? <span className="ml-auto text-2xs text-fg-muted">{t('diff.binary', 'Binary file')}</span> : null}
              </div>
              <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap p-2 font-mono text-xs leading-5">
                {file.hunks.map((hunk) => (
                  <span key={hunk.header}>
                    <span className="block bg-accent-soft px-1 text-accent">{hunk.header}</span>
                    {hunk.lines.map((line, index) => (
                      <span
                        key={index}
                        className={
                          line.type === 'add'
                            ? 'block bg-diff-add-bg text-diff-add'
                            : line.type === 'del'
                              ? 'block bg-diff-del-bg text-diff-del'
                              : 'block text-fg-muted'
                        }
                      >
                        {line.content}
                      </span>
                    ))}
                  </span>
                ))}
              </pre>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

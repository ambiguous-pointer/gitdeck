/**
 * Collapsible file tree shared by the diff sidebar, the changes panel and the
 * commit details.
 *
 * The tree structure itself is built by `@gitdeck/shared` (`buildFileTree`) so
 * the web app and the server agree on how paths are grouped.
 */
import { ChevronDown, ChevronRight, Folder, FolderOpen } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { buildFileTree, collectFolderPaths, type FileTreeEntry, type FileTreeNode } from '@gitdeck/shared';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/cn';
import { fileStatusMeta } from '@/lib/palette';

export interface FileTreeProps {
  /** Flat list of changed files (paths are normalized internally). */
  entries: FileTreeEntry[];
  /** Path of the currently selected file. */
  selectedPath?: string | null;
  /** Called when a file row is activated. */
  onSelect?: (entry: FileTreeEntry) => void;
  /** Custom content of a file row (defaults to status letter + name). */
  renderLeaf?: (entry: FileTreeEntry, depth: number) => ReactNode;
  /** Extra controls rendered at the end of a file row (stage / discard …). */
  leafActions?: (entry: FileTreeEntry) => ReactNode;
  /** Expand every folder on first render. */
  defaultExpanded?: boolean;
  className?: string;
  emptyState?: ReactNode;
}

interface FileTreeViewProps extends Omit<FileTreeProps, 'entries'> {
  nodes: FileTreeNode[];
  expanded: Set<string>;
  toggleFolder: (path: string) => void;
  depth: number;
}

function FileTreeView({
  nodes,
  expanded,
  toggleFolder,
  selectedPath,
  onSelect,
  renderLeaf,
  leafActions,
  depth,
}: FileTreeViewProps): JSX.Element {
  const { t } = useI18n();

  return (
    <>
      {nodes.map((node) => {
        if (node.kind === 'folder') {
          const isExpanded = expanded.has(node.path);
          return (
            <div key={node.path}>
              <button
                type="button"
                onClick={() => toggleFolder(node.path)}
                title={node.path}
                aria-expanded={isExpanded}
                className="flex h-6 w-full items-center gap-1 rounded pr-1 text-left text-xs text-fg-secondary transition-colors hover:bg-hover hover:text-fg"
                style={{ paddingLeft: `${depth * 10 + 4}px` }}
              >
                {isExpanded ? (
                  <ChevronDown className="h-3 w-3 shrink-0 text-fg-muted" />
                ) : (
                  <ChevronRight className="h-3 w-3 shrink-0 text-fg-muted" />
                )}
                {isExpanded ? (
                  <FolderOpen className="h-3.5 w-3.5 shrink-0 text-accent/80" />
                ) : (
                  <Folder className="h-3.5 w-3.5 shrink-0 text-accent/80" />
                )}
                <span className="min-w-0 flex-1 truncate">{node.name}</span>
              </button>
              {isExpanded ? (
                <FileTreeView
                  nodes={node.children}
                  expanded={expanded}
                  toggleFolder={toggleFolder}
                  selectedPath={selectedPath}
                  onSelect={onSelect}
                  renderLeaf={renderLeaf}
                  leafActions={leafActions}
                  depth={depth + 1}
                />
              ) : null}
            </div>
          );
        }

        const entry = node.entry;
        if (!entry) return null;
        const active = selectedPath === entry.path || selectedPath === node.path;
        const meta = fileStatusMeta(entry.status ?? 'modified');

        return (
          <div
            key={node.path}
            className={cn(
              'group/tree-row flex h-6 items-center gap-1 rounded pr-1 transition-colors',
              active ? 'bg-accent-soft' : 'hover:bg-hover',
            )}
          >
            <button
              type="button"
              onClick={() => onSelect?.(entry)}
              title={node.path}
              className="flex h-6 min-w-0 flex-1 items-center gap-1 text-left"
              style={{ paddingLeft: `${depth * 10 + 4}px` }}
              aria-label={t('tree.selectFile', 'Select {path}', { path: node.path })}
            >
              {renderLeaf ? (
                renderLeaf(entry, depth)
              ) : (
                <>
                  <span
                    className={cn(
                      'w-3 shrink-0 text-center font-mono text-2xs font-semibold',
                      meta.className,
                    )}
                  >
                    {meta.letter}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs text-fg-secondary">{node.name}</span>
                </>
              )}
            </button>
            {leafActions ? (
              <span className="flex shrink-0 items-center gap-0.5">{leafActions(entry)}</span>
            ) : null}
          </div>
        );
      })}
    </>
  );
}

export function FileTree({
  entries,
  selectedPath,
  onSelect,
  renderLeaf,
  leafActions,
  defaultExpanded = true,
  className,
  emptyState,
}: FileTreeProps): JSX.Element {
  const nodes = useMemo(() => buildFileTree(entries), [entries]);
  const allFolders = useMemo(() => collectFolderPaths(nodes), [nodes]);

  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(defaultExpanded ? allFolders : []));

  // Keep the expansion state in sync when the file list changes.
  const [knownFolders, setKnownFolders] = useState(allFolders.join('|'));
  if (knownFolders !== allFolders.join('|')) {
    setKnownFolders(allFolders.join('|'));
    setExpanded((current) => {
      const next = new Set<string>();
      for (const path of allFolders) if (current.has(path)) next.add(path);
      if (defaultExpanded) for (const path of allFolders) next.add(path);
      return next;
    });
  }

  const toggleFolder = (path: string): void => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  if (nodes.length === 0) {
    return <>{emptyState ?? null}</>;
  }

  return (
    <div className={cn('min-h-0 overflow-y-auto scrollbar-thin py-1', className)}>
      <FileTreeView
        nodes={nodes}
        expanded={expanded}
        toggleFolder={toggleFolder}
        selectedPath={selectedPath ?? null}
        onSelect={onSelect}
        renderLeaf={renderLeaf}
        leafActions={leafActions}
        depth={0}
      />
    </div>
  );
}

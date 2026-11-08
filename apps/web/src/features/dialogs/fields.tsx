/**
 * Reusable form fields for the operation dialogs: an input with a datalist of
 * known refs, a remote picker and a recent-commit multi-select used by
 * cherry-pick / revert.
 */
import { GitCommitHorizontal, Plus } from 'lucide-react';
import { useId, useState } from 'react';
import type { Branch, Commit, Remote } from '@gitdeck/shared';
import { useRepoLog } from '@/api/hooks';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/cn';
import { formatCommitDate } from '@/lib/format';
import { isValidCommitRef } from './helpers';

/* ------------------------------------------------------------------ */
/* Ref input (input + datalist)                                        */
/* ------------------------------------------------------------------ */

export interface RefFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options?: string[];
  placeholder?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  autoFocus?: boolean;
  className?: string;
}

export function RefField({
  label,
  value,
  onChange,
  options = [],
  placeholder,
  hint,
  error,
  required,
  autoFocus,
  className,
}: RefFieldProps): JSX.Element {
  const listId = useId();
  return (
    <Field label={label} hint={hint} error={error} required={required} className={className}>
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        list={options.length > 0 ? listId : undefined}
        invalid={Boolean(error)}
        autoFocus={autoFocus}
        spellCheck={false}
        autoComplete="off"
      />
      {options.length > 0 ? (
        <datalist id={listId}>
          {options.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
      ) : null}
    </Field>
  );
}

/** Convenience: branch names for a datalist, locals first then remotes. */
export function branchNames(branches: Branch[] | undefined): string[] {
  return (branches ?? []).map((branch) => branch.name);
}

/* ------------------------------------------------------------------ */
/* Remote select                                                       */
/* ------------------------------------------------------------------ */

export interface RemoteSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  remotes: Remote[] | undefined;
  /** Extra leading option, e.g. "All remotes". */
  leading?: { value: string; label: string };
  hint?: string;
  disabled?: boolean;
  className?: string;
}

export function RemoteSelect({
  label,
  value,
  onChange,
  remotes,
  leading,
  hint,
  disabled,
  className,
}: RemoteSelectProps): JSX.Element {
  const { t } = useI18n();
  const options = [
    ...(leading ? [leading] : []),
    ...(remotes ?? []).map((remote) => ({ value: remote.name, label: remote.name })),
  ];
  return (
    <Field label={label} hint={hint} className={className}>
      <Select
        value={value}
        onChange={onChange}
        options={options}
        placeholder={t('common.none', 'None')}
        disabled={disabled || options.length === 0}
        aria-label={label}
      />
    </Field>
  );
}

/* ------------------------------------------------------------------ */
/* Commit multi-select                                                 */
/* ------------------------------------------------------------------ */

export interface CommitPickerProps {
  repoId: string | null;
  value: string[];
  onChange: (next: string[]) => void;
  label?: string;
  hint?: string;
  error?: string;
}

/** Select commits from recent history and/or add hashes manually. */
export function CommitPicker({ repoId, value, onChange, label, hint, error }: CommitPickerProps): JSX.Element {
  const { t, locale } = useI18n();
  const log = useRepoLog(repoId, { limit: 30, all: true }, Boolean(repoId));
  const [manual, setManual] = useState('');

  const commits: Commit[] = log.data?.commits ?? [];

  const toggle = (hash: string) => {
    onChange(value.includes(hash) ? value.filter((item) => item !== hash) : [...value, hash]);
  };

  const addManual = () => {
    const next = manual
      .split(/[\s,]+/)
      .map((token) => token.trim())
      .filter((token) => token.length > 0 && isValidCommitRef(token));
    if (next.length === 0) return;
    onChange([...value, ...next.filter((hash) => !value.includes(hash))]);
    setManual('');
  };

  return (
    <Field label={label ?? t('commit.title', 'Commit details')} hint={hint} error={error}>
      <div className="overflow-hidden rounded-md border border-border">
        {value.length > 0 ? (
          <div className="flex flex-wrap gap-1 border-b border-border-subtle bg-surface p-1.5">
            {value.map((hash) => (
              <Badge key={hash} variant="accent" className="font-mono">
                {hash.length > 12 ? `${hash.slice(0, 10)}…` : hash}
                <button
                  type="button"
                  className="ml-0.5 text-accent/80 hover:text-accent"
                  onClick={() => onChange(value.filter((item) => item !== hash))}
                  aria-label={t('common.remove', 'Remove')}
                >
                  ×
                </button>
              </Badge>
            ))}
          </div>
        ) : null}
        <div className="flex items-center gap-1 border-b border-border-subtle bg-canvas p-1">
          <Input
            value={manual}
            onChange={(event) => setManual(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                addManual();
              }
            }}
            placeholder={t('dialog.cherryPick.manualHint', 'Paste a commit hash and press Enter')}
            className="h-7 flex-1 border-0 bg-transparent text-xs focus:ring-0"
            spellCheck={false}
          />
          <Button variant="ghost" size="icon-sm" onClick={addManual} disabled={!manual.trim()} aria-label={t('common.add', 'Add')}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="max-h-44 overflow-y-auto scrollbar-thin">
          {log.isPending ? (
            <p className="px-2 py-3 text-center text-2xs text-fg-muted">{t('common.loading', 'Loading…')}</p>
          ) : commits.length === 0 ? (
            <p className="px-2 py-3 text-center text-2xs text-fg-muted">
              {t('dialog.cherryPick.noCommits', 'No commits found in this repository yet.')}
            </p>
          ) : (
            commits.map((commit) => {
              const checked = value.includes(commit.hash);
              return (
                <div
                  key={commit.hash}
                  role="button"
                  tabIndex={0}
                  onClick={() => toggle(commit.hash)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      toggle(commit.hash);
                    }
                  }}
                  className={cn(
                    'flex cursor-pointer items-center gap-2 px-2 py-1 transition-colors hover:bg-hover',
                    checked && 'bg-accent-soft/60',
                  )}
                >
                  <span onClick={(event) => event.stopPropagation()}>
                    <Checkbox checked={checked} onChange={() => toggle(commit.hash)} />
                  </span>
                  <GitCommitHorizontal className="h-3 w-3 shrink-0 text-fg-muted" />
                  <code className="shrink-0 font-mono text-2xs text-fg-muted">{commit.shortHash}</code>
                  <span className="min-w-0 flex-1 truncate text-xs text-fg-secondary">{commit.subject}</span>
                  <span className="shrink-0 text-2xs text-fg-muted">{formatCommitDate(commit.author.date, locale)}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </Field>
  );
}

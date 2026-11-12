# GitDeck — Engineering Contracts

> Read this before writing code. It is the single interface agreement between the
> backend, the three web feature branches and the Lead. Do **not** change shared
> contracts unilaterally — message the Lead instead.

## 1. Product

GitDeck is a production-grade, cross-platform **web Git GUI** (Windows + Linux):
commit graph, commit details, staging, diffs, merge / rebase / cherry-pick /
reset / revert, tags, stashes, remotes, upstream tracking, git config (identity,
proxy), worktree management with **auto discovery**, and a transparent command
console that shows the exact `git` command and output of every operation.

- Monorepo: pnpm workspaces + TypeScript strict.
- `apps/server` — Express 5 REST API wrapping the `git` CLI.
- `apps/web` — React 18 + Vite 5 + Tailwind 3 + TanStack Query + zustand.
- `packages/shared` — **single source of truth**: types, zod request schemas,
  route builders, graph layout algorithm.
- Language: zh-CN + en-US, runtime switchable, persisted in `localStorage`.
- Theme: dark (default) + light + custom accent color, persisted in
  `localStorage` (`gitdeck.theme` → `{ mode, accent }`).

## 2. Commands & ports

| Command | Purpose |
| --- | --- |
| `pnpm install` | install workspace deps |
| `pnpm dev` | build shared, start API (`:4319`) + web (`:5188`, `/api` proxied) |
| `pnpm build` | build shared + server (tsup) + web (vite build) |
| `pnpm typecheck` | build shared then `tsc --noEmit` in every package |
| `pnpm test` | vitest in every package |
| `pnpm seed` | create/refresh `.demo/gitdeck-demo` + bare remote + worktree |
| `pnpm check:i18n` | scan `t('key', 'fallback')` usage, report missing zh/en keys |

Dev URL: `http://127.0.0.1:5188`. API: `http://127.0.0.1:4319/api/health`.
The Lead owns the only running dev server — feature branches must verify with
`typecheck` + `vite build`, not by starting another server on these ports.

## 3. File ownership (strict — do not edit files outside your scope)

| Owner | Branch | Worktree | Writes |
| --- | --- | --- | --- |
| Lead | `main` | repo root | root configs, `packages/shared/**`, `apps/server/src/config.ts`, `apps/server/src/app.ts`, `apps/server/src/index.ts`, `apps/server/package.json`, `apps/server/tsconfig.json`, `apps/server/tsup.config.ts`, `apps/web` bootstrap (vite/tailwind/tsconfig/index.html), `apps/web/src/{main.tsx,App.tsx,lib/**,api/**,stores/**,providers/**,styles/**,theme/ThemeProvider.tsx,i18n/index.tsx,i18n/dict.*.ts,components/ui/**,components/feedback/**}`, docs, scripts, integration fixes |
| backend | `feat/backend-engine` | `.worktrees/backend` | `apps/server/src/**` **except** `config.ts`, `app.ts` infrastructure (may extend app.ts carefully; keep `createApp` signature), `apps/server/src/test/**` |
| web-core | `feat/web-core` | `.worktrees/core` | `apps/web/src/features/shell/**`, `apps/web/src/features/graph/**`, `apps/web/src/features/welcome/**`, `apps/web/src/features/command-palette/**` |
| web-actions | `feat/web-actions` | `.worktrees/actions` | `apps/web/src/features/changes/**`, `apps/web/src/features/console/**`, `apps/web/src/features/dialogs/**`, `apps/web/src/features/diff/**`, `apps/web/src/features/bottom/**` |
| design-system | `feat/design-system` | `.worktrees/design` | `apps/web/src/components/ui/**`, `apps/web/src/components/feedback/toast.tsx`, `apps/web/src/i18n/**`, `apps/web/src/styles/**`, `apps/web/src/theme/**`, `apps/web/src/features/settings/**` |

Rules:

- **No new dependencies** (no lockfile edits). Ask the Lead if truly needed.
- **Do not edit** `i18n/dict.zh.ts` / `i18n/dict.en.ts` (except design-system).
  Everyone else: call `t('your.new.key', 'English fallback')`. The Lead
  reconciles missing translations after merging (`pnpm check:i18n`).
- Shared data-fetching lives in `apps/web/src/api/hooks.ts`; UI state in
  `apps/web/src/stores/app-store.ts`. If something is missing, message the Lead.
- Commit to your feature branch frequently with conventional messages. Finish
  with `git add -A && git commit -m "feat(...): ..."` and report the commit hash.
- The Lead merges branches into `main` and runs the real browser verification.

## 4. API contract

Base path `/api`. All endpoints are in `packages/shared/src/api.ts` (`apiRoutes`)
and validated by `packages/shared/src/schemas.ts` (zod). Errors use
`{ error: { code, message, details? } }` with `ApiErrorCode`.

Mutation responses are `OperationResult`: `{ result: CommandResult, summary?: RepoSummary }`
where `CommandResult = { command, cwd, stdout, stderr, exitCode, durationMs, ok }`.
`command` must be the shell-safe display string (`git status --porcelain`), used
by the console panel.

| Method & path | Request body / query | Response |
| --- | --- | --- |
| `GET /health` | — | `{ status, app: GitVersionInfo, settings?: AppSettings }` |
| `GET /home` | — | `{ app: GitVersionInfo, settings: AppSettings, repos: RepoRecord[] }` |
| `GET /repos` | — | `{ repos: RepoRecord[] }` |
| `POST /repos/open` | `{ path }` | `OpenRepoResult` = `{ repo, summary }` |
| `DELETE /repos/:id` | — | `{ ok: true }` |
| `POST /repos/scan` | `{ roots?, maxDepth? }` | `ScanResult` |
| `GET /repos/:id/summary` | — | `RepoSummary` |
| `GET /repos/:id/status` | — | `RepoStatus` |
| `GET /repos/:id/log` | `limit, skip, all, branch, path, search` | `CommitLog` |
| `GET /repos/:id/commits/:hash` | — | `CommitDetail` |
| `GET /repos/:id/commits/:hash/diff` | `path?` | `{ files: FileDiff[] }` |
| `GET /repos/:id/diff` | `scope=worktree\|staged\|commit\|range, path?, from?, to?, context? (0..1000, default 3)` | `{ files: FileDiff[] }` |
| `POST /repos/:id/stage` | `{ paths, all? }` | `OperationResult` |
| `POST /repos/:id/unstage` | `{ paths, all? }` | `OperationResult` |
| `POST /repos/:id/discard` | `{ paths, untracked? }` | `OperationResult` |
| `POST /repos/:id/commit` | `{ message, amend?, signoff?, noVerify?, stageAll?, author? }` | `OperationResult` |
| `POST /repos/:id/resolve` | `{ paths, resolution: 'ours'\|'theirs'\|'mark-resolved' }` | `OperationResult` |
| `GET /repos/:id/branches` | — | `{ branches: Branch[] }` |
| `POST /repos/:id/branch/checkout` | `{ target, detach?, force? }` | `OperationResult` |
| `POST /repos/:id/branch/create` | `{ name, startPoint?, checkout? }` | `OperationResult` |
| `POST /repos/:id/branch/rename` | `{ from, to }` | `OperationResult` |
| `POST /repos/:id/branch/delete` | `{ name, force?, remote? }` | `OperationResult` |
| `POST /repos/:id/branch/merge` | `{ branch, noFf?, squash?, message? }` | `OperationResult` |
| `POST /repos/:id/branch/rebase` | `{ onto, autostash? }` | `OperationResult` |
| `POST /repos/:id/branch/cherry-pick` | `{ commits: string[] }` | `OperationResult` |
| `POST /repos/:id/branch/revert` | `{ commits: string[], noCommit? }` | `OperationResult` |
| `POST /repos/:id/branch/reset` | `{ target, mode: 'soft'\|'mixed'\|'hard' }` | `OperationResult` |
| `POST /repos/:id/branch/upstream` | `{ branch, remote?: string\|null, remoteBranch?: string\|null }` | `OperationResult` |
| `POST /repos/:id/fetch` | `{ remote?, prune?, all? }` | `OperationResult` |
| `POST /repos/:id/pull` | `{ remote?, branch?, strategy?, autostash? }` | `OperationResult` |
| `POST /repos/:id/push` | `{ remote?, branch?, setUpstream?, force?, tags? }` | `OperationResult` |
| `GET /repos/:id/remotes` | — | `{ remotes: Remote[] }` |
| `POST /repos/:id/remotes/add` | `{ name, url, pushUrl? }` | `OperationResult` |
| `POST /repos/:id/remotes/update` | `{ name, newName?, url?, pushUrl? }` | `OperationResult` |
| `POST /repos/:id/remotes/remove` | `{ name }` | `OperationResult` |
| `GET /repos/:id/tags` | — | `{ tags: Tag[] }` |
| `POST /repos/:id/tags` | `{ name, message?, target?, push?, remote? }` | `OperationResult` |
| `POST /repos/:id/tags/delete` | `{ name, remote? }` | `OperationResult` |
| `GET /repos/:id/stashes` | — | `{ stashes: Stash[] }` |
| `POST /repos/:id/stashes` | `{ message?, includeUntracked?, keepIndex? }` | `OperationResult` |
| `POST /repos/:id/stashes/apply` | `{ index }` | `OperationResult` |
| `POST /repos/:id/stashes/pop` | `{ index }` | `OperationResult` |
| `POST /repos/:id/stashes/drop` | `{ index }` | `OperationResult` |
| `GET /repos/:id/stashes/:index/show` | — | `{ result: CommandResult, diff: FileDiff[] }` |
| `GET /repos/:id/worktrees` | — | `{ worktrees: Worktree[] }` |
| `POST /repos/:id/worktrees/add` | `{ path, branch?, newBranch?, detach?, startPoint?, force? }` | `OperationResult` |
| `POST /repos/:id/worktrees/remove` | `{ path, force? }` | `OperationResult` |
| `POST /repos/:id/worktrees/prune` | `{}` | `OperationResult` |
| `POST /repos/:id/worktrees/lock` | `{ path, lock, reason? }` | `OperationResult` |
| `GET /repos/:id/config` | `scope=all\|local\|global` | `{ entries: ConfigEntry[] }` |
| `POST /repos/:id/config/set` | `{ scope: 'local'\|'global', key, value }` | `OperationResult` |
| `POST /repos/:id/config/unset` | `{ scope, key }` | `OperationResult` |
| `GET /settings` | — | `AppSettings` |
| `PATCH /settings` | partial `AppSettings` | `AppSettings` |
| `GET /repos/:id/reflog` | `limit?` | `{ result: CommandResult, commits: Commit[] }` |
| `POST /repos/:id/exec` | `{ args: string[] }` | `OperationResult` (allowlist: `EXEC_ALLOWED_SUBCOMMANDS`) |

Server implementation requirements (backend branch):

- `spawn`/`execFile` with **args arrays**, never a shell string; `GIT_TERMINAL_PROMPT=0`,
  `LC_ALL=C` (stable parsing), timeout, capped output, UTF-8.
- Repo ids are server-generated (`sha1(path)` style); keep an allowlist map in
  `dataDir/repos.json`, reject requests with unknown ids.
- Persist data in `dataDir` (`config.dataDir`): `repos.json`, `settings.json`.
  Auto-open `.demo/gitdeck-demo` when no repos are known and it exists.
- Status via `git status --porcelain=v2 --branch -z`; log via NUL-separated
  `--pretty`; refs via `git for-each-ref`; worktrees via `git worktree list --porcelain`.
- Detect operation state (MERGE_HEAD, rebase-merge/apply, CHERRY_PICK_HEAD,
  REVERT_HEAD, BISECT_LOG) into `RepoSummary.operation` / `RepoStatus.operation`.
- Scan: bounded recursion (depth ≤ 8, skip `node_modules`, `dist`, `.git`,
  hidden dirs), detect both normal repos (`.git` dir) and worktrees (`.git` file),
  return `ScannedRepo.kind`.
- Keep `createApp(options)` and `config` exports intact; the web bundle is
  served statically when `apps/web/dist/index.html` exists.
- Tests: vitest + supertest against temporary repos created with the real `git`
  binary; cover status/log/stage/commit/diff/branches/tags/stash/worktrees/scan/config.
  `pnpm --filter @gitdeck/server test` must pass; keep tests cross-platform.

### 4.1 Diff endpoints — unified payload contract

The server always returns a **unified** diff. The side-by-side ("split") layout
is derived **client-side** from this payload (`packages/shared/src/diff.ts`), so
there is no `layout`/`mode` request parameter and the REST response shape must
not change for split rendering.

| Method & path | Query | Response |
| --- | --- | --- |
| `GET /repos/:id/diff` | `scope=worktree\|staged\|commit\|range`, `path?`, `from?`, `to?`, `context?` | `{ files: FileDiff[] }` |
| `GET /repos/:id/commits/:hash/diff` | `path?` | `{ files: FileDiff[] }` |
| `GET /repos/:id/stashes/:index/show` | — | `{ result: CommandResult, diff: FileDiff[] }` |

- `scope=worktree` — unstaged changes (`git diff`). An untracked file is
  synthesised as an all-`add` diff when `path` is given.
- `scope=staged` — index vs `HEAD` (`git diff --cached`).
- `scope=commit` — requires `from` (commit-ish; first-parent diff for merges).
- `scope=range` — requires `from`; `to` defaults to `HEAD`.
- `context` — unchanged lines around each hunk (`git -U<n>`), integer **0..1000**,
  default **3**. It is validated with zod for **every** scope (out-of-range or
  non-integer → `400 VALIDATION_ERROR`) and clamped defensively before reaching
  `git`.
- `path` — repository-relative file filter; passed to git after `--` so paths can
  never be interpreted as options.

Frozen payload shape:

```ts
interface FileDiff {
  path: string;
  oldPath?: string;
  status: FileStatus; // added | modified | deleted | renamed | copied |
  //                     untracked | conflicted | typechange | ignored
  binary: boolean;
  hunks: { header: string; lines: DiffLine[] }[]; // header: "@@ -a,b +c,d @@ ..."
  imageBefore?: string; // data: URL, binary image diffs only
  imageAfter?: string; // data: URL, binary image diffs only
}

interface DiffLine {
  type: 'context' | 'add' | 'del';
  content: string; // line text without the leading ' ', '+' or '-' marker
  oldLine?: number; // 1-based line in the old file (context/del lines)
  newLine?: number; // 1-based line in the new file (context/add lines)
}
```

Numbering rules the web client relies on: within a hunk `oldLine`/`newLine`
continue from the hunk header start numbers; `context` lines carry both,
`add` lines only `newLine`, `del` lines only `oldLine`. Files are ordered as git
emits them; hunks are ordered within the file. `binary: true` implies
`hunks: []`.

Payload guard: when a single file's diff exceeds ~1 MiB
(`MAX_FILE_DIFF_BYTES`) or the combined payload exceeds ~8 MiB
(`MAX_TOTAL_DIFF_BYTES`), that entry is returned **metadata-only** — `path`,
`status`, `binary` and `oldPath` preserved, `hunks: []`, image data URLs omitted —
so the file list still renders and the UI degrades gracefully. Files are never
dropped and no extra fields are added.

## 5. Web contracts

### 5.1 Data layer

Use only `apps/web/src/api/hooks.ts` + `apiRoutes` from shared. Key hooks:
`useHomeQuery`, `useReposQuery`, `useOpenRepo`, `useCloseRepo`, `useScanRepos`,
`useRepoSummary`, `useRepoStatus`, `useRepoLog`, `useBranches`, `useRemotes`,
`useTags`, `useStashes`, `useWorktrees`, `useCommitDetail`, `useDiff`,
`useStashShow`, `useConfig`, `useServerSettings`, `useUpdateSettings`,
`useStage`, `useUnstage`, `useDiscard`, `useCommit`, `useResolveConflicts`,
`useCheckout`, `useCreateBranch`, `useRenameBranch`, `useDeleteBranch`,
`useMerge`, `useRebase`, `useCherryPick`, `useRevert`, `useReset`,
`useSetUpstream`, `useFetch`, `usePull`, `usePush`, `useAddRemote`,
`useUpdateRemote`, `useRemoveRemote`, `useCreateTag`, `useDeleteTag`,
`useCreateStash`, `useApplyStash`, `usePopStash`, `useDropStash`,
`useAddWorktree`, `useRemoveWorktree`, `usePruneWorktrees`, `useLockWorktree`,
`useConfigSet`, `useConfigUnset`, `useExec`.

All repo mutations invalidate `qk.repoAll(repoId)` automatically and append the
command to the console log.

### 5.2 UI state (`stores/app-store.ts`)

`activeRepoId`, `filters {search, allBranches}`, `selectedCommitHash`,
`bottomPanelOpen`, `bottomTab ('changes'|'console')`, `detailsWidth`,
`sidebarSections`, `dialog { id, props }`, `openDialog(id, props)`, `closeDialog`,
`diffTarget`, `openDiff(target)`, `closeDiff`, `commandLog`, `logCommand`,
`clearCommandLog`, `commandPaletteOpen`.

Dialog ids and their `props` (used with `openDialog`):

| id | props |
| --- | --- |
| `merge` | `{ branch?: string }` |
| `rebase` | `{ onto?: string }` |
| `cherry-pick` | `{ commits?: string[] }` |
| `revert` | `{ commits?: string[] }` |
| `reset` | `{ target?: string }` |
| `checkout` | `{ target?: string }` |
| `branch-create` | `{ startPoint?: string }` |
| `branch-delete` | `{ name: string }` |
| `branch-rename` | `{ name: string }` |
| `tag-create` | `{ target?: string }` |
| `tag-delete` | `{ name: string }` |
| `push` | `{ branch?: string; remote?: string }` |
| `pull` / `fetch` | `{}` |
| `stash-create` | `{}` |
| `stash-view` | `{ index: number }` |
| `worktree-add` | `{ branch?: string }` |
| `worktree-remove` | `{ path: string }` |
| `remote-add` / `remote-edit` / `remote-remove` | `{}` / `{ name }` / `{ name }` |
| `config-set` | `{ key?: string; scope?: 'local'\|'global' }` |
| `add-repo` | `{}` |
| `command-run` | `{}` |
| `confirm` | `{ title, description?, confirmLabel?, danger?, onConfirm: () => void }` |
| `settings` | `{}` |

`DialogHost` (actions) renders one modal per id and calls `closeDialog()` after
success. A generic `confirm` dialog must be supported for destructive actions.

Toasts: `const toast = useToast(); toast.success(title, description?)`,
`toast.error(...)`, `toast.info(...)`, `toast.warning(...)`.

### 5.3 Styling

Only semantic Tailwind tokens: `bg-canvas|surface|elevated|overlay|hover|active`,
`text-fg`, `text-fg-secondary`, `text-fg-muted`, `border-border[-strong|-subtle]`,
`bg-accent`, `text-accent`, `bg-accent-soft`, `text-success|warning|danger|info`,
`bg-diff-add-bg`, `text-diff-add`, `text-diff-del`, graph lane colors only via
`graphColorVar()/graphColorHex()` from `lib/palette.ts` (CSS vars `--graph-1..10`).
No hard-coded hex colors in components (except inline style for computed accent /
lane colors). Must look correct in **both** dark and light themes and with a
custom accent color. No external fonts/images/CDNs — everything must work offline.
Use `lucide-react` icons. Dense desktop-app rhythm (row height ~28px, 12–13px text).

### 5.4 i18n

`const { t, locale, setLocale, toggleLocale } = useI18n();`
`t('key', 'English fallback', { count: 3 })`. Use keys from
`i18n/dict.en.ts` when available. Never hard-code visible Chinese/English text
without `t()`. Both languages must render correctly (design-system finalizes the
zh dictionary; everyone else uses fallbacks).

### 5.5 Feature behaviours (acceptance criteria)

**web-core**

- Top bar: repo switcher (open/add/scan/close + recent repos), branch selector
  (checkout/create from menu), fetch/pull/push buttons (dialogs), theme toggle,
  language toggle, settings button, command palette (⌘/Ctrl+K).
- Left sidebar: sections Branches (local/remote, current highlighted, ahead/behind),
  Remotes, Tags, Stashes, Worktrees; counts; right-click context menus:
  checkout, create branch, rename, delete, merge into current, rebase on,
  push, set/unset upstream, copy names; worktree open/remove/lock; stash
  apply/pop/drop/view; tag push/delete.
- Graph: rows with SVG lanes from `layoutGraph()` (shared) — continuous curves,
  merge and converge links, colored per lane, ref pills (local/remote/tag/HEAD),
  columns Graph | Description | Date | Author | Commit, selected row, row height
  constant, windowed rendering for large histories, right-click commit menu
  exactly like the reference screenshots: Add Tag, Create Branch, Checkout,
  Cherry Pick, Revert, Drop, Merge into current branch, Rebase current branch on
  this Commit, Reset current branch to this Commit, Copy Commit Hash/Subject/
  Message. Keyboard ↑/↓ selection, search filter, all-branches toggle, refresh,
  loading/empty/error states.
- Commit details panel: resizable width, avatar + author + date + email, tags/
  branches pills, hash with copy, message, stats (+/−), file list with status
  letters and per-file additions/deletions, click file → diff overlay, "open on
  remote host" when the remote URL can be turned into an https URL.
- Welcome screen: open path, scan folders (uses settings scan roots), recent
  repositories, feature highlights.
- Command palette: filterable actions that open dialogs / toggle theme/language/
  panel / select repo.
- Status bar: branch, upstream, ahead/behind, operation state (merging/rebasing/
  conflicts), change counts, worktree count.

**web-actions**

- Changes panel: staged / unstaged / untracked / conflicts groups, per-file
  stage/unstage/discard with confirm, stage-all/unstage-all, click file → diff,
  commit composer with message (Ctrl+Enter), amend, signoff, commit-and-push,
  conflicts resolution (keep ours / theirs / mark resolved). Dirty → toasts.
- Diff overlay: unified diff with colored add/del/context lines, hunk headers,
  file header with stats, split/unified toggle (unified sufficient), binary and
  image placeholders, staged/worktree/commit/range scopes, copy path.
- Console: every command with status icon, duration, timestamp, expandable
  stdout/stderr, copy, clear, and a "run command" entry (advanced) using
  `useExec` with a confirm for mutating commands.
- Bottom dock: tabs Changes/Console with badge counts and collapse.
- Dialogs: merge (branch, no-ff, squash, message), rebase (onto, autostash,
  warning), cherry-pick (selected commits), revert, reset (target + soft/mixed/
  hard + warning), checkout (target, detach, force), branch create/delete/rename,
  tag create/delete, push (remote/branch/upstream/force/tags/state), pull
  (remote/branch/strategy/autostash), fetch (remote/prune/all), stash create/view,
  worktree add/remove, remote add/edit/remove, config set, add repository, run
  command, generic confirm. Every dialog shows the exact command preview before
  executing (derived from request), disables submit while pending, shows server
  git errors (stderr) in a readable way, closes + toast on success and refreshes.

**design-system**

- UI kit (`components/ui/**`) polished and accessible: Button, Input/Textarea/
  Field/Label, Select, Checkbox, Switch, Modal (focus trap, esc, backdrop),
  ContextMenu/MenuButton (keyboard nav, separators, danger items, shortcuts),
  Tooltip, Badge, Tabs, SegmentedControl, Avatar, Spinner, Skeleton, EmptyState,
  Kbd/Shortcut, Toast (stacking, variants). Keep the existing export APIs used by
  other features — additive changes only.
- i18n: keep provider API stable; complete zh dictionary (`dict.zh.ts`) for all
  keys in `dict.en.ts` + any new keys you add. Add keys only for your own scope;
  the Lead reconciles other branches' keys.
- Theme: `styles/theme.css` refined dark/light palettes (tasteful, high contrast,
  desktop density), custom accent applied via `ThemeProvider` (API stable),
  accent presets in settings, smooth transitions, scrollbars, focus states.
- Settings dialog (screenshot 5 style): tabs General / Appearance / Repositories /
  Git / About. Appearance: theme (dark/light/system), accent preset swatches +
  custom color picker + preview, language. Repositories: scan roots list
  (add/remove), scan button showing discovered repos/worktrees (`useScanRepos`),
  open discovered repos, data dir. Git: user identity (name/email, local/global
  via `useConfigSet`), proxies (`http.proxy`/`https.proxy`), default editor maybe.
  About: app/git/node versions + links. Save via `useUpdateSettings`, toasts.
  Must be fully responsive within the modal and work in both themes.
- Also refine global layout visuals shared by other features only via tokens/CSS
  (do not edit other features' files).

## 6. Definition of done (per branch)

1. `pnpm --filter @gitdeck/web typecheck` (or server equivalent) passes.
2. `pnpm --filter @gitdeck/web build` succeeds (or server build).
3. `pnpm --filter <pkg> test` passes where tests exist.
4. No `console.log` left; no new dependencies; no edits outside the owned scope.
5. All work committed on the feature branch; report back to the Lead:
   commit hash, files, what works, what is stubbed, verification commands + result,
   and any contract change requests.

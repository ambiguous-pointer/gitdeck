#!/usr/bin/env node
/**
 * Seed a realistic demo repository for GitDeck:
 *   .demo/gitdeck-demo          working repository (multi-branch history, tags, stashes, dirty tree)
 *   .demo/remotes/gitdeck-demo.git  bare "origin" so fetch/pull/push work fully offline
 *   .demo/gitdeck-demo-wt       linked worktree on branch feat/worktree-scan
 *
 * Idempotent: skips when the demo repo already exists unless `--force` is passed.
 * Cross-platform: pure Node + git CLI, no shell.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const demoRoot = path.join(root, '.demo');
const repoDir = path.join(demoRoot, 'gitdeck-demo');
const remoteDir = path.join(demoRoot, 'remotes', 'gitdeck-demo.git');
const worktreeDir = path.join(demoRoot, 'gitdeck-demo-wt');
const force = process.argv.includes('--force');

const log = (message) => console.log(`[seed] ${message}`);

function run(cwd, args, env = {}, { allowFail = false } = {}) {
  const result = spawnSync('git', args, {
    cwd,
    env: { ...process.env, ...env, GIT_TERMINAL_PROMPT: '0' },
    encoding: 'utf8',
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && !allowFail) {
    console.error(`git ${args.join(' ')} failed in ${cwd}\n${result.stderr || ''}`);
    process.exit(1);
  }
  return result;
}

function rmrf(target) {
  fs.rmSync(target, { recursive: true, force: true });
}

if (force) {
  log('--force: removing previous demo');
  rmrf(demoRoot);
}

if (fs.existsSync(path.join(repoDir, '.git'))) {
  log(`demo already exists at ${path.relative(root, repoDir)} (use "pnpm seed -- --force" to recreate)`);
  process.exit(0);
}

fs.mkdirSync(path.join(demoRoot, 'remotes'), { recursive: true });

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

const BASE_DATE = new Date('2026-07-06T09:12:00+08:00').getTime();
let tick = 0;
const nextDate = (minutes = 47) => {
  tick += minutes;
  return new Date(BASE_DATE + tick * 60_000).toISOString();
};

function writeFiles(files) {
  for (const [relative, content] of Object.entries(files)) {
    const target = path.join(repoDir, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, 'utf8');
  }
}

const AUTHORS = [
  { name: 'Comrade Yi', email: 'comrade.yi@gitdeck.dev' },
  { name: '陆雨', email: 'luyu@gitdeck.dev' },
  { name: 'Acorn Chen', email: 'acorn.chen@gitdeck.dev' },
  { name: 'dependabot[bot]', email: 'bot@users.noreply.github.com' },
];

function commit(message, files, authorIndex = 0, date = nextDate()) {
  writeFiles(files);
  run(repoDir, ['add', '-A']);
  const author = AUTHORS[authorIndex % AUTHORS.length];
  run(repoDir, ['commit', '-m', message], {
    GIT_AUTHOR_NAME: author.name,
    GIT_AUTHOR_EMAIL: author.email,
    GIT_COMMITTER_NAME: author.name,
    GIT_COMMITTER_EMAIL: author.email,
    GIT_AUTHOR_DATE: date,
    GIT_COMMITTER_DATE: date,
  });
}

/* ------------------------------------------------------------------ */
/* create repositories                                                 */
/* ------------------------------------------------------------------ */

log('creating bare origin');
run(demoRoot, ['init', '--bare', '-b', 'main', remoteDir]);

log('creating working repository');
fs.mkdirSync(repoDir, { recursive: true });
run(repoDir, ['init', '-b', 'main']);
run(repoDir, ['config', 'user.name', 'GitDeck Demo']);
run(repoDir, ['config', 'user.email', 'demo@gitdeck.dev']);
run(repoDir, ['remote', 'add', 'origin', remoteDir]);
run(repoDir, ['config', 'core.autocrlf', 'false']);

/* ------------------------------------------------------------------ */
/* main history                                                        */
/* ------------------------------------------------------------------ */

commit('chore: initialize GitDeck monorepo', {
  'README.md': '# GitDeck Demo\n\nA demo repository for the GitDeck web UI.\n',
  'package.json': '{\n  "name": "gitdeck-demo",\n  "private": true,\n  "version": "0.1.0"\n}\n',
  '.gitignore': 'node_modules/\ndist/\n*.log\n',
});

commit(
  'feat(graph): render commit lanes with stable colors',
  {
    'apps/ui/package.json': '{\n  "name": "@demo/ui",\n  "version": "0.1.0"\n}\n',
    'apps/ui/src/graph/lanes.ts': `export interface Lane {\n  color: number;\n  expected: string;\n}\n\nexport function laneColor(index: number): number {\n  return index % 10;\n}\n`,
    'apps/ui/src/graph/render.ts': `import { laneColor } from './lanes';\n\nexport function renderLane(index: number): string {\n  return 'graph-' + laneColor(index);\n}\n`,
  },
  0,
  nextDate(63),
);

commit(
  'feat(graph): add svg path builder for merge curves',
  {
    'apps/ui/src/graph/paths.ts': `export function mergePath(fromLane: number, toLane: number): string {\n  const x1 = fromLane * 14;\n  const x2 = toLane * 14;\n  return 'M ' + x1 + ' 11 C ' + x1 + ' 18, ' + x2 + ' 15, ' + x2 + ' 22';\n}\n`,
  },
  0,
  nextDate(55),
);

commit(
  'feat(api): expose repository status endpoint',
  {
    'apps/server/src/status.ts': `export interface RepoStatus {\n  branch: string;\n  ahead: number;\n  behind: number;\n  clean: boolean;\n}\n\nexport function summarize(status: string): RepoStatus {\n  return { branch: 'main', ahead: 0, behind: 0, clean: status.trim().length === 0 };\n}\n`,
  },
  1,
  nextDate(41),
);

commit(
  'chore(deps): bump vite from 5.3.1 to 5.4.11',
  {
    'package.json': '{\n  "name": "gitdeck-demo",\n  "private": true,\n  "version": "0.1.0",\n  "devDependencies": {\n    "vite": "5.4.11"\n  }\n}\n',
  },
  3,
  nextDate(37),
);

/* feature/architecture — merged into main later */
run(repoDir, ['checkout', '-b', 'feature/architecture']);
commit(
  'feat(architecture): introduce repository store',
  {
    'apps/server/src/store/repos.ts': `import fs from 'node:fs';\n\nexport interface RepoRecord {\n  id: string;\n  path: string;\n}\n\nexport function loadRepos(file: string): RepoRecord[] {\n  if (!fs.existsSync(file)) return [];\n  return JSON.parse(fs.readFileSync(file, 'utf8'));\n}\n`,
  },
  0,
  nextDate(29),
);
commit(
  'feat(architecture): add command execution service',
  {
    'apps/server/src/git/exec.ts': `import { spawn } from 'node:child_process';\n\nexport interface CommandResult {\n  stdout: string;\n  stderr: string;\n  exitCode: number;\n}\n\nexport function runGit(cwd: string, args: string[]): Promise<CommandResult> {\n  return new Promise((resolve) => {\n    const child = spawn('git', args, { cwd });\n    let stdout = '';\n    let stderr = '';\n    child.stdout.on('data', (chunk) => (stdout += chunk));\n    child.stderr.on('data', (chunk) => (stderr += chunk));\n    child.on('close', (code) => resolve({ stdout, stderr, exitCode: code ?? 0 }));\n  });\n}\n`,
  },
  0,
  nextDate(33),
);
commit(
  'test(architecture): cover repo store persistence',
  {
    'apps/server/src/store/repos.test.ts': `import { describe, expect, it } from 'vitest';\n\ndescribe('repo store', () => {\n  it('is testable', () => {\n    expect(true).toBe(true);\n  });\n});\n`,
  },
  2,
  nextDate(26),
);
run(repoDir, ['checkout', 'main']);
const mergeDate = nextDate(21);
run(repoDir, ['merge', '--no-ff', 'feature/architecture', '-m', 'merge: feature/architecture into main'], {
  GIT_AUTHOR_NAME: AUTHORS[0].name,
  GIT_AUTHOR_EMAIL: AUTHORS[0].email,
  GIT_COMMITTER_NAME: AUTHORS[0].name,
  GIT_COMMITTER_EMAIL: AUTHORS[0].email,
  GIT_AUTHOR_DATE: mergeDate,
  GIT_COMMITTER_DATE: mergeDate,
});

/* feat/web-graph — merged into main */
run(repoDir, ['checkout', '-b', 'feat/web-graph']);
commit(
  'feat(web): virtualize commit list for large histories',
  {
    'apps/ui/src/graph/virtual-list.ts': `export function visibleRange(scrollTop: number, rowHeight: number, viewport: number): [number, number] {\n  const start = Math.floor(scrollTop / rowHeight);\n  const count = Math.ceil(viewport / rowHeight);\n  return [start, start + count];\n}\n`,
  },
  1,
  nextDate(23),
);
commit(
  'feat(web): add commit search and branch filter',
  {
    'apps/ui/src/graph/filter.ts': `export function matches(subject: string, query: string): boolean {\n  return subject.toLowerCase().includes(query.toLowerCase());\n}\n`,
  },
  1,
  nextDate(19),
);
run(repoDir, ['checkout', 'main']);
const mergeDate2 = nextDate(17);
run(repoDir, ['merge', '--no-ff', 'feat/web-graph', '-m', 'merge: feat/web-graph into main'], {
  GIT_AUTHOR_NAME: AUTHORS[1].name,
  GIT_AUTHOR_EMAIL: AUTHORS[1].email,
  GIT_COMMITTER_NAME: AUTHORS[1].name,
  GIT_COMMITTER_EMAIL: AUTHORS[1].email,
  GIT_AUTHOR_DATE: mergeDate2,
  GIT_COMMITTER_DATE: mergeDate2,
});

/* tag on main */
const tagDate = nextDate(11);
run(repoDir, ['tag', '-a', 'v1.0.0', '-m', 'GitDeck demo v1.0.0'], {
  GIT_COMMITTER_DATE: tagDate,
});

/* fix/diff-rendering — unmerged branch */
run(repoDir, ['checkout', '-b', 'fix/diff-rendering']);
commit(
  'fix(diff): preserve trailing newline in hunks',
  {
    'apps/ui/src/diff/parse.ts': `export interface Hunk {\n  header: string;\n  lines: string[];\n}\n\nexport function parseHunk(input: string): Hunk {\n  const [header, ...lines] = input.split('\\n');\n  return { header: header ?? '', lines };\n}\n`,
  },
  0,
  nextDate(13),
);
commit(
  'fix(diff): render context lines with original numbers',
  {
    'apps/ui/src/diff/numbering.ts': `export function originalLine(index: number, offset: number): number {\n  return index + offset;\n}\n`,
  },
  2,
  nextDate(9),
);

/* feat/server-engine — unmerged branch */
run(repoDir, ['checkout', 'main']);
run(repoDir, ['checkout', '-b', 'feat/server-engine']);
commit(
  'feat(server): add worktree manager endpoints',
  {
    'apps/server/src/worktree.ts': `export interface WorktreeInfo {\n  path: string;\n  branch?: string;\n  bare: boolean;\n}\n`,
  },
  0,
  nextDate(15),
);
commit(
  'feat(server): scan directories for repositories',
  {
    'apps/server/src/scan.ts': `import fs from 'node:fs';\nimport path from 'node:path';\n\nexport function looksLikeRepo(dir: string): boolean {\n  return fs.existsSync(path.join(dir, '.git'));\n}\n`,
  },
  1,
  nextDate(12),
);
commit(
  'feat(server): expose git config endpoints',
  {
    'apps/server/src/config.ts': `export type ConfigScope = 'local' | 'global' | 'system';\n\nexport interface ConfigEntry {\n  key: string;\n  value: string;\n  scope: ConfigScope;\n}\n`,
  },
  1,
  nextDate(8),
);

/* release/1.2 — unmerged branch from main */
run(repoDir, ['checkout', 'main']);
run(repoDir, ['checkout', '-b', 'release/1.2']);
commit(
  'chore(release): prepare 1.2.0 changelog',
  {
    'docs/CHANGELOG.md': '# Changelog\n\n## 1.2.0\n\n- Commit graph with stable lane colors\n- Worktree discovery\n- Command console\n',
  },
  2,
  nextDate(7),
);
run(repoDir, ['tag', 'v1.2.0']);
run(repoDir, ['checkout', 'main']);
run(repoDir, ['tag', 'v1.1.0']);

/* more main history for a taller graph */
commit(
  'docs: document worktree workflow',
  {
    'docs/worktrees.md': '# Worktrees\n\nRun `pnpm seed` then open the demo repository in GitDeck.\n',
  },
  1,
  nextDate(6),
);
commit(
  'perf(web): debounce commit search input',
  {
    'apps/ui/src/hooks/useDebounced.ts': `export function useDebounced<T>(value: T, delay = 200): T {\n  void delay;\n  return value;\n}\n`,
  },
  0,
  nextDate(5),
);
commit(
  'chore(deps): bump postcss from 8.4.40 to 8.4.49',
  {
    'package.json': '{\n  "name": "gitdeck-demo",\n  "private": true,\n  "version": "0.1.0",\n  "devDependencies": {\n    "vite": "5.4.11",\n    "postcss": "8.4.49"\n  }\n}\n',
  },
  3,
  nextDate(4),
);
commit(
  'feat(ui): add toast notifications',
  {
    'apps/ui/src/components/toast.tsx': `export function toast(message: string): void {\n  window.dispatchEvent(new CustomEvent('gitdeck:toast', { detail: message }));\n}\n`,
  },
  0,
  nextDate(5),
);

/* ------------------------------------------------------------------ */
/* stashes (must happen on a clean-ish tree)                           */
/* ------------------------------------------------------------------ */

writeFiles({
  'apps/ui/src/graph/lanes.ts': `export interface Lane {\n  color: number;\n  expected: string;\n  label?: string;\n}\n\nexport function laneColor(index: number): number {\n  return index % 10;\n}\n`,
});
run(repoDir, ['stash', 'push', '-m', 'WIP: lane labels for branch pills']);
writeFiles({
  'apps/ui/src/graph/render.ts': `import { laneColor } from './lanes';\n\nexport function renderLane(index: number): string {\n  return 'lane-' + laneColor(index);\n}\n`,
});
run(repoDir, ['stash', 'push', '-m', 'WIP: rename render helper']);

/* ------------------------------------------------------------------ */
/* worktree on its own branch                                          */
/* ------------------------------------------------------------------ */

log('creating linked worktree');
run(repoDir, ['worktree', 'add', '-b', 'feat/worktree-scan', worktreeDir]);
fs.mkdirSync(path.join(worktreeDir, 'docs'), { recursive: true });
fs.writeFileSync(
  path.join(worktreeDir, 'docs', 'worktree-scan.md'),
  '# Worktree auto-scan\n\nGitDeck discovers repositories and linked worktrees from the configured scan roots.\n',
  'utf8',
);
run(worktreeDir, ['add', '-A']);
run(
  worktreeDir,
  ['commit', '-m', 'feat(worktree): auto discover linked worktrees'],
  {
    GIT_AUTHOR_NAME: AUTHORS[0].name,
    GIT_AUTHOR_EMAIL: AUTHORS[0].email,
    GIT_COMMITTER_NAME: AUTHORS[0].name,
    GIT_COMMITTER_EMAIL: AUTHORS[0].email,
    GIT_AUTHOR_DATE: nextDate(9),
    GIT_COMMITTER_DATE: nextDate(9),
  },
);

/* ------------------------------------------------------------------ */
/* publish everything to origin                                        */
/* ------------------------------------------------------------------ */

log('pushing branches and tags to origin');
run(repoDir, ['push', '-u', 'origin', 'main']);
run(repoDir, ['push', '--tags', 'origin']);
for (const branch of ['feature/architecture', 'feat/web-graph', 'feat/server-engine', 'fix/diff-rendering', 'release/1.2']) {
  run(repoDir, ['push', '-u', 'origin', branch], {}, { allowFail: true });
}
run(worktreeDir, ['push', '-u', 'origin', 'feat/worktree-scan'], {}, { allowFail: true });

/* ------------------------------------------------------------------ */
/* leave a realistic dirty working tree for the changes panel          */
/* ------------------------------------------------------------------ */

fs.writeFileSync(
  path.join(repoDir, 'README.md'),
  '# GitDeck Demo\n\nA demo repository for the GitDeck web UI.\n\n## Getting started\n\n1. Run `pnpm seed`\n2. Open the demo repository in GitDeck\n3. Try staging, committing, merging and rebasing\n',
  'utf8',
);
fs.writeFileSync(
  path.join(repoDir, 'apps', 'ui', 'src', 'graph', 'colors.ts'),
  `export const LANE_COLORS = [\n  '#5b8def',\n  '#e5a33c',\n  '#a78bfa',\n  '#4ade80',\n  '#f472b6',\n];\n`,
  'utf8',
);
fs.writeFileSync(
  path.join(repoDir, 'apps', 'ui', 'src', 'graph', 'README.md'),
  '# Graph module\n\nLane layout and SVG rendering helpers.\n',
  'utf8',
);
run(repoDir, ['add', 'apps/ui/src/graph/colors.ts']);

log('done');
log(`repo:      ${path.relative(root, repoDir)}`);
log(`remote:    ${path.relative(root, remoteDir)}`);
log(`worktree:  ${path.relative(root, worktreeDir)}  (branch feat/worktree-scan)`);
log('working tree intentionally dirty: 1 staged, 1 modified, 1 untracked, 2 stashes');

# Single-file build (Node SEA)

GitDeck can be packaged as **one self-contained executable** using Node.js'
[Single Executable Application](https://nodejs.org/api/single-executable-applications.html)
support. The executable embeds:

- the Express API server **and every npm dependency** (esbuild/tsup bundle),
- the built React web app (HTML/CSS/JS served from SEA assets),
- the Node.js runtime itself (the official `node` binary of the **build machine**).

The result is a single file (~90–120 MB, runtime-dominated) that serves the API
and the web UI on one port. It is **not fully static**: it still calls the real
`git` CLI on the target machine, and the embedded Node binary is platform/arch
specific.

## Requirements

Build machine:

- **Node.js ≥ 20.12** (22 or 24 recommended; the same binary is embedded in the
  output, so use the Node version you want to ship),
- **pnpm** (the repo uses `pnpm@12.15.0`),
- **git**, and network access for `pnpm install`,
- enough disk space: `node_modules` + Node binary + staging (~1–2 GB).

Target machine:

- same OS/arch as the build machine (Linux → ELF, Windows → .exe; no cross-build),
- **a `git` executable on `PATH`** (GitDeck drives the real git CLI),
- glibc-based Linux for the official Node binary (for Alpine/musl, build with a
  musl Node.js binary),
- a writable data directory (default `~/.gitdeck`, override with `GITDECK_HOME`).

## Build (Linux → ELF)

Run **on the target Linux machine** (or a matching container/VM):

```bash
# 1. get the source onto the Linux machine
#    (git clone, scp of the repo, whatever fits your workflow)

# 2. install dependencies once
pnpm install

# 3. build the single executable
pnpm build:sea

# output:
#   build/sea/gitdeck        ~100-120 MB ELF  (Node 24 embedded)
```

Run it:

```bash
GITDECK_HOME=~/.gitdeck PORT=4319 ./build/sea/gitdeck
# open http://127.0.0.1:4319
```

## Options

```bash
pnpm build:sea -- --help
```

| Option | Description |
| --- | --- |
| `--out <file>` | copy the finished executable to `<file>` (also kept in `build/sea/`) |
| `--skip-build` | skip `pnpm build` (reuse `apps/web/dist` and the previous bundle) |
| `--code-cache` | enable the V8 code cache (slightly faster startup, bigger blob) |
| `--minify` | minify the server bundle |
| `--with-sourcemaps` | embed the web sourcemaps (bigger binary) |
| `--keep` | keep intermediate artifacts (blob, `sea-config.json`, staged assets) |

## How it works

1. `pnpm build` builds `packages/shared`, `apps/server/dist` and `apps/web/dist`.
2. `apps/server/tsup.sea.config.ts` bundles the server into **one CJS file** with
   all npm dependencies inlined (`noExternal: [/.*/]`).
3. The build script copies `apps/web/dist` and the root `package.json` into
   `build/sea/` and generates `sea-config.json` with those files as SEA assets
   (`web/index.html`, `web/assets/…`, `app/package.json`).
4. `node --experimental-sea-config` produces a blob.
5. The build script copies the running `node` binary and injects the blob with
   [`postject`](https://github.com/nodejs/postject) (`NODE_SEA_BLOB` +
   `NODE_SEA_FUSE_…`).
6. At startup, `node:sea` reports `isSea() === true`; the server then serves the
   embedded web assets (`apps/server/src/sea-assets.ts`) instead of reading from
   disk, and reads its version from the embedded `package.json`.

The build script cleans the intermediate blob/config/assets afterwards; only
`build/sea/gitdeck` remains.

## Notes & troubleshooting

- **`pnpm install` is required before building** — the script needs the
  `postject` dev dependency and the workspace `node_modules`.
- **Cross-compilation is not supported**: build on the platform you ship to.
  The embedded Node binary and `postject` container formats are platform
  specific.
- **Windows**: the injected `.exe` loses its Authenticode signature (SmartScreen
  may warn). Re-sign it with `signtool` if you distribute it. The build was
  verified to work locally on Windows as well.
- **macOS**: the script removes and re-applies the ad-hoc code signature.
- **Startup output** is the same as the regular server: it logs the URL, data
  directory and git version. `webDist` is `null` in SEA mode because the web app
  is embedded.
- **The web app and API share one port** (default 4319); there is no separate
  Vite dev server in SEA mode.
- If the executable prints `Cannot find module …` make sure you built with the
  bundled server (`pnpm build:sea` does this automatically) rather than copying
  `apps/server/dist` manually.

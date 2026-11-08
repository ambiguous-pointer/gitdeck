#!/usr/bin/env node
/**
 * Build a **single-file Node SEA executable** for the current platform.
 *
 *   pnpm build:sea                 # linux -> build/sea/gitdeck (ELF)
 *   pnpm build:sea -- --out ./gitdeck
 *
 * It bundles the API server (all npm dependencies inlined), embeds the built
 * web app as SEA assets, generates a SEA blob from the running `node` binary
 * and injects it with `postject`, producing one self-contained executable
 * (plus Node, which is embedded in it).
 *
 * Requirements:
 *   - run on the **target platform/arch** (this script produces `linux-x64`,
 *     `windows-x64`, `darwin-arm64`, … depending on where it runs);
 *   - Node.js >= 20.12 (the same binary that is used as the SEA host);
 *   - `pnpm install` already done (needs the `postject` dev dependency);
 *   - then run `pnpm build:sea` — it builds shared/server/web itself unless
 *     `--skip-build` is passed.
 *
 * The resulting binary still needs a `git` executable on the target machine:
 * GitDeck talks to the real `git` CLI and does not embed a Git implementation.
 */
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const isWindows = process.platform === 'win32';
const isMac = process.platform === 'darwin';
const exeName = isWindows ? 'gitdeck.exe' : 'gitdeck';
const SENTINEL_FUSE = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2';

const argv = process.argv.slice(2);
const hasFlag = (name) => argv.includes(`--${name}`);
const getOption = (name, fallback) => {
  const index = argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  const value = argv[index + 1];
  return value && !value.startsWith('--') ? value : fallback;
};

const OPTIONS = {
  out: getOption('out', null),
  skipBuild: hasFlag('skip-build'),
  keep: hasFlag('keep'),
  codeCache: hasFlag('code-cache'),
  withSourcemaps: hasFlag('with-sourcemaps'),
  minify: hasFlag('minify'),
  help: hasFlag('help') || hasFlag('h'),
};

const STAGING_DIR = path.join(root, 'build', 'sea');
const SERVER_BUNDLE_DIR = path.join(root, 'apps', 'server', 'dist-sea');
const SERVER_BUNDLE = path.join(SERVER_BUNDLE_DIR, 'index.js');
const WEB_DIST = path.join(root, 'apps', 'web', 'dist');
const BLOB_FILE = path.join(STAGING_DIR, 'gitdeck.blob');
const SEA_CONFIG = path.join(STAGING_DIR, 'sea-config.json');

function printHelp() {
  console.log(`GitDeck Node SEA builder

Usage: pnpm build:sea [options]

Options:
  --out <file>          Copy the final executable to <file> (also kept in build/sea).
  --skip-build          Skip "pnpm build" (reuse existing apps/web/dist and dist-sea bundle).
  --code-cache          Enable V8 code cache for slightly faster startup (bigger blob).
  --with-sourcemaps     Embed .map files from the web build (bigger binary).
  --minify              Minify the server bundle (smaller bundle, slightly slower build).
  --keep                Keep intermediate artifacts (blob, config, copied web assets).
  -h, --help            Show this help.

Output: build/sea/${exeName}
`);
}

function logStep(message) {
  console.log(`\n\u001b[36m[sea]\u001b[0m ${message}`);
}

function logInfo(message) {
  console.log(`       ${message}`);
}

function fail(message) {
  console.error(`\n\u001b[31m[sea] ERROR:\u001b[0m ${message}\n`);
  process.exit(1);
}

function run(command, args, options = {}) {
  logInfo(`$ ${command} ${args.map((arg) => (/\s/.test(arg) ? JSON.stringify(arg) : arg)).join(' ')}`);
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? root,
    stdio: options.capture ? 'pipe' : 'inherit',
    shell: options.shell ?? false,
    env: { ...process.env, ...options.env },
    encoding: 'utf8',
  });
  if (result.error) fail(`${command} could not be started: ${result.error.message}`);
  if (result.status !== 0) {
    if (result.stderr) console.error(result.stderr);
    fail(`${command} ${args.join(' ')} failed with exit code ${result.status}`);
  }
  return (result.stdout ?? '').trim();
}


/** Run pnpm without requiring a shell (works for pnpm.exe, .cmd and POSIX). */
function runPnpm(args, options = {}) {
  const execPath = process.env.npm_execpath;
  if (execPath && fs.existsSync(execPath)) {
    if (/\.(c|m)?js$/i.test(execPath)) return run(process.execPath, [execPath, ...args], options);
    return run(execPath, args, options);
  }
  if (isWindows) {
    const comspec = process.env.ComSpec ?? 'cmd.exe';
    const quote = (value) => (/\s/.test(value) ? '"' + value + '"' : value);
    return run(comspec, ['/d', '/s', '/c', 'pnpm ' + args.map(quote).join(' ')], options);
  }
  return run('pnpm', args, options);
}

function assertNodeVersion() {
  const [major, minor] = process.versions.node.split('.').map((value) => Number.parseInt(value, 10));
  if (major < 20 || (major === 20 && minor < 12)) {
    fail(
      `Node.js ${process.versions.node} is too old for Node SEA assets. ` +
        'Install Node.js 22 or 24 on the build machine (the same binary is embedded in the executable).',
    );
  }
  if (!['linux', 'win32', 'darwin'].includes(process.platform)) {
    fail(`Unsupported build platform: ${process.platform}. Use Linux, macOS or Windows.`);
  }
}

function copyDirectory(source, destination, { skipMaps }) {
  fs.mkdirSync(destination, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    if (entry.isDirectory()) {
      copyDirectory(from, to, { skipMaps });
    } else if (entry.isFile()) {
      if (skipMaps && entry.name.endsWith('.map')) continue;
      fs.copyFileSync(from, to);
    }
  }
}

function listFiles(directory) {
  const files = [];
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) files.push(full);
    }
  };
  walk(directory);
  return files;
}

function formatBytes(bytes) {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB (${bytes.toLocaleString()} bytes)`;
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function fileType(file) {
  if (isWindows) return 'PE';
  const output = spawnSync('file', ['-b', file], { encoding: 'utf8' });
  return output.status === 0 ? output.stdout.trim() : 'unknown';
}

function resolvePostjectCli() {
  const packageJsonPath = path.join(root, 'node_modules', 'postject', 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    fail('postject is not installed. Run "pnpm install" first (it is a devDependency).');
  }
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const bin = typeof packageJson.bin === 'string' ? packageJson.bin : packageJson.bin?.postject;
  if (!bin) fail('Could not find the postject CLI entry in node_modules/postject/package.json.');
  return path.join(path.dirname(packageJsonPath), bin);
}

function main() {
  if (OPTIONS.help) {
    printHelp();
    return;
  }
  assertNodeVersion();

  logStep(`GitDeck SEA build · Node ${process.versions.node} · ${process.platform}-${process.arch}`);
  logInfo(`repo:    ${root}`);
  logInfo(`output:  ${path.join(STAGING_DIR, exeName)}`);

  if (!fs.existsSync(path.join(root, 'node_modules'))) {
    fail('node_modules is missing. Run "pnpm install" on this machine first.');
  }
  if (!fs.existsSync(WEB_DIST) && OPTIONS.skipBuild) {
    fail(`apps/web/dist is missing. Run "pnpm build" or drop --skip-build (looked in ${WEB_DIST}).`);
  }

  /* 1. Build the monorepo (shared dist, server dist, web dist). ---------- */
  if (!OPTIONS.skipBuild) {
    logStep('Building shared + server + web (pnpm build)');
    runPnpm(['build']);
  }

  /* 2. Bundle the server into one self-contained CJS file. --------------- */
  logStep('Bundling the API server with all dependencies inlined');
  runPnpm(['--filter', '@gitdeck/server', 'build:sea'], {
    env: OPTIONS.minify ? { SEA_MINIFY: '1' } : {},
  });
  if (!fs.existsSync(SERVER_BUNDLE)) {
    fail(`SEA server bundle was not produced at ${SERVER_BUNDLE}`);
  }

  /* 3. Stage web assets + package metadata for embedding. ---------------- */
  logStep('Staging web assets and app metadata for embedding');
  fs.rmSync(STAGING_DIR, { recursive: true, force: true });
  fs.mkdirSync(STAGING_DIR, { recursive: true });
  if (!fs.existsSync(path.join(WEB_DIST, 'index.html'))) {
    fail(`Built web app not found in ${WEB_DIST}. Run "pnpm build" first.`);
  }
  copyDirectory(WEB_DIST, path.join(STAGING_DIR, 'web'), { skipMaps: !OPTIONS.withSourcemaps });
  fs.mkdirSync(path.join(STAGING_DIR, 'app'), { recursive: true });
  fs.copyFileSync(path.join(root, 'package.json'), path.join(STAGING_DIR, 'app', 'package.json'));

  const assetFiles = listFiles(STAGING_DIR);
  const assets = {};
  for (const file of assetFiles) {
    const key = path.relative(STAGING_DIR, file).split(path.sep).join('/');
    assets[key] = file;
  }
  logInfo(`embedded assets: ${Object.keys(assets).length}`);

  /* 4. Generate the SEA blob. -------------------------------------------- */
  const seaConfig = {
    main: SERVER_BUNDLE,
    output: BLOB_FILE,
    disableExperimentalSEAWarning: true,
    useSnapshot: false,
    useCodeCache: OPTIONS.codeCache,
    assets,
  };
  fs.writeFileSync(SEA_CONFIG, `${JSON.stringify(seaConfig, null, 2)}\n`, 'utf8');
  logStep('Generating SEA blob (node --experimental-sea-config)');
  run(process.execPath, ['--experimental-sea-config', SEA_CONFIG]);

  /* 5. Copy the Node binary and inject the blob. ------------------------- */
  const binaryPath = path.join(STAGING_DIR, exeName);
  logStep(`Creating executable from ${process.execPath}`);
  fs.copyFileSync(process.execPath, binaryPath);
  fs.chmodSync(binaryPath, 0o755);

  if (isMac) {
    logInfo('Removing existing Mach-O signature (codesign --remove-signature)');
    spawnSync('codesign', ['--remove-signature', binaryPath], { stdio: 'ignore' });
  }

  const postjectCli = resolvePostjectCli();
  const postjectArgs = [
    postjectCli,
    binaryPath,
    'NODE_SEA_BLOB',
    BLOB_FILE,
    '--sentinel-fuse',
    SENTINEL_FUSE,
  ];
  if (isMac) postjectArgs.push('--macho-segment-name', 'NODE_SEA');
  logStep('Injecting the blob with postject');
  run(process.execPath, postjectArgs);

  if (isMac) {
    logInfo('Signing the executable ad-hoc (codesign --sign -)');
    run('codesign', ['--sign', '-', binaryPath]);
  }
  if (isWindows) {
    logInfo('Note: the injected .exe is unsigned; Windows SmartScreen may warn. Sign it for distribution.');
  }
  if (!isWindows) fs.chmodSync(binaryPath, 0o755);

  /* 6. Report + cleanup. ------------------------------------------------- */
  const outputPath = OPTIONS.out ? path.resolve(root, OPTIONS.out) : binaryPath;
  if (OPTIONS.out && outputPath !== binaryPath) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.copyFileSync(binaryPath, outputPath);
    if (!isWindows) fs.chmodSync(outputPath, 0o755);
  }

  const stats = fs.statSync(outputPath);
  console.log('\n\u001b[32m[sea] Build complete\u001b[0m');
  console.log(`  executable : ${outputPath}`);
  console.log(`  size       : ${formatBytes(stats.size)}`);
  console.log(`  format     : ${fileType(outputPath)}`);
  console.log(`  sha256     : ${sha256(outputPath)}`);
  console.log(`  platform   : ${process.platform}-${process.arch} (node ${process.versions.node} embedded)`);
  console.log('\n  Run it with:');
  console.log(`    GITDECK_HOME=~/.gitdeck PORT=4319 ${isWindows ? outputPath : `./${path.relative(process.cwd(), outputPath)}`}`);
  console.log('    # then open http://127.0.0.1:4319');
  console.log('\n  Requirements on the target machine:');
  console.log('    - a `git` executable on PATH (GitDeck calls the real git CLI)');
  console.log(
    process.platform === 'linux'
      ? '    - glibc-based Linux (the official Node binary is dynamically linked); use a musl/static Node build for Alpine'
      : '    - the matching OS/arch; the binary cannot be moved to another platform',
  );
  console.log('    - write access to the data directory (default: ~/.gitdeck, override with GITDECK_HOME)');

  if (!OPTIONS.keep) {
    logStep('Cleaning up intermediate artifacts (use --keep to preserve them)');
    for (const file of [BLOB_FILE, SEA_CONFIG]) fs.rmSync(file, { force: true });
    for (const dir of [path.join(STAGING_DIR, 'web'), path.join(STAGING_DIR, 'app')]) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    logInfo(`kept: ${path.relative(root, outputPath)}`);
  }
}

main();

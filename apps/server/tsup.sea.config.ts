import { defineConfig } from 'tsup';

/**
 * Node SEA build configuration.
 *
 * Produces a single self-contained CommonJS bundle of the server with **all**
 * npm dependencies inlined (even the workspace `@gitdeck/shared` package), ready
 * to be embedded into a Node.js binary by `scripts/build-sea.mjs`.
 *
 * Run with: `pnpm --filter @gitdeck/server build:sea`
 */
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs'],
  target: 'node20',
  platform: 'node',
  outDir: 'dist-sea',
  clean: true,
  sourcemap: false,
  splitting: false,
  // Everything except Node built-ins is bundled; the SEA blob cannot resolve
  // `node_modules` at runtime.
  noExternal: [/.*/],
  // Keep the `node:` protocol: the SEA build calls require('node:sea') and
  // tsup strips the prefix by default, which would make it require('sea').
  removeNodeProtocol: false,
  // Keep readable output: the runtime binary dominates the final size anyway.
  minify: process.env.SEA_MINIFY === '1',
  silent: false,
});

import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../../..');

export default defineConfig({
  root: path.resolve(here, '../..'),
  resolve: {
    alias: {
      // `@gitdeck/shared` is consumed through its freshly built ESM bundle.
      // (The package.json "exports" mapping is owned by the Lead; the built
      // bundle keeps tests independent from that mapping.)
      '@gitdeck/shared': path.join(repoRoot, 'packages', 'shared', 'dist', 'index.js'),
    },
  },
  server: {
    fs: {
      allow: [repoRoot],
    },
  },
  test: {
    environment: 'node',
    include: ['src/test/**/*.test.ts'],
    setupFiles: ['src/test/setup.ts'],
    testTimeout: 180_000,
    hookTimeout: 90_000,
    maxConcurrency: 4,
    reporters: ['default'],
  },
});

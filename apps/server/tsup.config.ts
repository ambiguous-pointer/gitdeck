import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs'],
  target: 'node20',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  splitting: false,
  // Bundle the workspace package so `node dist/index.js` is self contained.
  noExternal: ['@gitdeck/shared'],
});

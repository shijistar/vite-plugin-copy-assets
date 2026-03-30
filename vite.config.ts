import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'VitePluginCopyAssets',
      fileName: 'index',
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      external: [
        'vite',
        'path',
        'fs',
        'fs/promises',
        'node:fs',
        'node:fs/promises',
        'node:path',
        'node:os',
        'node:stream',
        'node:events',
        'node:util',
        'fast-glob',
      ],
      output: {
        exports: 'named',
      },
    },
    sourcemap: true,
    target: 'node18',
  },
  resolve: {
    conditions: ['node', 'import', 'module', 'default'],
  },
});

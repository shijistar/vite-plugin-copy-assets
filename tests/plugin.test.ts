import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import os from 'node:os';
import copyAssets from '../src/index.js';
import type { ResolvedConfig } from 'vite';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function withTempDir(fn: (dir: string) => Promise<void>): Promise<void> {
  const dir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'vite-copy-assets-plugin-'));
  try {
    await fn(dir);
  } finally {
    await fsPromises.rm(dir, { recursive: true, force: true });
  }
}

function makeConfig(root: string, outDir = 'dist'): ResolvedConfig {
  return {
    root,
    build: { outDir },
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  } as unknown as ResolvedConfig;
}

// ---------------------------------------------------------------------------
// Plugin factory
// ---------------------------------------------------------------------------

describe('copyAssets plugin', () => {
  it('returns a plugin with the correct name', () => {
    const plugin = copyAssets({ targets: [] });
    expect(plugin.name).toBe('vite-plugin-copy-assets');
  });

  it('returns an empty plugin when no targets are provided', () => {
    const plugin = copyAssets({ targets: [] });
    expect(plugin.configResolved).toBeUndefined();
    expect(plugin.writeBundle).toBeUndefined();
    expect(plugin.configureServer).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Build copy (writeBundle)
// ---------------------------------------------------------------------------

describe('copyAssets build hook', () => {
  it('copies files matching a glob pattern into outDir', async () => {
    await withTempDir(async (root) => {
      // Set up source files
      await fsPromises.mkdir(path.join(root, 'vendor', 'fonts'), { recursive: true });
      await fsPromises.writeFile(path.join(root, 'vendor', 'fonts', 'Roboto.woff2'), 'font');
      await fsPromises.writeFile(path.join(root, 'vendor', 'fonts', 'Roboto.ttf'), 'font2');

      const outDir = path.join(root, 'dist');
      const plugin = copyAssets({
        targets: [{ src: 'vendor/fonts/**', dest: 'assets/fonts' }],
        verbose: false,
      });

      const config = makeConfig(root, outDir);
      (plugin.configResolved as (c: ResolvedConfig) => void)(config);
      await (plugin.writeBundle as () => Promise<void>)();

      expect(fs.existsSync(path.join(outDir, 'assets', 'fonts', 'Roboto.woff2'))).toBe(true);
      expect(fs.existsSync(path.join(outDir, 'assets', 'fonts', 'Roboto.ttf'))).toBe(true);
    });
  });

  it('respects the flatten option', async () => {
    await withTempDir(async (root) => {
      await fsPromises.mkdir(path.join(root, 'src', 'images', 'sub'), { recursive: true });
      await fsPromises.writeFile(path.join(root, 'src', 'images', 'sub', 'logo.png'), 'img');

      const outDir = path.join(root, 'dist');
      const plugin = copyAssets({
        targets: [{ src: 'src/images/**', dest: 'img', flatten: true }],
      });

      const config = makeConfig(root, outDir);
      (plugin.configResolved as (c: ResolvedConfig) => void)(config);
      await (plugin.writeBundle as () => Promise<void>)();

      // With flatten=true, 'sub/logo.png' becomes 'logo.png' directly under dest
      expect(fs.existsSync(path.join(outDir, 'img', 'logo.png'))).toBe(true);
      expect(fs.existsSync(path.join(outDir, 'img', 'sub', 'logo.png'))).toBe(false);
    });
  });

  it('copies to root of outDir when dest is not specified', async () => {
    await withTempDir(async (root) => {
      await fsPromises.mkdir(path.join(root, 'static'), { recursive: true });
      await fsPromises.writeFile(path.join(root, 'static', 'robots.txt'), 'User-agent: *');

      const outDir = path.join(root, 'dist');
      const plugin = copyAssets({
        targets: [{ src: 'static/**' }],
      });

      const config = makeConfig(root, outDir);
      (plugin.configResolved as (c: ResolvedConfig) => void)(config);
      await (plugin.writeBundle as () => Promise<void>)();

      expect(fs.existsSync(path.join(outDir, 'robots.txt'))).toBe(true);
    });
  });

  it('supports multiple patterns in src array', async () => {
    await withTempDir(async (root) => {
      await fsPromises.mkdir(path.join(root, 'a'), { recursive: true });
      await fsPromises.mkdir(path.join(root, 'b'), { recursive: true });
      await fsPromises.writeFile(path.join(root, 'a', 'file1.txt'), '1');
      await fsPromises.writeFile(path.join(root, 'b', 'file2.txt'), '2');

      const outDir = path.join(root, 'dist');
      const plugin = copyAssets({
        targets: [{ src: ['a/**', 'b/**'], dest: 'out' }],
      });

      const config = makeConfig(root, outDir);
      (plugin.configResolved as (c: ResolvedConfig) => void)(config);
      await (plugin.writeBundle as () => Promise<void>)();

      expect(fs.existsSync(path.join(outDir, 'out', 'file1.txt'))).toBe(true);
      expect(fs.existsSync(path.join(outDir, 'out', 'file2.txt'))).toBe(true);
    });
  });

  it('uses generateBundle hook when configured', async () => {
    await withTempDir(async (root) => {
      await fsPromises.mkdir(path.join(root, 'assets'), { recursive: true });
      await fsPromises.writeFile(path.join(root, 'assets', 'data.json'), '{}');

      const outDir = path.join(root, 'dist');
      const plugin = copyAssets({
        targets: [{ src: 'assets/**', dest: 'data' }],
        hook: 'generateBundle',
      });

      const config = makeConfig(root, outDir);
      (plugin.configResolved as (c: ResolvedConfig) => void)(config);

      // writeBundle should NOT be defined
      expect(plugin.writeBundle).toBeUndefined();

      await (plugin.generateBundle as () => Promise<void>)();
      expect(fs.existsSync(path.join(outDir, 'data', 'data.json'))).toBe(true);
    });
  });

  it('logs copied files when verbose is true', async () => {
    await withTempDir(async (root) => {
      await fsPromises.mkdir(path.join(root, 'res'), { recursive: true });
      await fsPromises.writeFile(path.join(root, 'res', 'icon.svg'), '<svg/>');

      const outDir = path.join(root, 'dist');
      const plugin = copyAssets({
        targets: [{ src: 'res/**', dest: '.' }],
        verbose: true,
      });

      const config = makeConfig(root, outDir);
      (plugin.configResolved as (c: ResolvedConfig) => void)(config);
      await (plugin.writeBundle as () => Promise<void>)();

      const infoMock = config.logger.info as ReturnType<typeof vi.fn>;
      const calls = infoMock.mock.calls.map((c: unknown[]) => String(c[0]));
      expect(calls.some((msg: string) => msg.includes('icon.svg'))).toBe(true);
      expect(calls.some((msg: string) => msg.includes('1 file copied'))).toBe(true);
    });
  });
});

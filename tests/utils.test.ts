import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import os from 'node:os';
import { getGlobBase, resolveDestPath, isFile, copyFile, ensureDir } from '../src/utils.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function withTempDir(fn: (dir: string) => Promise<void>): Promise<void> {
  const dir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'vite-copy-assets-test-'));
  try {
    await fn(dir);
  } finally {
    await fsPromises.rm(dir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// getGlobBase
// ---------------------------------------------------------------------------

describe('getGlobBase', () => {
  const cwd = '/project';

  it('returns the full path when there are no magic characters', () => {
    expect(getGlobBase('src/images', cwd)).toBe(path.resolve(cwd, 'src/images'));
  });

  it('returns the base before the first wildcard segment', () => {
    expect(getGlobBase('src/assets/**', cwd)).toBe(path.resolve(cwd, 'src/assets'));
  });

  it('handles a pattern starting with a wildcard', () => {
    expect(getGlobBase('*.png', cwd)).toBe(path.resolve(cwd, '.'));
  });

  it('handles nested wildcards', () => {
    expect(getGlobBase('src/**/images/*.png', cwd)).toBe(path.resolve(cwd, 'src'));
  });

  it('handles brace expansion base', () => {
    expect(getGlobBase('{src,lib}/assets/**', cwd)).toBe(path.resolve(cwd, '.'));
  });
});

// ---------------------------------------------------------------------------
// resolveDestPath
// ---------------------------------------------------------------------------

describe('resolveDestPath', () => {
  const cwd = '/project';
  const destDir = '/output/assets';
  const globBase = path.resolve(cwd, 'src/assets');

  it('preserves directory structure relative to glob base (flatten=false)', () => {
    const file = '/project/src/assets/fonts/Roboto.woff2';
    const result = resolveDestPath(file, cwd, destDir, false, globBase);
    expect(result).toBe(path.join(destDir, 'fonts', 'Roboto.woff2'));
  });

  it('flattens to basename when flatten=true', () => {
    const file = '/project/src/assets/fonts/Roboto.woff2';
    const result = resolveDestPath(file, cwd, destDir, true, globBase);
    expect(result).toBe(path.join(destDir, 'Roboto.woff2'));
  });

  it('resolves relative paths against cwd', () => {
    const file = 'src/assets/logo.png'; // relative
    const result = resolveDestPath(file, cwd, destDir, true, globBase);
    expect(result).toBe(path.join(destDir, 'logo.png'));
  });
});

// ---------------------------------------------------------------------------
// isFile
// ---------------------------------------------------------------------------

describe('isFile', () => {
  it('returns false for a non-existent path', () => {
    expect(isFile('/no/such/path/file.txt')).toBe(false);
  });

  it('returns true for an existing file', async () => {
    await withTempDir(async (dir) => {
      const file = path.join(dir, 'hello.txt');
      await fsPromises.writeFile(file, 'hello');
      expect(isFile(file)).toBe(true);
    });
  });

  it('returns false for a directory', async () => {
    await withTempDir(async (dir) => {
      expect(isFile(dir)).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// ensureDir
// ---------------------------------------------------------------------------

describe('ensureDir', () => {
  it('creates deeply nested directories without error', async () => {
    await withTempDir(async (dir) => {
      const nested = path.join(dir, 'a', 'b', 'c');
      await ensureDir(nested);
      expect(fs.existsSync(nested)).toBe(true);
    });
  });

  it('does not throw if directory already exists', async () => {
    await withTempDir(async (dir) => {
      await expect(ensureDir(dir)).resolves.not.toThrow();
    });
  });
});

// ---------------------------------------------------------------------------
// copyFile
// ---------------------------------------------------------------------------

describe('copyFile', () => {
  it('copies a file to an existing destination directory', async () => {
    await withTempDir(async (dir) => {
      const src = path.join(dir, 'source.txt');
      const dest = path.join(dir, 'nested', 'target.txt');
      await fsPromises.writeFile(src, 'content');

      await copyFile(src, dest);

      expect(fs.existsSync(dest)).toBe(true);
      expect(await fsPromises.readFile(dest, 'utf8')).toBe('content');
    });
  });

  it('creates intermediate directories automatically', async () => {
    await withTempDir(async (dir) => {
      const src = path.join(dir, 'file.bin');
      await fsPromises.writeFile(src, Buffer.from([0x00, 0xff]));

      const dest = path.join(dir, 'deep', 'path', 'copy.bin');
      await copyFile(src, dest);

      expect(fs.existsSync(dest)).toBe(true);
    });
  });
});

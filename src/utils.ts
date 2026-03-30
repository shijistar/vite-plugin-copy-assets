import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';

/**
 * Recursively ensure a directory exists, creating it (and any parents) if necessary.
 */
export async function ensureDir(dir: string): Promise<void> {
  await fsPromises.mkdir(dir, { recursive: true });
}

/**
 * Copy a single file from `src` to `dest`, creating the destination directory if needed.
 */
export async function copyFile(src: string, dest: string): Promise<void> {
  await ensureDir(path.dirname(dest));
  await fsPromises.copyFile(src, dest);
}

/**
 * Determine the destination path for a matched file.
 *
 * @param matchedFile  - Absolute or cwd-relative path returned by fast-glob
 * @param cwd          - The working directory used for the glob
 * @param destDir      - The resolved destination directory
 * @param flatten      - If true, only keep the file's basename
 * @param globBase     - The non-magic base portion of the glob pattern (used when not flattening)
 */
export function resolveDestPath(
  matchedFile: string,
  cwd: string,
  destDir: string,
  flatten: boolean,
  globBase: string,
): string {
  const absoluteFile = path.isAbsolute(matchedFile)
    ? matchedFile
    : path.resolve(cwd, matchedFile);

  if (flatten) {
    return path.join(destDir, path.basename(absoluteFile));
  }

  // Preserve the directory structure below the glob base
  const relativeToBase = path.relative(globBase, absoluteFile);
  return path.join(destDir, relativeToBase);
}

/**
 * Extract the non-magic "base" directory from a glob pattern.
 * For example, `src/assets/**\/images` → `src/assets`.
 */
export function getGlobBase(pattern: string, cwd: string): string {
  // Find the first path segment containing a glob magic character
  const segments = pattern.replace(/\\/g, '/').split('/');
  const magicIndex = segments.findIndex((s) => /[*?{[]/.test(s));
  const baseSegments = magicIndex === -1 ? segments : segments.slice(0, magicIndex);
  const base = baseSegments.join('/') || '.';
  return path.resolve(cwd, base);
}

/**
 * Return `true` when `filePath` points to a regular file (not a directory).
 */
export function isFile(filePath: string): boolean {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

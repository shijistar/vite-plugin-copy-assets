import path from 'node:path';
import fg from 'fast-glob';
import type { Plugin, ResolvedConfig } from 'vite';
import type { CopyAssetsOptions, CopyTarget } from './types.js';
import { copyFile, getGlobBase, isFile, resolveDestPath } from './utils.js';

export type { CopyAssetsOptions, CopyTarget };

/**
 * Resolve all glob patterns in a target and return an array of
 * `{ src: absoluteFilePath, dest: absoluteDestPath }` pairs.
 */
async function resolveTargetFiles(
  target: CopyTarget,
  rootDir: string,
  outDir: string,
): Promise<Array<{ src: string; dest: string }>> {
  const cwd = target.cwd ?? rootDir;
  const destDir = path.resolve(outDir, target.dest ?? '.');
  const flatten = target.flatten ?? false;
  const patterns = Array.isArray(target.src) ? target.src : [target.src];

  const results: Array<{ src: string; dest: string }> = [];

  for (const pattern of patterns) {
    const globBase = getGlobBase(pattern, cwd);

    const matched = await fg(pattern, {
      cwd,
      absolute: true,
      onlyFiles: true,
      dot: true,
      ...((target.globOptions as Parameters<typeof fg>[1]) ?? {}),
    });

    for (const file of matched) {
      const dest = resolveDestPath(file, cwd, destDir, flatten, globBase);
      results.push({ src: file, dest });
    }
  }

  return results;
}

/**
 * Copy all targets to the output directory.
 * Returns the total number of files copied.
 */
async function copyTargets(
  targets: CopyTarget[],
  rootDir: string,
  outDir: string,
  verbose: boolean,
  logger: { info: (msg: string) => void },
): Promise<number> {
  let count = 0;

  for (const target of targets) {
    const pairs = await resolveTargetFiles(target, rootDir, outDir);

    for (const { src, dest } of pairs) {
      await copyFile(src, dest);
      count++;
      if (verbose) {
        logger.info(`[vite-plugin-copy-assets] Copied: ${src} → ${dest}`);
      }
    }
  }

  return count;
}

/**
 * A Vite 8 plugin that copies static asset files to the output directory during build,
 * and serves them transparently through the dev server middleware during development.
 *
 * Comparable to Webpack's `CopyWebpackPlugin`.
 *
 * @example
 * ```ts
 * // vite.config.ts
 * import { defineConfig } from 'vite';
 * import copyAssets from 'vite-plugin-copy-assets';
 *
 * export default defineConfig({
 *   plugins: [
 *     copyAssets({
 *       targets: [
 *         { src: 'vendor/fonts/**', dest: 'fonts' },
 *         { src: 'node_modules/some-lib/dist/img/**', dest: 'assets/img' },
 *       ],
 *     }),
 *   ],
 * });
 * ```
 */
export default function copyAssets(options: CopyAssetsOptions): Plugin {
  const { targets, verbose = false, hook = 'writeBundle' } = options;

  if (!targets || targets.length === 0) {
    return { name: 'vite-plugin-copy-assets' };
  }

  let config: ResolvedConfig;

  const buildHook = async (): Promise<void> => {
    const outDir = path.resolve(config.root, config.build.outDir);
    const count = await copyTargets(targets, config.root, outDir, verbose, config.logger);

    if (verbose || count > 0) {
      config.logger.info(
        `[vite-plugin-copy-assets] ${count} file${count === 1 ? '' : 's'} copied.`,
      );
    }
  };

  return {
    name: 'vite-plugin-copy-assets',

    configResolved(resolvedConfig) {
      config = resolvedConfig;
    },

    // Dev server: serve matched files as static middleware
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url) return next();

        // Strip query string and decode
        const urlPath = decodeURIComponent(req.url.split('?')[0]);

        // Only handle GET / HEAD requests
        if (req.method !== 'GET' && req.method !== 'HEAD') return next();

        // Try to find the file across all targets
        for (const target of targets) {
          const cwd = target.cwd ?? config.root;
          const destDir = target.dest ?? '.';
          const flatten = target.flatten ?? false;
          const patterns = Array.isArray(target.src) ? target.src : [target.src];

          for (const pattern of patterns) {
            const globBase = getGlobBase(pattern, cwd);

            const matched = await fg(pattern, {
              cwd,
              absolute: true,
              onlyFiles: true,
              dot: true,
              ...((target.globOptions as Parameters<typeof fg>[1]) ?? {}),
            });

            for (const file of matched) {
              const relFile = resolveDestPath(file, cwd, destDir, flatten, globBase);
              // Normalise: remove leading destDir and get the URL path segment
              const servedPath = '/' + relFile.replace(/\\/g, '/');

              if (servedPath === urlPath && isFile(file)) {
                res.setHeader('Content-Type', getMimeType(file));
                const stream = (await import('node:fs')).default.createReadStream(file);
                stream.pipe(res);
                return;
              }
            }
          }
        }

        next();
      });
    },

    // Build: copy files after bundles are written
    ...(hook === 'writeBundle'
      ? { writeBundle: buildHook }
      : { generateBundle: buildHook }),
  };
}

/**
 * Return a best-guess MIME type for `filePath` based on its extension.
 */
function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.mjs': 'application/javascript',
    '.cjs': 'application/javascript',
    '.json': 'application/json',
    '.xml': 'application/xml',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.otf': 'font/otf',
    '.eot': 'application/vnd.ms-fontobject',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.ogg': 'audio/ogg',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.pdf': 'application/pdf',
    '.zip': 'application/zip',
    '.gz': 'application/gzip',
    '.txt': 'text/plain',
    '.map': 'application/json',
  };
  return map[ext] ?? 'application/octet-stream';
}

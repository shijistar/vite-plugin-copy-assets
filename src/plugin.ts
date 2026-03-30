import path from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite';
import { copyPatternToFilesystem, emitPatternAssets, serveDevAsset } from './asset-operations.js';
import type { ResolvedCopyAssetPattern } from './internal.js';
import { applyEntryOverwriteRules, resolvePattern } from './pattern-resolver.js';
import type { CopyAssetPattern, CopyAssetsPluginOptions } from './types.js';
import { defaultContentTypes } from './utils/content-types.js';
import { isWithinDirectory } from './utils/path.js';

export type * from './types.js';

/** Create a Vite plugin that copies matched assets during build and serves them in dev. */
function copyAssets(patterns: CopyAssetPattern[], options?: CopyAssetsPluginOptions): Plugin {
  let resolvedConfig: ResolvedConfig;
  let configDirectory = '';
  let outputDirectory = '';
  let resolvedPatterns: ResolvedCopyAssetPattern[] = [];
  let contentTypes: Record<`.${string}`, string> = defaultContentTypes;

  return {
    name: 'copy-assets-plugin',
    configResolved(config) {
      resolvedConfig = config;
      configDirectory = config.configFile ? path.dirname(config.configFile) : config.root;
      outputDirectory = path.resolve(config.root, config.build.outDir);
      // Merge user Content-Type overrides so dev responses use project-specific content types.
      contentTypes = {
        ...defaultContentTypes,
        ...options?.contentTypes,
      };
      // Pre-resolve and de-duplicate all rules once to reuse in dev/build hooks.
      resolvedPatterns = applyEntryOverwriteRules(
        patterns.map((pattern) => resolvePattern(pattern, configDirectory, outputDirectory, config)),
        config
      );
    },
    configureServer(server) {
      for (const pattern of resolvedPatterns) {
        server.watcher.add(pattern.watchPath);

        // Targets outside outDir cannot be exposed safely as dev request paths.
        if (!pattern.devRequestPath) {
          continue;
        }

        server.middlewares.use(pattern.devRequestPath, (req, res, next) => {
          serveDevAsset(pattern, req.url || '/', res, next, contentTypes);
        });
      }
    },
    generateBundle() {
      for (const pattern of resolvedPatterns) {
        // Assets inside outDir should be emitted through Rollup to keep hashes/manifests consistent.
        if (!isWithinDirectory(outputDirectory, pattern.toAbsolutePath)) {
          continue;
        }

        emitPatternAssets(pattern, outputDirectory, (fileName, source) => {
          this.emitFile({
            type: 'asset',
            fileName,
            source,
          });
        });
      }
    },
    closeBundle() {
      if (resolvedConfig.command !== 'build') {
        return;
      }

      for (const pattern of resolvedPatterns) {
        // For destinations outside outDir, emitFile cannot write there, so copy directly to disk.
        if (isWithinDirectory(outputDirectory, pattern.toAbsolutePath)) {
          continue;
        }

        copyPatternToFilesystem(pattern);
      }
    },
  };
}

export default copyAssets;

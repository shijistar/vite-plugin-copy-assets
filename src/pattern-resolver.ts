import fs from 'node:fs';
import path from 'node:path';
import { globSync, isDynamicPattern } from 'tinyglobby';
import type { ResolvedConfig } from 'vite';
import type { ResolvedCopyAssetEntry, ResolvedCopyAssetPattern } from './internal.js';
import type { CopyAssetPattern } from './types.js';
import {
  fromPosixPath,
  isWithinDirectory,
  joinRequestPath,
  resolveGlobBasePath,
  resolveWatchPath,
  toPosixPath,
} from './utils/path.js';

/** Resolve a user pattern into concrete files and runtime metadata. */
export function resolvePattern(
  pattern: CopyAssetPattern,
  configDirectory: string,
  outputDirectory: string,
  config: ResolvedConfig
): ResolvedCopyAssetPattern {
  const fromAbsolutePath = path.isAbsolute(pattern.from) ? pattern.from : path.resolve(configDirectory, pattern.from);
  const hasGlobPattern = isDynamicPattern(toPosixPath(pattern.from));
  const sourceExists = fs.existsSync(fromAbsolutePath);

  // Non-glob inputs must exist at config time; fail fast with explicit message.
  if (!hasGlobPattern && !sourceExists) {
    throw new Error(`[copy-assets-plugin] Source does not exist: ${pattern.from}`);
  }

  const sourceType: ResolvedCopyAssetPattern['sourceType'] =
    !hasGlobPattern && sourceExists && fs.statSync(fromAbsolutePath).isFile() ? 'file' : 'collection';
  const toAbsolutePath = path.isAbsolute(pattern.to) ? pattern.to : path.resolve(outputDirectory, pattern.to);
  const targetType = detectTargetType(pattern.to, toAbsolutePath, sourceType);
  const matchedFiles = resolveMatchedFiles(pattern, configDirectory, fromAbsolutePath, hasGlobPattern);

  if (matchedFiles.length === 0) {
    throw new Error(`[copy-assets-plugin] No file matched: ${pattern.from}`);
  }

  // Prevent ambiguous "many-to-one" writes that would overwrite each other.
  if (sourceType === 'collection' && targetType === 'file') {
    throw new Error(`[copy-assets-plugin] Multiple files cannot target a single file: ${pattern.to}`);
  }

  const entries = buildResolvedEntries(matchedFiles, toAbsolutePath, targetType, pattern);
  const resolvedPattern: ResolvedCopyAssetPattern = {
    from: pattern.from,
    to: pattern.to,
    fromAbsolutePath,
    toAbsolutePath,
    sourceType,
    targetType,
    watchPath: resolveWatchPath(fromAbsolutePath, hasGlobPattern),
    devRequestPath: null,
    entries,
    requestEntryMap: new Map(entries.map((entry) => [entry.requestRelativePath, entry])),
  };

  resolvedPattern.devRequestPath = resolveDevRequestPath(resolvedPattern, outputDirectory, config);

  return resolvedPattern;
}

/**
 * Resolve output path conflicts across patterns.
 *
 * The last entry with force=true wins for the same output path.
 */
export function applyEntryOverwriteRules(patterns: ResolvedCopyAssetPattern[], config: ResolvedConfig) {
  const winnerByOutputPath = new Map<string, ResolvedCopyAssetEntry>();

  for (const pattern of patterns) {
    for (const entry of pattern.entries) {
      const outputKey = toPosixPath(entry.outputFilePath);
      const previousWinner = winnerByOutputPath.get(outputKey);

      // First writer wins unless a later entry explicitly forces overwrite.
      if (!previousWinner) {
        winnerByOutputPath.set(outputKey, entry);
        continue;
      }

      // Keep existing winner when force is not enabled.
      if (!entry.force) {
        continue;
      }

      winnerByOutputPath.set(outputKey, entry);
      config.logger.warn(`[copy-assets-plugin] Overwrite target due to force=true: ${outputKey}`);
    }
  }

  const survivingEntries = new Set(winnerByOutputPath.values());
  return patterns.map((pattern) => {
    const entries = pattern.entries.filter((entry) => survivingEntries.has(entry));
    return {
      ...pattern,
      entries,
      requestEntryMap: new Map(entries.map((entry) => [entry.requestRelativePath, entry])),
    };
  });
}

/** Detect whether the target should be treated as a single file or directory. */
function detectTargetType(
  targetPath: string,
  absoluteTargetPath: string,
  sourceType: ResolvedCopyAssetPattern['sourceType']
) {
  if (sourceType === 'collection') {
    return 'directory';
  }

  if (/[\\/]$/.test(targetPath)) {
    return 'directory';
  }

  if (fs.existsSync(absoluteTargetPath)) {
    return fs.statSync(absoluteTargetPath).isDirectory() ? 'directory' : 'file';
  }

  return path.extname(targetPath) ? 'file' : 'directory';
}

/** Expand a source definition (file, directory, or glob) into concrete files. */
function resolveMatchedFiles(
  pattern: CopyAssetPattern,
  configDirectory: string,
  fromAbsolutePath: string,
  hasGlobPattern: boolean
) {
  if (hasGlobPattern) {
    // Use tinyglobby for pattern expansion while preserving request-relative paths.
    const patternToMatch = path.isAbsolute(pattern.from) ? toPosixPath(fromAbsolutePath) : toPosixPath(pattern.from);
    const globBasePath = resolveGlobBasePath(fromAbsolutePath, pattern.from, configDirectory);
    const matchedPaths = globSync(patternToMatch, {
      cwd: configDirectory,
      onlyFiles: true,
      dot: pattern.globOptions?.dot ?? true,
      ignore: pattern.globOptions?.ignore ?? [],
    });

    return matchedPaths.map((matchedPath) => {
      const sourceFilePath = path.resolve(configDirectory, matchedPath);
      return {
        sourceFilePath,
        requestRelativePath: toPosixPath(path.relative(globBasePath, sourceFilePath)),
      };
    });
  }

  // Single-file source keeps a stable request path equal to basename.
  if (fs.statSync(fromAbsolutePath).isFile()) {
    return [
      {
        sourceFilePath: fromAbsolutePath,
        requestRelativePath: path.basename(fromAbsolutePath),
      },
    ];
  }

  const matchedPaths = globSync('**/*', {
    cwd: fromAbsolutePath,
    onlyFiles: true,
    dot: pattern.globOptions?.dot ?? true,
    ignore: pattern.globOptions?.ignore ?? [],
  });

  return matchedPaths.map((matchedPath) => ({
    sourceFilePath: path.join(fromAbsolutePath, matchedPath),
    requestRelativePath: toPosixPath(matchedPath),
  }));
}

/** Build final copy entries including output file paths and transform settings. */
function buildResolvedEntries(
  matchedFiles: { sourceFilePath: string; requestRelativePath: string }[],
  toAbsolutePath: string,
  targetType: ResolvedCopyAssetPattern['targetType'],
  pattern: CopyAssetPattern
) {
  return matchedFiles.map((matchedFile) => ({
    sourceFilePath: matchedFile.sourceFilePath,
    requestRelativePath: matchedFile.requestRelativePath,
    transform: pattern.transform,
    force: pattern.force ?? false,
    outputFilePath:
      targetType === 'file'
        ? toAbsolutePath
        : path.join(toAbsolutePath, fromPosixPath(matchedFile.requestRelativePath)),
  }));
}

/**
 * Convert resolved output targets into a dev-server request prefix. Returns null when the
 * destination is outside build.outDir.
 */
function resolveDevRequestPath(pattern: ResolvedCopyAssetPattern, outputDirectory: string, config: ResolvedConfig) {
  // Dev proxy only serves paths that map under Vite's public base + outDir.
  if (!isWithinDirectory(outputDirectory, pattern.toAbsolutePath)) {
    config.logger.warn(
      `[copy-assets-plugin] Skip dev proxy for ${pattern.to}: absolute target is outside build.outDir.`
    );
    return null;
  }

  const sampleOutputPath =
    pattern.targetType === 'file' ? pattern.toAbsolutePath : path.dirname(pattern.entries[0].outputFilePath);
  const relativeTargetPath = toPosixPath(path.relative(outputDirectory, sampleOutputPath));

  return joinRequestPath(config.base, relativeTargetPath);
}

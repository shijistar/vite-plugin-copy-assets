import fs from 'node:fs';
import path from 'node:path';
import type { ResolvedCopyAssetEntry, ResolvedCopyAssetPattern } from './internal.js';
import { getDecodedPathname, toPosixPath } from './utils/path.js';

/** Middleware handler that serves copied assets directly from source files in dev. */
export function serveDevAsset(
  pattern: ResolvedCopyAssetPattern,
  requestUrl: string,
  res: NodeJS.WritableStream & {
    setHeader(name: string, value: string): void;
    statusCode: number;
    end(chunk?: string): void;
  },
  next: (error?: unknown) => void,
  contentTypes: Record<`.${string}`, string>
) {
  const entry = resolveDevEntry(pattern, requestUrl);

  // Block unknown relative paths to avoid leaking files through this middleware.
  if (!entry) {
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }

  // If source disappeared during watch mode, delegate to next middleware.
  if (!fs.existsSync(entry.sourceFilePath) || !fs.statSync(entry.sourceFilePath).isFile()) {
    next();
    return;
  }

  const contentType = getContentType(entry.outputFilePath, contentTypes);
  if (contentType) {
    res.setHeader('Content-Type', contentType);
  }
  res.end(readEntryContent(entry));
}

/** Resolve a request URL to the corresponding copy entry in dev mode. */
function resolveDevEntry(pattern: ResolvedCopyAssetPattern, requestUrl: string) {
  // Single-file rules always resolve to their only entry regardless of trailing path.
  if (pattern.sourceType === 'file') {
    return pattern.entries[0] ?? null;
  }

  const decodedPath = getDecodedPathname(requestUrl);
  if (decodedPath == null) {
    return null;
  }

  // Normalize and strip leading slash to match keys produced during pattern resolution.
  const normalizedRequestPath = path.posix.normalize(`/${decodedPath}`).replace(/^\/+/, '');
  if (!normalizedRequestPath) {
    return null;
  }

  return pattern.requestEntryMap.get(normalizedRequestPath) ?? null;
}

/** Emit pattern entries as Vite assets for destinations under build.outDir. */
export function emitPatternAssets(
  pattern: ResolvedCopyAssetPattern,
  outputDirectory: string,
  emitFile: (fileName: string, source: Buffer) => void
) {
  for (const entry of pattern.entries) {
    emitFile(toPosixPath(path.relative(outputDirectory, entry.outputFilePath)), readEntryContent(entry));
  }
}

/** Copy pattern entries to disk for destinations outside build.outDir. */
export function copyPatternToFilesystem(pattern: ResolvedCopyAssetPattern) {
  for (const entry of pattern.entries) {
    // Respect existing files unless this entry opted into overwrite semantics.
    if (fs.existsSync(entry.outputFilePath) && !entry.force) {
      continue;
    }

    fs.mkdirSync(path.dirname(entry.outputFilePath), { recursive: true });
    fs.writeFileSync(entry.outputFilePath, readEntryContent(entry));
  }
}

/** Read source file content and apply transform when provided. */
function readEntryContent(entry: ResolvedCopyAssetEntry) {
  if (!entry.transform) {
    return fs.readFileSync(entry.sourceFilePath);
  }

  // Transform receives text content; normalize back to Buffer for emit/write APIs.
  const transformedContent = entry.transform(fs.readFileSync(entry.sourceFilePath, 'utf8'), entry.sourceFilePath);
  return Buffer.isBuffer(transformedContent) ? transformedContent : Buffer.from(transformedContent);
}

/** Resolve response Content-Type from file extension and Content-Type mapping. */
function getContentType(filePath: string, contentTypes: Record<`.${string}`, string>) {
  const extension = path.extname(filePath).toLowerCase() as `.${string}` | '';

  if (!extension) {
    return undefined;
  }

  return contentTypes[extension];
}

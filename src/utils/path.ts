import path from 'node:path';

/** Resolve watcher input path for a raw source pattern. */
export function resolveWatchPath(fromAbsolutePath: string, hasGlobPattern: boolean) {
  return hasGlobPattern ? resolveGlobStaticParent(fromAbsolutePath) : fromAbsolutePath;
}

/** Resolve the base path used to compute request-relative paths for glob matches. */
export function resolveGlobBasePath(fromAbsolutePath: string, rawPattern: string, configDirectory: string) {
  const staticParent = resolveGlobStaticParent(fromAbsolutePath);
  if (path.isAbsolute(rawPattern)) {
    return staticParent;
  }

  return path.resolve(configDirectory, path.relative(configDirectory, staticParent));
}

/** Return the static (non-glob) parent directory of a glob path. */
export function resolveGlobStaticParent(fromAbsolutePath: string) {
  const normalizedPath = toPosixPath(fromAbsolutePath);
  const isAbsolutePath = path.isAbsolute(fromAbsolutePath);
  const segments = normalizedPath.split('/');
  const staticSegments: string[] = [];

  for (const segment of segments) {
    if (segment === '') {
      continue;
    }

    if (hasGlobMagic(segment)) {
      break;
    }

    staticSegments.push(segment);
  }

  const staticPath = staticSegments.length > 0 ? staticSegments.join('/') : '.';
  return isAbsolutePath ? path.resolve('/', staticPath) : path.resolve(staticPath);
}

/** Check whether a path segment contains glob metacharacters. */
export function hasGlobMagic(segment: string) {
  return /[*?[\]{}()!+@]/.test(segment);
}

/** Decode URL pathname safely; return null for malformed percent-encoding. */
export function getDecodedPathname(requestUrl: string) {
  const pathname = requestUrl.split(/[?#]/, 1)[0] || '/';

  try {
    return decodeURIComponent(pathname).replace(/^\/+/, '');
  } catch {
    return null;
  }
}

/** Check whether targetPath is inside parentPath (or exactly equal). */
export function isWithinDirectory(parentPath: string, targetPath: string) {
  const relativePath = path.relative(parentPath, targetPath);
  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
}

/** Join Vite base and relative target path into a normalized request path. */
export function joinRequestPath(basePath: string, targetPath: string) {
  const normalizedBasePath = basePath === '/' ? '' : basePath.replace(/\/$/, '');
  const normalizedTargetPath = targetPath.replace(/^\/+/, '');

  return normalizedBasePath ? `${normalizedBasePath}/${normalizedTargetPath}` : `/${normalizedTargetPath}`;
}

/** Normalize a filesystem path to POSIX separators. */
export function toPosixPath(filePath: string) {
  return filePath.split(path.sep).join('/');
}

/** Convert a POSIX path back to platform-specific separators. */
export function fromPosixPath(filePath: string) {
  return filePath.split('/').join(path.sep);
}

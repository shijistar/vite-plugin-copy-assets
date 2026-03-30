/**
 * A single copy target: maps one or more source glob patterns to a destination directory.
 */
export interface CopyTarget {
  /**
   * One or more glob patterns (relative to the project root) specifying the source files or
   * directories to copy.
   *
   * @example 'public/fonts/**'
   * @example ['public/fonts/**', 'public/images/**']
   */
  src: string | string[];

  /**
   * The destination directory relative to `build.outDir` (during build) or the virtual
   * file-system root served by the dev server (during development).
   *
   * Defaults to `'.'` (the root of the output directory).
   *
   * @example 'assets/fonts'
   */
  dest?: string;

  /**
   * When `true`, the last path component of each matched file is preserved and written directly
   * under `dest`, flattening any intermediate directories.
   *
   * When `false` (the default), the full relative directory structure from the glob base is kept.
   *
   * @default false
   */
  flatten?: boolean;

  /**
   * Override the working directory used to resolve the `src` glob patterns.
   * Defaults to the Vite project root (`config.root`).
   */
  cwd?: string;

  /**
   * Additional options forwarded to `fast-glob` when resolving `src` patterns.
   */
  globOptions?: Record<string, unknown>;
}

/**
 * Options accepted by the `copyAssets` plugin factory function.
 */
export interface CopyAssetsOptions {
  /**
   * An array of copy targets.  Every target that matches at least one file will be processed.
   */
  targets: CopyTarget[];

  /**
   * When `true`, the plugin logs every copied file to the console.
   *
   * @default false
   */
  verbose?: boolean;

  /**
   * Hook at which files are copied during build.
   *
   * - `'writeBundle'` (default) – copies files after Rollup/Rolldown has written all bundles.
   * - `'generateBundle'` – copies files when the bundle is generated (before writing).
   *
   * @default 'writeBundle'
   */
  hook?: 'writeBundle' | 'generateBundle';
}

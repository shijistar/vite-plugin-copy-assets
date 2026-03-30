/** Single copy rule that maps source files to a destination output path. */
export interface CopyAssetPattern {
  /** Source path or glob pattern to match files from the project root. */
  from: string;

  /** Destination path relative to the Vite output directory. */
  to: string;

  /** Optional glob filter options used while resolving source files. */
  globOptions?: {
    /** Include dotfiles in matches. */
    dot?: boolean;

    /** Glob patterns to exclude from matched files. */
    ignore?: string[];
  };

  /** Optional content transformer invoked for each matched file. */
  transform?: (input: string, absoluteFilename: string) => string | Buffer;

  /** When true, overwrite destination files even if they already exist. */
  force?: boolean;
}

/** Plugin-level options for asset copying behavior. */
export interface CopyAssetsPluginOptions {
  /** Extra file-extension to Content-Type mappings. */
  contentTypes?: Record<`.${string}`, string>;
}

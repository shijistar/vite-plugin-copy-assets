import type { CopyAssetPattern } from './types.js';

/** Fully resolved copy entry derived from one source file. */
export interface ResolvedCopyAssetEntry {
  sourceFilePath: string;
  outputFilePath: string;
  requestRelativePath: string;
  transform?: CopyAssetPattern['transform'];
  force: boolean;
}

/** Normalized copy rule used across dev server and build hooks. */
export interface ResolvedCopyAssetPattern {
  from: string;
  to: string;
  fromAbsolutePath: string;
  toAbsolutePath: string;
  sourceType: 'file' | 'collection';
  targetType: 'file' | 'directory';
  watchPath: string;
  devRequestPath: string | null;
  entries: ResolvedCopyAssetEntry[];
  requestEntryMap: Map<string, ResolvedCopyAssetEntry>;
}

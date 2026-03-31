# @tiny-codes/vite-plugin-copy-assets

A Vite plugin for copying static assets with support for:

- Copying files during build
- Serving source assets by target path in development mode
- A workflow similar to Webpack's CopyWebpackPlugin
- glob patterns, content transforms, overwrite strategy, and custom Content-Types

## Features

- Supports file, directory, and glob sources with `dot` and `ignore` filters
- Supports destinations both inside and outside `build.outDir`
- Automatically mounts middleware and file watchers in development
- Uses `emitFile` for in-`outDir` assets and filesystem writes for external targets
- Supports per-file `transform`
- Supports conflict overwrite via `force`
- TypeScript-friendly with exported types

## Installation

```bash
npm i -D @tiny-codes/vite-plugin-copy-assets
```

You can also use:

```bash
pnpm add -D @tiny-codes/vite-plugin-copy-assets
# or
yarn add -D @tiny-codes/vite-plugin-copy-assets
# or
bun add -D @tiny-codes/vite-plugin-copy-assets
```

## Quick Start

In `vite.config.ts`:

```ts
import copyAssets from '@tiny-codes/vite-plugin-copy-assets';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    copyAssets([
      {
        from: 'public/robots.txt',
        to: 'robots.txt',
      },
    ]),
  ],
});
```

## API

```ts
import copyAssets, { type CopyAssetPattern, type CopyAssetsPluginOptions } from '@tiny-codes/vite-plugin-copy-assets';
```

### `copyAssets(patterns, options?)`

- `patterns: CopyAssetPattern[]`
- `options?: CopyAssetsPluginOptions`
- Returns: `Plugin` (Vite plugin instance)

### `CopyAssetPattern`

```ts
interface CopyAssetPattern {
  from: string;
  to: string;
  globOptions?: {
    dot?: boolean;
    ignore?: string[];
  };
  transform?: (input: string, absoluteFilename: string) => string | Buffer;
  force?: boolean;
}
```

Field details:

- `from`
  - Source path, supports:
    - file: `public/logo.svg`
    - directory: `public/assets`
    - glob: `public/**/*.{svg,png}`
  - Relative paths are resolved from the Vite config directory
  - Absolute paths are supported

- `to`
  - Destination path, relative to `build.outDir` when not absolute
  - Can be a file path or directory path (auto-detected)

- `globOptions`
  - Filtering options for glob matching
  - `dot` defaults to `true`
  - `ignore` defaults to `[]`

- `transform`
  - Runs for each matched file
  - `input` is UTF-8 text
  - Return `string | Buffer`

- `force`
  - Enables overwrite when multiple rules target the same output path
  - Defaults to `false`

### `CopyAssetsPluginOptions`

```ts
interface CopyAssetsPluginOptions {
  contentTypes?: Record<`.${string}`, string>;
}
```

Field details:

- `contentTypes`
  - Response `Content-Type` mappings used in development middleware
  - Merged with built-in defaults
  - Example: `{ '.webmanifest': 'application/manifest+json' }`

## Built-in Content-Type Mappings

The plugin includes these defaults:

- `.css` -> `text/css; charset=utf-8`
- `.html` -> `text/html; charset=utf-8`
- `.js` -> `application/javascript; charset=utf-8`
- `.mjs` -> `application/javascript; charset=utf-8`
- `.json` -> `application/json; charset=utf-8`
- `.map` -> `application/json; charset=utf-8`
- `.svg` -> `image/svg+xml`
- `.wasm` -> `application/wasm`
- `.woff` -> `font/woff`
- `.woff2` -> `font/woff2`

## Complete Usage Examples

### 1) File -> file

```ts
copyAssets([
  {
    from: 'public/robots.txt',
    to: 'robots.txt',
  },
]);
```

### 2) File -> directory

```ts
copyAssets([
  {
    from: 'public/robots.txt',
    to: 'static/',
  },
]);
```

Result is typically `dist/static/robots.txt`.

### 3) Directory -> directory (recursive)

```ts
copyAssets([
  {
    from: 'public/assets',
    to: 'assets',
  },
]);
```

### 4) glob -> directory

```ts
copyAssets([
  {
    from: 'public/**/*.{svg,png,webp}',
    to: 'images',
  },
]);
```

### 5) Filter with ignore

```ts
copyAssets([
  {
    from: 'public/**/*',
    to: 'public-files',
    globOptions: {
      ignore: ['**/*.psd', '**/*.sketch'],
    },
  },
]);
```

### 6) Transform file content

```ts
copyAssets([
  {
    from: 'public/version.json',
    to: 'meta/version.json',
    transform(input) {
      const json = JSON.parse(input) as { version: string; buildTime?: string };
      json.buildTime = new Date().toISOString();
      return JSON.stringify(json, null, 2);
    },
  },
]);
```

### 7) Same output path conflict + force

```ts
copyAssets([
  {
    from: 'a/config.json',
    to: 'config.json',
  },
  {
    from: 'b/config.json',
    to: 'config.json',
    force: true,
  },
]);
```

Behavior: the latter rule wins because `force: true`, and a warning is logged.

### 8) Output outside outDir (advanced)

```ts
copyAssets([
  {
    from: 'public/externals/**/*',
    to: '../deploy-assets',
  },
]);
```

Notes:

- Build mode writes directly to the filesystem
- Dev mode does not mount middleware for this rule (warning is logged)

### 9) Custom Content-Type

```ts
copyAssets(
  [
    {
      from: 'public/site.webmanifest',
      to: 'site.webmanifest',
    },
  ],
  {
    contentTypes: {
      '.webmanifest': 'application/manifest+json; charset=utf-8',
    },
  }
);
```

## Runtime Behavior

### Development mode (`vite dev`)

- Adds watcher paths for each rule
- Mounts middleware by destination path when target is inside `outDir`
- Reads and serves source files on demand (with transform support)
- Returns `403 Forbidden` for unmatched request paths

### Build mode (`vite build`)

- Targets inside `outDir`: emitted via `emitFile`
- Targets outside `outDir`: written in `closeBundle`

## Path Resolution and Inference Rules

- Relative `from` paths are resolved from the Vite config directory
- Relative `to` paths are resolved from `build.outDir`
- Collection sources (directory/glob) always treat destination as directory
- Target type inference order:
  - collection source -> directory
  - `to` ends with `/` or `\\` -> directory
  - existing target path is a directory -> directory
  - `to` has extension -> file
  - otherwise -> directory

## Errors and Warnings

The plugin throws errors when:

- `from` is non-glob and does not exist
- no files are matched
- a collection source targets a single file

The plugin logs warnings when:

- a target path is overwritten by a later rule with `force: true`
- a target is outside `outDir`, so dev middleware is skipped

## Compatibility

- Node.js: `>=22`
- Vite: recent versions recommended (this project currently uses Vite 8 in development)

## FAQ

### 1) Why are some assets unavailable in dev mode?

Common reasons:

- The rule targets a path outside `outDir` (no dev middleware)
- The request path does not match the destination path
- The file is not matched or was excluded by `ignore`

### 2) Why does transform receive a string?

This is by design. The plugin reads input as UTF-8 text before calling `transform`, and accepts either string or Buffer as return value.

### 3) Which rule wins for the same output path?

By default, first match wins. A later rule only overrides when `force: true` is set.

## License

MIT

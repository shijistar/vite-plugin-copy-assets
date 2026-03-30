# vite-plugin-copy-assets

A **Vite 8** plugin for copying static assets to the output directory, with support for development-time request serving via dev-server middleware. Similar to Webpack's [`CopyWebpackPlugin`](https://webpack.js.org/plugins/copy-webpack-plugin/).

---

## Features

- 📁 Copies files and directories matching **glob patterns** into the Vite output folder
- 🔄 Works during both **build** and **dev** (files are served by the dev server without being copied)
- 🗂️ Supports preserving **directory structure** or **flattening** all files into the destination
- 🎯 Multiple copy **targets** with individual options
- ✅ Full **TypeScript** support with exported types

---

## Installation

```bash
npm install -D vite-plugin-copy-assets
# or
yarn add -D vite-plugin-copy-assets
# or
pnpm add -D vite-plugin-copy-assets
```

---

## Usage

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import copyAssets from 'vite-plugin-copy-assets';

export default defineConfig({
  plugins: [
    copyAssets({
      targets: [
        // Copy all font files from vendor/fonts into dist/assets/fonts
        { src: 'vendor/fonts/**', dest: 'assets/fonts' },

        // Copy images, keeping the sub-directory structure
        { src: 'src/static/images/**', dest: 'images' },

        // Copy files from node_modules, flatten into one directory
        { src: 'node_modules/some-lib/dist/icons/**', dest: 'icons', flatten: true },
      ],
    }),
  ],
});
```

---

## Options

### `CopyAssetsOptions`

| Option     | Type                                    | Default         | Description                                                                                 |
|------------|-----------------------------------------|-----------------|---------------------------------------------------------------------------------------------|
| `targets`  | `CopyTarget[]`                          | **required**    | List of copy targets (see below).                                                           |
| `verbose`  | `boolean`                               | `false`         | Log every copied file path to the console.                                                  |
| `hook`     | `'writeBundle' \| 'generateBundle'`     | `'writeBundle'` | Rolldown/Rollup lifecycle hook at which files are copied during build.                      |

### `CopyTarget`

| Option        | Type                      | Default       | Description                                                                                      |
|---------------|---------------------------|---------------|--------------------------------------------------------------------------------------------------|
| `src`         | `string \| string[]`      | **required**  | One or more glob patterns (relative to the project root by default) matching source files.       |
| `dest`        | `string`                  | `'.'`         | Destination directory relative to `build.outDir` (build) or the dev server root (dev).          |
| `flatten`     | `boolean`                 | `false`       | When `true`, only the file's basename is kept—intermediate directories are not preserved.        |
| `cwd`         | `string`                  | project root  | Override the working directory used to resolve `src` glob patterns.                             |
| `globOptions` | `Record<string, unknown>` | `{}`          | Extra options forwarded to [`fast-glob`](https://github.com/mrmlnc/fast-glob).                  |

---

## How It Works

### Build mode

After Rolldown/Rollup has written all bundles (`writeBundle` hook by default), the plugin resolves each target's glob patterns, then copies matching files into the appropriate sub-directories of `build.outDir`, maintaining the original directory structure (or flattening, if configured).

### Dev mode

The plugin registers a Vite dev-server middleware. When the browser requests a path that matches a copy target, the plugin streams the corresponding source file directly without writing it to disk.

---

## License

MIT

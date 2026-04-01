# @tiny-codes/vite-plugin-copy-assets

## v1.0.2

`2026-04-01`

### Features

- Declare peer dependency on `rolldown ^1.0.0-rc.9`

## v1.0.1

`2026-04-01`

### Features

- Declare peer dependency on `vite >=8.0.0`
- Require `Node.js >=20`

## v1.0.0

`2026-03-31`

Publish the first version of the Vite plugin for copying static assets.

### Features

1. Supports file, directory, and glob sources.
2. Supports targets both inside and outside `build.outDir`.
3. Proxies assets by target path in development and watches source changes.
4. Uses `emitFile` inside `outDir` and direct filesystem writes outside it.
5. Supports `transform`, `force`, and custom Content-Types.
6. Exports TypeScript types.

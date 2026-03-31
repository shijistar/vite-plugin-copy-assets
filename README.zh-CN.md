[English](./README.md) | [中文](./README.zh-CN.md) | [CHANGELOG](./CHANGELOG.md)

# @tiny-codes/vite-plugin-copy-assets

一个用于 Vite 的静态资源复制插件，支持：

- 构建时复制文件到目标目录
- 开发模式下按目标路径实时代理源文件
- 类似 Webpack 的 CopyWebpackPlugin 用法
- 支持 glob、内容转换、覆盖策略、自定义 Content-Type

## 特性

- 支持文件、目录、glob 来源，可配置 `dot` 和 `ignore` 过滤
- 支持输出到 `build.outDir` 内或外
- 开发模式按目标路径代理资源，并监听源文件变化
- 构建时自动选择 `emitFile` 或直接写入文件系统
- 支持 `transform`、`force` 和自定义 Content-Type
- 导出 TypeScript 类型，便于在项目中直接使用

## 安装

```bash
npm i -D @tiny-codes/vite-plugin-copy-assets
```

也可使用：

```bash
pnpm add -D @tiny-codes/vite-plugin-copy-assets
# 或
yarn add -D @tiny-codes/vite-plugin-copy-assets
# 或
bun add -D @tiny-codes/vite-plugin-copy-assets
```

## 快速开始

在 `vite.config.ts` 中：

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
- 返回：`Plugin`（Vite 插件实例）

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

字段说明：

- `from`
  - 源路径，支持：
    - 单文件：`public/logo.svg`
    - 目录：`public/assets`
    - glob：`public/**/*.{svg,png}`
  - 相对路径基于 Vite 配置文件目录解析
  - 绝对路径可直接使用

- `to`
  - 目标路径，相对时基于 `build.outDir`
  - 可为文件或目录，最终类型会自动推断

- `globOptions`
  - 传递给 glob 的筛选选项
  - `dot` 默认 `true`
  - `ignore` 默认 `[]`

- `transform`
  - 对每个匹配文件执行转换
  - 入参 `input` 为 UTF-8 文本
  - 返回 `string | Buffer`

- `force`
  - 同一输出路径发生冲突时，是否覆盖已有胜出项
  - 默认 `false`

### `CopyAssetsPluginOptions`

```ts
interface CopyAssetsPluginOptions {
  contentTypes?: Record<`.${string}`, string>;
}
```

字段说明：

- `contentTypes`
  - 开发模式响应头 `Content-Type` 映射表
  - 会和内置默认映射合并
  - 示例：`{ '.webmanifest': 'application/manifest+json' }`

## 内置 Content-Type 映射

默认内置以下扩展名：

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

## 全部用法示例

### 1) 单文件 -> 单文件

```ts
copyAssets([
  {
    from: 'public/robots.txt',
    to: 'robots.txt',
  },
]);
```

### 2) 单文件 -> 目录

```ts
copyAssets([
  {
    from: 'public/robots.txt',
    to: 'static/',
  },
]);
```

结果通常为：`dist/static/robots.txt`

### 3) 目录 -> 目录（递归）

```ts
copyAssets([
  {
    from: 'public/assets',
    to: 'assets',
  },
]);
```

### 4) glob -> 目录

```ts
copyAssets([
  {
    from: 'public/**/*.{svg,png,webp}',
    to: 'images',
  },
]);
```

### 5) 使用 ignore 过滤

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

### 6) 使用 transform 修改内容

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

### 7) 多规则同目标冲突 + force

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

行为：后者因 `force: true` 覆盖前者，并输出 warning 日志。

### 8) 输出到 outDir 外（高级用法）

```ts
copyAssets([
  {
    from: 'public/externals/**/*',
    to: '../deploy-assets',
  },
]);
```

说明：

- 构建时会直接写文件系统
- 开发模式不会为该规则挂载代理路径（会提示 warning）

### 9) 自定义 Content-Type

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

## 行为说明

### 开发模式（`vite dev`）

- 为每条规则添加 watcher
- 若目标位于 `outDir` 内，会按目标路径挂载中间件
- 请求命中时直接读取源文件并返回（可带 transform）
- 请求未命中返回 `403 Forbidden`

### 构建模式（`vite build`）

- 目标在 `outDir` 内：通过 `emitFile` 输出资源
- 目标在 `outDir` 外：在 `closeBundle` 阶段直接写入磁盘

## 路径与推断规则

- `from` 相对路径：基于 Vite 配置文件目录
- `to` 相对路径：基于 `build.outDir`
- 若来源为集合（目录或 glob），目标强制视为目录
- 目标是否为文件的判断顺序：
  - 来源是集合 -> 目录
  - `to` 以 `/` 或 `\\` 结尾 -> 目录
  - 目标已存在且是目录 -> 目录
  - 否则若 `to` 有扩展名 -> 文件
  - 其他情况 -> 目录

## 错误与警告

插件会在以下场景抛错：

- 非 glob 且 `from` 不存在
- 匹配结果为空
- 集合来源尝试写入单文件目标

插件会在以下场景告警：

- 同一目标路径被 `force: true` 覆盖
- 目标在 `outDir` 外，开发模式跳过代理

## 兼容性

- Node.js: `>=22`
- Vite: 建议使用较新版本（项目当前开发依赖为 Vite 8）

## 常见问题

### 1) 为什么开发模式访问不到某些资源？

常见原因：

- 该规则目标在 `outDir` 外，开发模式不会挂载代理
- 请求路径与 `to` 不匹配
- 资源未命中或被 ignore 排除

### 2) transform 为什么拿到的是字符串？

这是设计行为。插件会按 UTF-8 读取输入并传给 `transform`，你可以返回字符串或 Buffer。

### 3) 同一目标路径到底谁生效？

默认“先到先得”；只有后续规则设置 `force: true` 时才会覆盖。

## License

MIT

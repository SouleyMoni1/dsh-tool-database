/**
 * 插件入口 shim。
 *
 * DSH 0.2.x 的 profile 层解析器（`@deepseek-ai/dsh-app-boot` 的 `ResolutionRouter.routeScoped`）
 * 在路由 CJS require 时执行 `for (const p of createRequire(parent).resolve.paths(name))`；
 * 对内建模块名（如 `process`）Node 返回 `null`，该处没有 `?? []` 兜底，于是抛
 * `TypeError: createRequire.resolve.paths is not a function or its return value is not iterable`，
 * 插件在 import 阶段就失败（启动日志：`failed to import`）。
 *
 * 各数据库驱动（mssql / pg / mysql2）的 CJS 依赖链里都有这种写法，
 * 所以这里在加载实现之前把这类请求直接短路：内建模块的正常解析结果就是请求本身，
 * 行为与 Node 原生一致，只是绕开宿主那段会崩的路径。宿主修好后本文件可以删掉。
 */

import { builtinModules, createRequire } from 'node:module'

interface NodeModuleInternals {
  _resolveFilename: (
    request: string,
    parent: unknown,
    isMain: boolean,
    options: unknown,
  ) => string
}

const internals = createRequire(import.meta.url)('node:module') as NodeModuleInternals
const originalResolve = internals._resolveFilename
const builtins = new Set(builtinModules)

internals._resolveFilename = function patchedResolve(
  request: string,
  parent: unknown,
  isMain: boolean,
  options: unknown,
): string {
  if (typeof request === 'string' && !request.startsWith('node:')) {
    const bare = request.replace(/\/+$/, '')
    if (builtins.has(bare)) return bare
  }
  return originalResolve.call(this, request, parent, isMain, options)
}

const plugin = await import('./index.js')

export const name = plugin.name
export const inject = plugin.inject
export const apply = plugin.apply

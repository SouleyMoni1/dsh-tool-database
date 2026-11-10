/**
 * sources.json / config.json 的读写与增删改 —— 宿主侧唯一写入口。
 *
 * 写入是「同目录临时文件 + rename」，避免半截文件被 mtime 热加载读到；
 * 字段顺序固定，便于人工 diff。
 */

import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import {
  consoleConfigPath,
  defaultSourcesPath,
  engineInfo,
  engineOf,
  parseSources,
  stageOf,
  type ConsoleConfig,
  type SourceConfig,
} from './core.js'

/** 读清单文件；文件不存在视为空清单，JSON 非法则明确报错。 */
export function readSourcesFile(path: string): SourceConfig[] {
  let text: string
  try {
    text = readFileSync(path, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
  if (!text.trim()) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (error) {
    throw new Error('db: ' + path + ' 不是合法 JSON: ' + (error as Error).message)
  }
  return parseSources(parsed)
}

function toStored(source: SourceConfig): Record<string, unknown> {
  const out: Record<string, unknown> = { id: source.id, engine: engineOf(source), stage: stageOf(source) }
  if (source.description) out.description = source.description
  out.host = source.host
  out.port = source.port ?? engineInfo(engineOf(source)).defaultPort
  if (source.database) out.database = source.database
  if (source.user) out.user = source.user
  if (source.passwordEnv) out.passwordEnv = source.passwordEnv
  else if (source.password !== undefined) out.password = source.password
  out.writable = source.writable === true
  if (source.allowDdl) out.allowDdl = true
  if (source.allowBatch === false) out.allowBatch = false
  if (source.ssl) out.ssl = true
  if (source.encrypt) out.encrypt = true
  if (source.trustServerCertificate === false) out.trustServerCertificate = false
  if (source.requestTimeoutMs) out.requestTimeoutMs = source.requestTimeoutMs
  return out
}

/** 原子写回清单文件。 */
export function writeSourcesFile(path: string, sources: SourceConfig[]): void {
  mkdirSync(dirname(path), { recursive: true })
  const body = JSON.stringify(sources.map(toStored), null, 2) + '\n'
  const tmp = path + '.tmp'
  writeFileSync(tmp, body, 'utf8')
  renameSync(tmp, path)
}

/** 按 id 新增或替换；originalId 是改名前的 id。 */
export function upsertSource(
  list: SourceConfig[],
  source: SourceConfig,
  originalId?: string,
): SourceConfig[] {
  const key = originalId ?? source.id
  const index = list.findIndex((item) => item.id === key)
  const clash = list.findIndex((item) => item.id === source.id)
  if (clash >= 0 && clash !== index) throw new Error('db: 源 id 已存在: ' + source.id)
  if (index < 0) return [...list, source]
  const next = [...list]
  next[index] = source
  return next
}

/** 删除一个源。 */
export function removeSource(list: SourceConfig[], id: string): SourceConfig[] {
  const next = list.filter((item) => item.id !== id)
  if (next.length === list.length) throw new Error('db: 源不存在: ' + id)
  return next
}

const DEFAULT_CONSOLE: ConsoleConfig = { writeMode: 'source', limit: 100 }

/** 读控制台配置；文件不存在/非法时回落到默认值。 */
export function readConsoleConfig(path: string = consoleConfigPath()): ConsoleConfig {
  let text: string
  try {
    text = readFileSync(path, 'utf8')
  } catch {
    return { ...DEFAULT_CONSOLE }
  }
  try {
    const parsed = JSON.parse(text) as Partial<ConsoleConfig>
    const writeMode =
      parsed.writeMode === 'readonly' || parsed.writeMode === 'always' || parsed.writeMode === 'source'
        ? parsed.writeMode
        : DEFAULT_CONSOLE.writeMode
    const limit = typeof parsed.limit === 'number' && parsed.limit > 0 ? Math.floor(parsed.limit) : DEFAULT_CONSOLE.limit
    return { writeMode, limit }
  } catch {
    return { ...DEFAULT_CONSOLE }
  }
}

/** 原子写回控制台配置。 */
export function writeConsoleConfig(config: ConsoleConfig, path: string = consoleConfigPath()): void {
  mkdirSync(dirname(path), { recursive: true })
  const body = JSON.stringify({ writeMode: config.writeMode, limit: config.limit }, null, 2) + '\n'
  const tmp = path + '.tmp'
  writeFileSync(tmp, body, 'utf8')
  renameSync(tmp, path)
}

/**
 * 首次启动迁移：新路径没有清单而老插件（dsh-tool-mssql）有 → 复制一份过来。
 * 只复制不删除，老版本仍可回退。
 */
export function migrateLegacySources(legacy: string, target: string = defaultSourcesPath()): boolean {
  if (existsSync(target) || !existsSync(legacy)) return false
  mkdirSync(dirname(target), { recursive: true })
  copyFileSync(legacy, target)
  return true
}

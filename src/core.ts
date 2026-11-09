/**
 * dsh-tool-database 核心模型（纯函数、可单测）。
 *
 * 一个插件同时支持 SQL Server / PostgreSQL / MySQL：
 * - 源配置里用 engine 区分方言，缺省 sqlserver（兼容老清单）；
 * - 工具层只认「源句柄」，方言细节都在 src/engines/*；
 * - 凭据边界：describeSource 只输出主机/端口/库名/账号与「是否已配密码」，永不返回密码。
 */

import { homedir } from 'node:os'
import { join } from 'node:path'

export const MAX_ROWS = 500
export const DEFAULT_ROWS = 100
export const DEFAULT_REQUEST_TIMEOUT_MS = 15_000
export const DEFAULT_CONNECT_TIMEOUT_MS = 15_000

/** 支持的引擎。 */
export type EngineKind = 'sqlserver' | 'postgres' | 'mysql'

export interface EngineInfo {
  kind: EngineKind
  /** 界面与提示里用的名字。 */
  label: string
  defaultPort: number
  /** DSN 接受的 scheme。 */
  schemes: string[]
  /** 默认库名（MySQL 没有库时用 information_schema，Postgres 用 postgres）。 */
  defaultDatabase?: string
}

export const ENGINES: EngineInfo[] = [
  { kind: 'sqlserver', label: 'SQL Server', defaultPort: 1433, schemes: ['sqlserver', 'mssql', 'tds'] },
  { kind: 'postgres', label: 'PostgreSQL', defaultPort: 5432, schemes: ['postgres', 'postgresql', 'pg'] },
  { kind: 'mysql', label: 'MySQL', defaultPort: 3306, schemes: ['mysql'] },
]

/** 数据源用途分类：界面只给这三档。 */
export type StageKind = 'dev' | 'test' | 'prod'

export interface StageInfo {
  kind: StageKind
  label: string
  /** 分组展示顺序。 */
  order: number
}

export const STAGES: StageInfo[] = [
  { kind: 'dev', label: '开发', order: 0 },
  { kind: 'test', label: '测试', order: 1 },
  { kind: 'prod', label: '正式', order: 2 },
]

/** 老清单没有 stage 时的缺省分类。 */
export const DEFAULT_STAGE: StageKind = 'prod'

export function stageInfo(kind: StageKind): StageInfo {
  const found = STAGES.find((item) => item.kind === kind)
  if (!found) throw new Error('db: 不支持的类型: ' + String(kind))
  return found
}

export function stageOf(source: SourceConfig): StageKind {
  return source.stage ?? DEFAULT_STAGE
}

export function stageLabel(kind: StageKind): string {
  return stageInfo(kind).label
}

/**
 * 老清单没写 stage 时按别名 / 描述 / 库名里的字样推断：
 * 出现 DEV / DEVELOP 视为开发库，TEST / QA / UAT / STAGING 视为测试库，其余按正式库。
 * 只用于读时兜底，保存时会把推断结果写回清单固定下来。
 */
export function inferStage(...texts: Array<string | undefined>): StageKind {
  const hay = texts.filter((text) => Boolean(text)).join(' ').toUpperCase()
  const word = (needle: string): boolean => new RegExp('(^|[^A-Z])' + needle + '([^A-Z]|$)').test(hay)
  if (word('DEV') || word('DEVELOP')) return 'dev'
  if (word('TEST') || word('QA') || word('UAT') || word('STAGING')) return 'test'
  return 'prod'
}

export function engineInfo(kind: EngineKind): EngineInfo {
  const found = ENGINES.find((item) => item.kind === kind)
  if (!found) throw new Error('db: 不支持的引擎: ' + String(kind))
  return found
}

export function engineOf(source: SourceConfig): EngineKind {
  return source.engine ?? 'sqlserver'
}

export function defaultPortOf(source: SourceConfig): number {
  return source.port ?? engineInfo(engineOf(source)).defaultPort
}

export interface SourceConfig {
  id: string
  /** 缺省 sqlserver（兼容老清单）。 */
  engine?: EngineKind
  /** 用途分类，缺省 prod（兼容老清单）。 */
  stage?: StageKind
  description?: string
  /** 主机名 / IP。 */
  host: string
  /** 老字段名，读清单时自动并入 host。 */
  server?: string
  port?: number
  database?: string
  user?: string
  password?: string
  passwordEnv?: string
  /** TLS：PostgreSQL / MySQL 用 ssl，SQL Server 用 encrypt。 */
  ssl?: boolean
  encrypt?: boolean
  trustServerCertificate?: boolean
  /** 默认 false（只读）。只有显式 writable: true 才开放写通道。 */
  writable?: boolean
  /** 允许 DDL（CREATE / ALTER / DROP / TRUNCATE）。默认 false。 */
  allowDdl?: boolean
  /** 写通道允许分号分隔的批量语句。默认 false。 */
  allowBatch?: boolean
  requestTimeoutMs?: number
}

/** 面向模型的源描述：不含密码，也不含完整 DSN。 */
export interface SourceView {
  id: string
  engine: EngineKind
  /** 用途分类：dev / test / prod。 */
  stage: StageKind
  stageLabel: string
  description?: string
  host: string
  port: number
  database?: string
  user?: string
  hasPassword: boolean
  writable: boolean
  allowDdl: boolean
}

export interface SerializedRows {
  columns: string[]
  rows: unknown[][]
  truncated: boolean
  rowCount: number
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined
}

/** 解析 "schema.table" / "table" / "\"schema\".\"table\"" / `schema`.`table`。 */
export function parseTableRef(ref: string, defaultSchema = 'dbo'): { schema: string; name: string } {
  const cleaned = String(ref ?? '').trim()
  if (!cleaned) throw new Error('db: 表名不能为空')
  const parts = cleaned
    .split('.')
    .map((p) => p.trim().replace(/^[\[\"`]|[\]\"`]$/g, '').replaceAll(']]', ']'))
  if (parts.length === 1) return { schema: defaultSchema, name: parts[0] as string }
  const name = parts[parts.length - 1] as string
  const schema = parts[parts.length - 2] as string
  if (!name || !schema) throw new Error('db: 表名无法解析: ' + ref)
  return { schema, name }
}

/** 列类型格式化：带上长度/精度，便于模型直接写 SQL。 */
export function formatColumnType(row: {
  type: string
  max_length?: number | null
  precision?: number | null
  scale?: number | null
  engine?: EngineKind
}): string {
  const t = String(row.type ?? '').toLowerCase()
  const len = row.max_length ?? null
  const engine = row.engine ?? 'sqlserver'
  if (engine === 'sqlserver') {
    if (['varchar', 'char', 'varbinary', 'binary'].includes(t)) {
      return t + '(' + (len === -1 ? 'max' : String(len ?? '')) + ')'
    }
    if (['nvarchar', 'nchar'].includes(t)) {
      return t + '(' + (len === -1 ? 'max' : String(len === null ? '' : len / 2)) + ')'
    }
  } else if (['character varying', 'varchar', 'char', 'character', 'binary', 'varbinary'].includes(t)) {
    if (len !== null && len !== undefined) return t + '(' + String(len) + ')'
  }
  if (['decimal', 'numeric'].includes(t)) {
    return t + '(' + String(row.precision ?? '') + ',' + String(row.scale ?? '') + ')'
  }
  return t
}

/** 把驱动返回值收敛成 JSON 可序列化形态。 */
export function normalizeValue(value: unknown): unknown {
  if (value === null || value === undefined) return null
  const t = typeof value
  if (t === 'bigint') return (value as bigint).toString()
  if (t === 'string' || t === 'number' || t === 'boolean') return value
  if (value instanceof Date) return value.toISOString()
  if (Buffer.isBuffer(value)) return '0x' + value.toString('hex')
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

/** 行数收敛：默认 100、硬上限 500。 */
export function clampLimit(limit?: number, fallback = DEFAULT_ROWS): number {
  const n = typeof limit === 'number' && Number.isFinite(limit) ? Math.floor(limit) : fallback
  return Math.max(1, Math.min(n, MAX_ROWS))
}

/** 把「列名 + 行数组」收敛成 SerializedRows（各引擎驱动统一出口）。 */
export function serializeRows(
  rows: unknown[][],
  columns: string[],
  cap: number,
): SerializedRows {
  return {
    columns,
    rows: rows.slice(0, cap).map((row) => row.map((value) => normalizeValue(value))),
    truncated: rows.length > cap,
    rowCount: rows.length,
  }
}

/** 校验并归一化源清单；任何非法项都直接抛错（启动即暴露，不静默降级）。 */
export function parseSources(raw: unknown): SourceConfig[] {
  if (!Array.isArray(raw)) throw new Error('db: sources 必须是数组')
  const seen = new Set<string>()
  return raw.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error('db: sources[' + String(index) + '] 必须是对象')
    }
    const s = item as Record<string, unknown>
    const id = str(s.id)
    if (!id) throw new Error('db: sources[' + String(index) + '].id 不能为空')
    if (seen.has(id)) throw new Error('db: sources 里 id 重复: ' + id)
    seen.add(id)
    const engine = (str(s.engine) ?? 'sqlserver') as EngineKind
    if (!ENGINES.some((e) => e.kind === engine)) {
      throw new Error('db: 源 ' + id + ' 的 engine 不支持: ' + String(s.engine))
    }
    const declared = str(s.stage)
    const stage = (declared ?? inferStage(id, str(s.description), str(s.database), str(s.host))) as StageKind
    if (declared !== undefined && !STAGES.some((item) => item.kind === declared)) {
      throw new Error('db: 源 ' + id + ' 的 stage 不支持: ' + String(declared) + '（只允许 dev / test / prod）')
    }
    const host = str(s.host) ?? str(s.server)
    if (!host) throw new Error('db: 源 ' + id + ' 缺少 host')
    const port = s.port === undefined ? engineInfo(engine).defaultPort : Number(s.port)
    if (!Number.isInteger(port) || port <= 0 || port > 65535) {
      throw new Error('db: 源 ' + id + ' 的 port 非法: ' + String(s.port))
    }
    return {
      id,
      engine,
      stage,
      description: str(s.description),
      host,
      server: host,
      port,
      database: str(s.database),
      user: str(s.user),
      password: str(s.password),
      passwordEnv: str(s.passwordEnv),
      ssl: s.ssl === true,
      encrypt: s.encrypt === true,
      trustServerCertificate: s.trustServerCertificate !== false,
      writable: s.writable === true,
      allowDdl: s.allowDdl === true,
      allowBatch: s.allowBatch === true,
      requestTimeoutMs:
        typeof s.requestTimeoutMs === 'number' && s.requestTimeoutMs > 0
          ? Math.floor(s.requestTimeoutMs)
          : undefined,
    } satisfies SourceConfig
  })
}

/** 面向模型的源视图：刻意不含 password，也不含 passwordEnv 的取值。 */
export function describeSource(source: SourceConfig): SourceView {
  const engine = engineOf(source)
  const stage = stageOf(source)
  return {
    id: source.id,
    engine,
    stage,
    stageLabel: stageLabel(stage),
    description: source.description,
    host: source.host,
    port: defaultPortOf(source),
    database: source.database,
    user: source.user,
    hasPassword: Boolean(source.passwordEnv || source.password),
    writable: source.writable === true,
    allowDdl: source.allowDdl === true,
  }
}

/** 取密码：passwordEnv 优先（推荐），否则用明文 password（仅存于宿主侧）。 */
export function resolvePassword(
  source: SourceConfig,
  env: Record<string, string | undefined> = process.env,
): string | undefined {
  if (source.passwordEnv) {
    const value = env[source.passwordEnv]
    if (!value) {
      throw new Error('db: 源 ' + source.id + ' 引用的环境变量 ' + source.passwordEnv + ' 未设置或为空')
    }
    return value
  }
  return source.password
}

export function dshHome(env: Record<string, string | undefined> = process.env): string {
  return env.DSH_HOME && env.DSH_HOME.trim() !== '' ? env.DSH_HOME : join(homedir(), '.dsh')
}

/** 清单默认落盘位置：$DSH_HOME/database-tool/sources.json。 */
export function defaultSourcesPath(env: Record<string, string | undefined> = process.env): string {
  return join(dshHome(env), 'database-tool', 'sources.json')
}

/** 老版本（dsh-tool-mssql 0.1.x）的清单位置，用于首次自动迁移。 */
export function legacySourcesPath(env: Record<string, string | undefined> = process.env): string {
  return join(dshHome(env), 'mssql-tool', 'sources.json')
}

/** 控制台全局配置：$DSH_HOME/database-tool/config.json。 */
export function consoleConfigPath(env: Record<string, string | undefined> = process.env): string {
  return join(dshHome(env), 'database-tool', 'config.json')
}

/** 控制台写策略：source=跟随源的 writable（默认）、readonly=一律只读、always=始终允许写。 */
export type ConsoleWriteMode = 'source' | 'readonly' | 'always'

export interface ConsoleConfig {
  writeMode: ConsoleWriteMode
  limit: number
}

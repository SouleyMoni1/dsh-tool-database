/**
 * 浏览器侧（侧栏面板 / 设置页）到宿主的 RPC。
 *
 * 端点：
 *   sources/list     列出源 + 引擎元数据 + 控制台配置
 *   sources/save     新增/修改一个源（写 sources.json）
 *   sources/remove   删除一个源
 *   sources/test     试连（已保存的 id，或表单里还没保存的配置）
 *   query/run        控制台执行一条 SQL（护栏与写闸门跟模型工具一致）
 *   console/save     保存控制台配置（写策略 / 默认行数）
 */

import { homedir } from 'node:os'
import type { Context } from '@deepseek-ai/cordis'
import {
  ENGINES,
  STAGES,
  clampLimit,
  consoleConfigPath,
  engineInfo,
  engineOf,
  stageLabel,
  stageOf,
  type ConsoleConfig,
  type ConsoleWriteMode,
  type EngineKind,
  type SourceConfig,
  type StageKind,
} from './core.js'
import { PASSWORD_SENTINEL, envNameOf, formatDsn, parseDsn } from './dsn.js'
import { assertReadonlySql, assertWriteSql, isDdlSql, isWriteSql } from './sql-guard.js'
import { readConsoleConfig, readSourcesFile, removeSource, upsertSource, writeConsoleConfig, writeSourcesFile } from './settings-store.js'

/**
 * 浏览器侧要打的路由与通道名（两边必须一致）。
 * 路由必须落在 /api 下 —— connection 的 assertFetchRoute 只接受 /api/<endpoint>。
 */
export const RPC_PATH = '/api/dsh-tool-database'
const CHANNEL = RPC_PATH

interface FetchRouteSpec {
  path: string
  methods: string[]
  requestBody: 'buffered'
  fetch: (request: Request) => Promise<Response>
}

interface ConnectionLike {
  fetch: { register: (spec: FetchRouteSpec) => () => void }
}

export interface SettingsRpcDeps {
  /** sources.json 路径。 */
  filePath: () => string
  /** 源是不是来自插件 config.sources。 */
  configDriven: () => boolean
  /** 当前生效的源列表。 */
  list: () => SourceConfig[]
  /** 清掉宿主侧缓存，让下一次读重新解析文件。 */
  invalidate: () => void
  /** 试连。 */
  probe: (source: SourceConfig) => Promise<{ version: string; database: string }>
  /** 控制台只读查询。 */
  query: (source: SourceConfig, sql: string, limit: number) => Promise<unknown>
  /** 控制台写执行。 */
  execute: (source: SourceConfig, sql: string) => Promise<unknown>
}

interface SourceInput {
  id?: unknown
  engine?: unknown
  stage?: unknown
  description?: unknown
  host?: unknown
  port?: unknown
  database?: unknown
  user?: unknown
  password?: unknown
  passwordEnv?: unknown
  ssl?: unknown
  encrypt?: unknown
  writable?: unknown
  allowDdl?: unknown
  allowBatch?: unknown
  dsn?: unknown
}

type RpcResult = { ok: true; value: unknown } | { ok: false; error: { message: string } }

const ok = (value: unknown): RpcResult => ({ ok: true, value })
const fail = (error: unknown): RpcResult => ({
  ok: false,
  error: { message: error instanceof Error ? error.message : String(error) },
})

/** 界面展示用路径：家目录前缀缩成 ~，避免页面里露出用户名。 */
function displayPath(path: string): string {
  const home = homedir()
  if (!home) return path
  if (path === home) return '~'
  if (path.toLowerCase().startsWith(home.toLowerCase())) return '~' + path.slice(home.length)
  return path
}

function text(value: unknown): string | undefined {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  return trimmed ? trimmed : undefined
}

function bool(value: unknown): boolean {
  return value === true
}

/** 源 → 界面视图（dsn 给列表看，dsnEdit 给编辑表单；两者都不含环境变量真实值）。 */
function viewOf(source: SourceConfig): Record<string, unknown> {
  const engine = engineOf(source)
  const stage = stageOf(source)
  return {
    id: source.id,
    engine,
    engineLabel: engineInfo(engine).label,
    stage,
    stageLabel: stageLabel(stage),
    description: source.description ?? '',
    host: source.host,
    port: source.port ?? engineInfo(engine).defaultPort,
    database: source.database ?? '',
    user: source.user ?? '',
    ssl: source.ssl === true || source.encrypt === true,
    writable: source.writable === true,
    allowDdl: source.allowDdl === true,
    allowBatch: source.allowBatch === true,
    hasPassword: Boolean(source.passwordEnv || source.password),
    passwordEnv: source.passwordEnv ?? '',
    dsn: formatDsn(source, { mask: true }),
    dsnEdit: formatDsn(source),
  }
}

/** 密码三态：占位=沿用原值，${ENV}=改用环境变量，其余=明文。 */
function secretOf(
  password: string | undefined,
  existing: SourceConfig | undefined,
): Pick<SourceConfig, 'password' | 'passwordEnv'> {
  if (password === undefined) return existing ? { password: existing.password, passwordEnv: existing.passwordEnv } : {}
  if (password === PASSWORD_SENTINEL) {
    return existing ? { password: existing.password, passwordEnv: existing.passwordEnv } : {}
  }
  const env = envNameOf(password)
  if (env) return { passwordEnv: env }
  if (!password) return { password: undefined, passwordEnv: undefined }
  return { password }
}

function engineOfInput(value: unknown, fallback: EngineKind): EngineKind {
  const raw = text(value)
  if (!raw) return fallback
  if (!ENGINES.some((item) => item.kind === raw)) throw new Error('db: 不支持的引擎: ' + raw)
  return raw as EngineKind
}

function stageOfInput(value: unknown, fallback: StageKind): StageKind {
  const raw = text(value)
  if (!raw) return fallback
  if (!STAGES.some((item) => item.kind === raw)) {
    throw new Error('db: 不支持的类型: ' + raw + '（只允许 dev / test / prod）')
  }
  return raw as StageKind
}

/** 表单输入 → 源配置：结构化字段优先，填了 dsn 且没填 host 时按 dsn 解析。 */
function buildSource(input: SourceInput, existing: SourceConfig | undefined): SourceConfig {
  const id = text(input.id)
  if (!id) throw new Error('db: 别名（id）不能为空')
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(id)) {
    throw new Error('db: 别名只能用字母/数字/下划线/点/连字符，且以字母或数字开头')
  }
  const dsn = text(input.dsn)
  const fallbackEngine = existing ? engineOf(existing) : 'sqlserver'
  let engine = engineOfInput(input.engine, fallbackEngine)
  let host = text(input.host)
  let port = input.port === undefined || input.port === '' ? undefined : Number(input.port)
  let database = text(input.database)
  let user = text(input.user)
  let password = text(input.password)
  if (dsn && !host) {
    const parsed = parseDsn(dsn)
    engine = parsed.engine
    host = parsed.host
    port = parsed.port
    database = parsed.database
    user = parsed.user
    password = parsed.password
  }
  if (!host) throw new Error('db: 主机（host）不能为空')
  const info = engineInfo(engine)
  const finalPort = port === undefined ? info.defaultPort : port
  if (!Number.isInteger(finalPort) || finalPort <= 0 || finalPort > 65535) {
    throw new Error('db: 端口非法: ' + String(input.port))
  }
  return {
    id,
    engine,
    stage: stageOfInput(input.stage, existing ? stageOf(existing) : 'prod'),
    description: text(input.description),
    host,
    port: finalPort,
    database,
    user,
    ...secretOf(password, existing),
    ssl: bool(input.ssl),
    encrypt: engine === 'sqlserver' ? bool(input.ssl) : undefined,
    trustServerCertificate: existing?.trustServerCertificate,
    writable: bool(input.writable),
    allowDdl: bool(input.allowDdl),
    allowBatch: bool(input.allowBatch) || existing?.allowBatch === true,
    requestTimeoutMs: existing?.requestTimeoutMs,
  }
}

function requireSource(deps: SettingsRpcDeps, id: string | undefined): SourceConfig {
  const found = deps.list().find((item) => item.id === id)
  if (!found) throw new Error('db: 源不存在: ' + String(id ?? ''))
  return found
}

/** 控制台执行：只读直接跑；写语句按 console 配置 + 源开关判定。 */
async function runConsole(deps: SettingsRpcDeps, body: Record<string, unknown>): Promise<RpcResult> {
  const source = requireSource(deps, text(body.source))
  const sql = text(body.sql)
  if (!sql) throw new Error('db: SQL 不能为空')
  const config = readConsoleConfig()
  const limit = clampLimit(
    typeof body.limit === 'number' ? body.limit : config.limit,
    config.limit,
  )
  const write = isWriteSql(sql) || isDdlSql(sql)
  if (!write) {
    assertReadonlySql(sql)
    return ok({ source: source.id, ...(await deps.query(source, sql, limit)) as object })
  }
  const mode: ConsoleWriteMode = config.writeMode
  if (mode === 'readonly') {
    throw new Error('db: 控制台当前是「一律只读」模式，写语句被拒绝（可在本页下方或设置里改）')
  }
  if (mode === 'source' && source.writable !== true) {
    throw new Error('db: 源 ' + source.id + ' 是只读的（writable 未开启），控制台写语句被拒绝')
  }
  const allowDdl = mode === 'always' ? true : source.allowDdl === true
  assertWriteSql(sql, { allowDdl, allowBatch: source.allowBatch === true })
  const result = (await deps.execute(source, sql)) as Record<string, unknown>
  return ok({ source: source.id, wrote: true, ...result })
}

async function dispatch(deps: SettingsRpcDeps, endpoint: string, payload: unknown): Promise<RpcResult> {
  const file = deps.filePath()
  const body = (payload ?? {}) as Record<string, unknown>
  switch (endpoint) {
    case 'sources/list':
      return ok({
        file,
        fileDisplay: displayPath(file),
        configFile: consoleConfigPath(),
        configDriven: deps.configDriven(),
        engines: ENGINES,
        stages: STAGES,
        consoleConfig: readConsoleConfig(),
        sources: deps.list().map(viewOf),
      })

    case 'sources/save': {
      if (deps.configDriven()) {
        throw new Error('db: 当前源来自插件 config.sources，改这里不生效；请先清空 config.sources')
      }
      const current = readSourcesFile(file)
      const originalId = text(body.originalId)
      const input = (body.source ?? {}) as SourceInput
      const existing =
        current.find((item) => item.id === (originalId ?? '')) ?? current.find((item) => item.id === text(input.id))
      const source = buildSource(input, existing)
      const next = upsertSource(current, source, originalId)
      writeSourcesFile(file, next)
      deps.invalidate()
      return ok({ file, sources: next.map(viewOf) })
    }

    case 'sources/secret': {
      // 只给本地面板用于「显示已保存密码」，describeSource / db_sources 工具输出始终不含密码
      const id = text(body.id)
      const found = deps.list().find((item) => item.id === id)
      if (!found) throw new Error('db: 源不存在: ' + String(id ?? ''))
      return ok({ id: found.id, secret: found.password ?? '', env: found.passwordEnv ?? '' })
    }

    case 'meta/tables': {
      const source = requireSource(deps, text(body.source))
      const result = (await deps.query(
        source,
        'SELECT DISTINCT TABLE_NAME AS name FROM INFORMATION_SCHEMA.TABLES ORDER BY TABLE_NAME',
        500,
      )) as { rows?: unknown[] }
      const rows = (result.rows ?? []) as unknown[][]
      return ok({ tables: rows.map((row) => String(row[0] ?? '')).filter(Boolean) })
    }

    case 'meta/columns': {
      const source = requireSource(deps, text(body.source))
      const table = (text(body.table) ?? '').replace(/[^A-Za-z0-9_.$#\[\]]/g, '')
      if (!table) throw new Error('db: 缺少表名')
      const literal = table.replace(/'/g, "''")
      const result = (await deps.query(
        source,
        "SELECT COLUMN_NAME AS name, DATA_TYPE AS type FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '" + literal + "' ORDER BY ORDINAL_POSITION",
        500,
      )) as { rows?: unknown[] }
      const rows = (result.rows ?? []) as unknown[][]
      return ok({
        table,
        columns: rows
          .map((row) => String(row[0] ?? ''))
          .filter(Boolean)
          .map((name) => ({ name: name, type: String(rows.find((r) => String(r[0]) === name)?.[1] ?? '') })),
      })
    }

    case 'sources/remove': {
      if (deps.configDriven()) {
        throw new Error('db: 当前源来自插件 config.sources，改这里不生效；请先清空 config.sources')
      }
      const id = text(body.id)
      if (!id) throw new Error('db: 缺少要删除的源 id')
      const next = removeSource(readSourcesFile(file), id)
      writeSourcesFile(file, next)
      deps.invalidate()
      return ok({ file, sources: next.map(viewOf) })
    }

    case 'sources/test': {
      const input = body.source as SourceInput | undefined
      let target: SourceConfig
      if (input && (text(input.host) || text(input.dsn))) {
        const originalId = text(body.originalId)
        const existing =
          deps.list().find((item) => item.id === (originalId ?? '')) ??
          deps.list().find((item) => item.id === text(input.id))
        target = buildSource(input, existing)
      } else {
        target = requireSource(deps, text(body.id))
      }
      const info = await deps.probe(target)
      return ok({ version: info.version, database: info.database ?? '', engine: engineOf(target) })
    }

    case 'query/run':
      return runConsole(deps, body)

    case 'console/save': {
      const raw = body.config as Partial<ConsoleConfig> | undefined
      const current = readConsoleConfig()
      const writeMode =
        raw?.writeMode === 'readonly' || raw?.writeMode === 'always' || raw?.writeMode === 'source'
          ? raw.writeMode
          : current.writeMode
      const limit = typeof raw?.limit === 'number' && raw.limit > 0 ? clampLimit(raw.limit) : current.limit
      const next: ConsoleConfig = { writeMode, limit }
      writeConsoleConfig(next)
      return ok(next)
    }

    default:
      throw new Error('db: 未知的 RPC 端点 ' + endpoint)
  }
}

async function handleRequest(deps: SettingsRpcDeps, request: Request): Promise<Response> {
  const json = (result: RpcResult): Response =>
    new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  let envelope: { channel?: unknown; endpoint?: unknown; payload?: unknown }
  try {
    envelope = (await request.json()) as typeof envelope
  } catch {
    return json(fail('db: 请求体不是合法 JSON'))
  }
  if (envelope.channel !== CHANNEL) {
    return json(fail('db: 未知 RPC 通道 ' + String(envelope.channel ?? '')))
  }
  try {
    return json(await dispatch(deps, String(envelope.endpoint ?? ''), envelope.payload))
  } catch (error) {
    return json(fail(error))
  }
}

/** 挂上浏览器侧用的 RPC 路由；部署里没有 connection 服务时静默跳过。 */
export function applySettingsRpc(ctx: Context, deps: SettingsRpcDeps): void {
  ctx.inject(['connection'], (rpcCtx: Context) => {
    const connection = (rpcCtx as unknown as { connection: ConnectionLike }).connection
    rpcCtx.effect(
      () =>
        connection.fetch.register({
          path: RPC_PATH,
          methods: ['POST'],
          requestBody: 'buffered',
          fetch: (request: Request) => handleRequest(deps, request),
        }),
      'dsh-tool-database: rpc route',
    )
  })
}

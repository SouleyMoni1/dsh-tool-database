/**
 * 连接字符串 ⇄ 源配置的互转（纯函数，可单测）。
 *
 * 支持：
 *   sqlserver://user:pass@host:1433/db      （mssql:// / tds:// 亦可）
 *   postgres://user:pass@host:5432/db       （postgresql:// / pg:// 亦可）
 *   mysql://user:pass@host:3306/db
 *   Server=host,1433;Database=db;User Id=u;Password=p;   （ADO 风格，仅 SQL Server）
 *
 * 密码里的特殊字符请用百分号编码：p@ss → p%40ss。
 * 展示时密码换成 PASSWORD_SENTINEL、环境变量引用换成 ${ENV} 占位；原样回传即表示「密码不变」。
 */

import { engineInfo, engineOf, type EngineKind, type SourceConfig } from './core.js'

/** 掩码哨兵：设置页回传该值时保留原密码。 */
export const PASSWORD_SENTINEL = '******'

/** ${ENV_NAME} 形式的密码引用。 */
const ENV_SECRET = /^\$\{([A-Za-z_][A-Za-z0-9_]*)\}$/

const SCHEME_ENGINE: Record<string, EngineKind> = {
  sqlserver: 'sqlserver',
  mssql: 'sqlserver',
  tds: 'sqlserver',
  postgres: 'postgres',
  postgresql: 'postgres',
  pg: 'postgres',
  mysql: 'mysql',
}

const ENGINE_SCHEME: Record<EngineKind, string> = {
  sqlserver: 'sqlserver',
  postgres: 'postgres',
  mysql: 'mysql',
}

export interface ParsedDsn {
  engine: EngineKind
  host: string
  port: number
  database?: string
  user?: string
  /** 明文密码、PASSWORD_SENTINEL 或 ${ENV_NAME}。 */
  password?: string
}

function str(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function checkPort(raw: string | number | undefined, dsn: string, fallback: number): number {
  if (raw === undefined || raw === '' || raw === null) return fallback
  const port = Number(raw)
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error('db: 连接字符串里的端口非法: ' + dsn)
  }
  return port
}

function decode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    throw new Error('db: 连接字符串里的百分号编码非法')
  }
}

/** Server=host,1433;Database=db;User Id=u;Password=p 形式（仅 SQL Server）。 */
function parseAdoDsn(raw: string): ParsedDsn {
  const parts = new Map<string, string>()
  for (const segment of raw.split(';')) {
    const at = segment.indexOf('=')
    if (at <= 0) continue
    const key = segment.slice(0, at).trim().toLowerCase().replace(/[\s_]/g, '')
    const value = segment.slice(at + 1).trim()
    if (value) parts.set(key, value)
  }
  const address = str(parts.get('server') ?? parts.get('datasource') ?? parts.get('address'))
  if (!address) throw new Error('db: 连接字符串缺少 Server= 主机: ' + raw)
  const comma = address.lastIndexOf(',')
  const host = comma > 0 ? address.slice(0, comma).trim() : address
  const port = comma > 0 ? address.slice(comma + 1) : parts.get('port')
  if (!host) throw new Error('db: 连接字符串缺少主机名: ' + raw)
  return {
    engine: 'sqlserver',
    host,
    port: checkPort(port, raw, engineInfo('sqlserver').defaultPort),
    database: str(parts.get('database') ?? parts.get('initialcatalog')),
    user: str(parts.get('userid') ?? parts.get('uid') ?? parts.get('user')),
    password: str(parts.get('password') ?? parts.get('pwd')),
  }
}

/** 解析连接字符串。 */
export function parseDsn(dsn: string): ParsedDsn {
  const raw = String(dsn ?? '').trim()
  if (!raw) throw new Error('db: 连接字符串不能为空')
  if (!/^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(raw)) return parseAdoDsn(raw)
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error('db: 连接字符串无法解析: ' + raw)
  }
  const scheme = url.protocol.replace(/:$/, '').toLowerCase()
  const engine = SCHEME_ENGINE[scheme]
  if (!engine) throw new Error('db: 不支持的连接串前缀 ' + scheme + '://')
  const host = url.hostname
  if (!host) throw new Error('db: 连接字符串缺少主机名: ' + raw)
  const database = str(url.pathname.replace(/^\//, ''))
  return {
    engine,
    host,
    port: checkPort(url.port, raw, engineInfo(engine).defaultPort),
    database,
    user: url.username ? decode(url.username) : undefined,
    password: url.password ? decode(url.password) : undefined,
  }
}

/** 源配置 → 连接字符串；mask=true 时密码换成哨兵。 */
export function formatDsn(source: SourceConfig, options: { mask?: boolean } = {}): string {
  const engine = engineOf(source)
  const scheme = ENGINE_SCHEME[engine]
  const port = source.port ?? engineInfo(engine).defaultPort
  const user = source.user ? encodeURIComponent(source.user) : ''
  let secret = ''
  if (source.passwordEnv) secret = '${' + source.passwordEnv + '}'
  else if (source.password) secret = encodeURIComponent(options.mask === true ? PASSWORD_SENTINEL : source.password)
  const auth = user || secret ? user + (secret ? ':' + secret : '') + '@' : ''
  return scheme + '://' + auth + source.host + ':' + String(port) + (source.database ? '/' + source.database : '')
}

/** ${ENV_NAME} → ENV_NAME；不是这种写法返回 undefined。 */
export function envNameOf(value: string | undefined): string | undefined {
  const raw = String(value ?? '').trim()
  const m = ENV_SECRET.exec(raw)
  return m?.[1]
}

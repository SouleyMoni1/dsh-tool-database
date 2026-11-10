/**
 * dsh-tool-database 插件入口。
 *
 * 注册 6 个 db_* 工具，一个清单同时管 SQL Server / PostgreSQL / MySQL：
 *   db_sources / db_databases / db_tables / db_schema / db_query / db_execute
 *
 * 数据源配置（config.sources 优先，否则读文件——改文件即时生效，按 mtime 热加载）：
 *   1. 插件 config.sources：cordis.patch.yml 里的数组；
 *   2. $DSH_HOME/database-tool/sources.json（首次启动自动从老插件 mssql-tool/sources.json 迁移一份）。
 *
 * 图形化维护：左侧栏「数据库」面板与设置页都经 connection.fetch 打 RPC，
 * 宿主侧增删改同一份 sources.json（见 settings-rpc.ts）；没有 connection 的部署
 * 自动跳过界面，工具不受影响。
 *
 * 凭据边界：密码只经 passwordEnv（推荐）或宿主侧文件进入进程，任何工具返回值都不含密码。
 */

import { readFileSync, statSync } from 'node:fs'
import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import {
  clampLimit,
  defaultSourcesPath,
  describeSource,
  formatColumnType,
  legacySourcesPath,
  parseSources,
  type SourceConfig,
} from './core.js'
import { assertReadonlySql, assertWriteSql } from './sql-guard.js'
import { closeAllPools, listDatabases, listTables, probe, runExecute, runQuery, tableColumns } from './pool.js'
import { migrateLegacySources } from './settings-store.js'
import { queriesPathFor } from './query-store.js'
import { applySettingsRpc } from './settings-rpc.js'

export const name = 'dsh-tool-database'
export const inject = ['tools']

export interface Config {
  /** 直接在该字段写源数组；非空时忽略配置文件。 */
  sources?: SourceConfig[]
  /** 源清单配置文件路径，默认 $DSH_HOME/database-tool/sources.json。 */
  configFile?: string
  /** 工具未显式传 source 时使用的默认源 id；缺省取清单第一条。 */
  defaultSource?: string
}

const TOOL_TIMEOUT_MS = 30_000
const ENGINE_HINT =
  'engines: sqlserver (mssql) / postgres (pg) / mysql (mysql2). ' +
  'Parameters: SQL Server uses @p0, @p1 …; PostgreSQL uses $1, $2 …; MySQL uses ?.'

export function apply(ctx: Context, config: Config = {}): void {
  const filePath = config.configFile ?? defaultSourcesPath()
  if (!config.configFile) {
    migrateLegacySources(legacySourcesPath(), filePath)
  }
  let fromFile: { mtimeMs: number; sources: SourceConfig[] } | null = null
  let fromConfig: SourceConfig[] | null = null

  const listSources = (): SourceConfig[] => {
    const inline = config.sources
    if (Array.isArray(inline) && inline.length > 0) {
      fromConfig ??= parseSources(inline)
      return fromConfig
    }
    let mtimeMs = 0
    try {
      mtimeMs = statSync(filePath).mtimeMs
    } catch {
      return []
    }
    if (fromFile && fromFile.mtimeMs === mtimeMs) return fromFile.sources
    const parsed = parseSources(JSON.parse(readFileSync(filePath, 'utf8')))
    fromFile = { mtimeMs, sources: parsed }
    return parsed
  }

  const pick = (id?: string): SourceConfig => {
    const all = listSources()
    if (all.length === 0) {
      throw new Error(
        '未配置任何数据源：请在 ' + filePath + ' 写 JSON 数组，或配置插件 config.sources',
      )
    }
    const wanted = id ?? config.defaultSource ?? (all[0] as SourceConfig).id
    const found = all.find((s) => s.id === wanted)
    if (!found) {
      throw new Error('未知数据源 ' + wanted + '；可用: ' + all.map((s) => s.id).join(', '))
    }
    return found
  }

  const fail = (error: unknown): string =>
    'db 错误: ' + (error instanceof Error ? error.message : String(error))

  ctx.tools.register(
    defineTool({
      name: 'db_sources',
      description:
        'List configured database sources (id / engine / host / port / database / user / readonly). ' +
        'Never returns passwords. Call this first to learn the "source" id used by other db_* tools. ' +
        'Pass probe: true to also test connectivity and print the server version. ' + ENGINE_HINT,
      parameters: {
        probe: {
          type: 'boolean',
          description: 'Test each source with a real connection. Default false.',
        },
      },
      output: {
        schema: { type: 'string' },
        render: (_args, value) => [{ type: 'text', text: value }],
      },
      execute: async (args) => {
        try {
          const all = listSources()
          if (all.length === 0) {
            return 'db: 未配置数据源。请在 ' + filePath + ' 写 JSON 数组，或配置插件 config.sources'
          }
          if (args.probe !== true) return JSON.stringify(all.map(describeSource), null, 2)
          const probed = []
          for (const source of all) {
            const view = describeSource(source)
            try {
              const info = await probe(source)
              probed.push({ ...view, reachable: true, version: info.version, currentDatabase: info.database })
            } catch (error) {
              probed.push({ ...view, reachable: false, error: error instanceof Error ? error.message : String(error) })
            }
          }
          return JSON.stringify(probed, null, 2)
        } catch (error) {
          return fail(error)
        }
      },
      timeoutMs: 60_000,
    }),
  )

  ctx.tools.register(
    defineTool({
      name: 'db_databases',
      description:
        'List databases on one source (read-only). SQL Server uses sys.databases, PostgreSQL pg_database, ' +
        'MySQL SHOW DATABASES. Omit source to use the default one.',
      parameters: {
        source: { type: 'string', description: 'Source id from db_sources; optional.' },
      },
      output: {
        schema: { type: 'string' },
        render: (_args, value) => [{ type: 'text', text: value }],
      },
      execute: async (args) => {
        try {
          const source = pick(args.source)
          const names = await listDatabases(source)
          return JSON.stringify({ source: source.id, databases: names })
        } catch (error) {
          return fail(error)
        }
      },
      timeoutMs: TOOL_TIMEOUT_MS,
    }),
  )

  ctx.tools.register(
    defineTool({
      name: 'db_tables',
      description:
        'List tables and views of one source with schema, object kind and row count estimate (read-only). ' +
        'Filter by schema or name substring before writing SQL — much cheaper than SELECT *. ' + ENGINE_HINT,
      parameters: {
        source: { type: 'string', description: 'Source id from db_sources; optional.' },
        schema: { type: 'string', description: 'Restrict to one schema, e.g. dbo / public / a database name.' },
        filter: { type: 'string', description: 'Case-insensitive substring match on the table name.' },
        limit: { type: 'integer', description: 'Max rows to return (default 100, hard cap 500).' },
      },
      output: {
        schema: { type: 'string' },
        render: (_args, value) => [{ type: 'text', text: value }],
      },
      execute: async (args) => {
        try {
          const source = pick(args.source)
          const rows = await listTables(source, {
            schema: args.schema,
            filter: args.filter,
            limit: clampLimit(args.limit),
          })
          return JSON.stringify({ source: source.id, count: rows.length, tables: rows }, null, 2)
        } catch (error) {
          return fail(error)
        }
      },
      timeoutMs: TOOL_TIMEOUT_MS,
    }),
  )

  ctx.tools.register(
    defineTool({
      name: 'db_schema',
      description:
        'Show column definitions of one table (read-only): name, type with length/precision, nullable, ' +
        'identity/auto-increment, primary key and default expression. Accepts "table" or "schema.table".',
      parameters: {
        source: { type: 'string', description: 'Source id from db_sources; optional.' },
        table: { type: 'string', required: true, description: 'Table name, e.g. users or dbo.users.' },
      },
      output: {
        schema: { type: 'string' },
        render: (_args, value) => [{ type: 'text', text: value }],
      },
      execute: async (args) => {
        try {
          const source = pick(args.source)
          const columns = await tableColumns(source, args.table)
          if (columns.length === 0) {
            return 'db: 表 ' + args.table + ' 不存在或当前账号无元数据权限'
          }
          const lines = columns.map((c) =>
            [
              c.column,
              formatColumnType({ ...c, engine: source.engine }),
              c.nullable ? 'NULL' : 'NOT NULL',
              c.identity ? 'IDENTITY' : '',
              c.primaryKey ? 'PK' : '',
              c.default ? 'DEFAULT ' + c.default : '',
            ]
              .filter(Boolean)
              .join(' '),
          )
          return JSON.stringify({ source: source.id, table: args.table, columns: lines }, null, 2)
        } catch (error) {
          return fail(error)
        }
      },
      timeoutMs: TOOL_TIMEOUT_MS,
    }),
  )

  ctx.tools.register(
    defineTool({
      name: 'db_query',
      description:
        'Run ONE read-only statement against a source (SELECT / WITH / VALUES). Writes are rejected. ' +
        'Results come back as { columns, rows, truncated, rowCount, elapsedMs }. ' + ENGINE_HINT,
      parameters: {
        source: { type: 'string', description: 'Source id from db_sources; optional.' },
        sql: {
          type: 'string',
          required: true,
          description: 'Single read-only statement with the engine-specific placeholders (@p0 / $1 / ?).',
        },
        params: {
          type: 'array',
          items: { type: 'json' },
          description: 'Bound values for the placeholders, in order.',
        },
        limit: { type: 'integer', description: 'Max rows to return (default 100, hard cap 500).' },
      },
      output: {
        schema: { type: 'string' },
        render: (_args, value) => [{ type: 'text', text: value }],
      },
      execute: async (args) => {
        try {
          const source = pick(args.source)
          assertReadonlySql(args.sql)
          const result = await runQuery(
            source,
            args.sql,
            Array.isArray(args.params) ? args.params : undefined,
            clampLimit(args.limit),
          )
          return JSON.stringify({ source: source.id, engine: source.engine, ...result }, null, 2)
        } catch (error) {
          return fail(error)
        }
      },
      timeoutMs: TOOL_TIMEOUT_MS,
    }),
  )

  ctx.tools.register(
    defineTool({
      name: 'db_execute',
      description:
        'Run ONE write statement (INSERT / UPDATE / DELETE / MERGE) against a writable source. ' +
        'Requires the source to be configured writable AND an explicit allowWrite: true. ' +
        'DDL needs allowDdl on the source. Read data with db_query instead.',
      parameters: {
        source: { type: 'string', description: 'Source id from db_sources; optional.' },
        sql: { type: 'string', required: true, description: 'Single write statement.' },
        allowWrite: {
          type: 'boolean',
          required: true,
          description: 'Must be true — the explicit confirmation gate for any write.',
        },
        params: {
          type: 'array',
          items: { type: 'json' },
          description: 'Bound values for the placeholders, in order.',
        },
      },
      output: {
        schema: { type: 'string' },
        render: (_args, value) => [{ type: 'text', text: value }],
      },
      execute: async (args) => {
        try {
          const source = pick(args.source)
          if (source.writable !== true) {
            return 'db: 源 ' + source.id + ' 是只读的（writable 未开启），拒绝写操作'
          }
          if (args.allowWrite !== true) {
            return 'db: 写操作需要显式 allowWrite: true（源 ' + source.id + '）'
          }
          assertWriteSql(args.sql, {
            allowDdl: source.allowDdl === true,
            allowBatch: source.allowBatch === true,
          })
          const result = await runExecute(
            source,
            args.sql,
            Array.isArray(args.params) ? args.params : undefined,
          )
          return JSON.stringify({ source: source.id, engine: source.engine, ...result }, null, 2)
        } catch (error) {
          return fail(error)
        }
      },
      timeoutMs: TOOL_TIMEOUT_MS,
    }),
  )

  // 侧栏面板 / 设置页：浏览器侧经 connection 打 RPC，宿主侧读写同一份 sources.json。
  applySettingsRpc(ctx, {
    filePath: () => filePath,
    configDriven: () => Array.isArray(config.sources) && config.sources.length > 0,
    list: listSources,
    invalidate: () => {
      fromFile = null
      fromConfig = null
    },
    probe: async (source) => {
      const info = await probe(source)
      return { version: info.version, database: info.database }
    },
    query: async (source, sql, limit) => runQuery(source, sql, undefined, limit),
    execute: async (source, sql) => runExecute(source, sql, undefined),
    queriesPath: () => queriesPathFor(filePath),
  })

  // 插件卸载/重载时关闭连接池；disposer 由 cordis 在 fiber 卸载时调用。
  ctx.effect(() => () => {
    void closeAllPools()
  })
}

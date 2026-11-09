/**
 * 连接池与执行层（引擎无关）。
 *
 * - 连接按「引擎 + 源 id + 主机 + 端口 + 库 + 账号」缓存复用，插件卸载时统一关闭；
 * - 密码每次取池时解析（passwordEnv → process.env），只存在于宿主进程内；
 * - 元数据查询全部走参数绑定，不做字符串拼接。
 */

import { engineOf, resolvePassword, serializeRows, type SerializedRows, type SourceConfig } from './core.js'
import { adapterOf, type EngineAdapter, type ProbeOutput, type TableListOptions, type TableRow, type ColumnRow } from './engines/index.js'

interface Entry {
  adapter: EngineAdapter
  handle: unknown
}

const entries = new Map<string, Promise<Entry>>()

function keyOf(source: SourceConfig): string {
  return [
    engineOf(source),
    source.id,
    source.host,
    String(source.port ?? ''),
    source.database ?? '',
    source.user ?? '',
  ].join('|')
}

function getEntry(source: SourceConfig): Promise<Entry> {
  const key = keyOf(source)
  const cached = entries.get(key)
  if (cached) return cached
  const adapter = adapterOf(engineOf(source))
  const created = Promise.resolve(adapter.connect(source, resolvePassword(source))).then((handle) => ({ adapter, handle }))
  entries.set(key, created)
  created.catch(() => entries.delete(key))
  return created
}

export async function closeAllPools(): Promise<void> {
  const all = [...entries.values()]
  entries.clear()
  await Promise.allSettled(
    all.map(async (pending) => {
      const entry = await pending
      await entry.adapter.close(entry.handle)
    }),
  )
}

export interface QueryResult extends SerializedRows {
  elapsedMs: number
  command?: string
}

/** 只读查询：调用方负责先过 assertReadonlySql。 */
export async function runQuery(
  source: SourceConfig,
  text: string,
  params: unknown[] | undefined,
  limit: number,
): Promise<QueryResult> {
  const started = Date.now()
  const entry = await getEntry(source)
  const output = await entry.adapter.query(entry.handle, text, params)
  return {
    ...serializeRows(output.rows, output.columns, limit),
    elapsedMs: Date.now() - started,
    command: output.command,
  }
}

export interface ExecuteResult {
  rowsAffected: number
  command?: string
  elapsedMs: number
}

/** 写执行：调用方负责先过 assertWriteSql 与双闸门。 */
export async function runExecute(
  source: SourceConfig,
  text: string,
  params: unknown[] | undefined,
): Promise<ExecuteResult> {
  const started = Date.now()
  const entry = await getEntry(source)
  const output = await entry.adapter.execute(entry.handle, text, params)
  return { rowsAffected: output.rowsAffected, command: output.command, elapsedMs: Date.now() - started }
}

export async function probe(source: SourceConfig): Promise<ProbeOutput> {
  const entry = await getEntry(source)
  return entry.adapter.probe(entry.handle)
}

export async function listDatabases(source: SourceConfig): Promise<string[]> {
  const entry = await getEntry(source)
  return entry.adapter.listDatabases(entry.handle)
}

export async function listTables(source: SourceConfig, opts: TableListOptions): Promise<TableRow[]> {
  const entry = await getEntry(source)
  return entry.adapter.listTables(entry.handle, opts)
}

export async function tableColumns(source: SourceConfig, ref: string): Promise<ColumnRow[]> {
  const entry = await getEntry(source)
  return entry.adapter.tableColumns(entry.handle, ref)
}

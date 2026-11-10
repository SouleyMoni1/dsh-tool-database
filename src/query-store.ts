/**
 * 查询页签与已保存 SQL 的读写（queries.json）。
 *
 * 和 sources.json 分开存：一个是连接清单（可能来自插件 config），
 * 一个是每个连接下的查询页签 / 历史，互不影响，删了 queries.json 只是丢历史。
 * 写入同样是「同目录临时文件 + rename」，避免半截文件被读到。
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export interface StoredQueryTab {
  /** 页签 id，客户端生成（时间戳 + 随机串）。 */
  id: string
  /** 页签标题，客户端按 SQL 首行算出来，允许重复。 */
  title: string
  sql: string
  /** 最后修改时间，毫秒。 */
  updatedAt: number
  /** 关掉的页签进历史，不删除，可以再打开。 */
  closed: boolean
  /** 用户手动改过名字；为 true 时不再按 SQL 首行自动生成标题。 */
  named: boolean
}

interface QueriesFile {
  version: number
  sources: Record<string, StoredQueryTab[]>
}

const EMPTY: QueriesFile = { version: 1, sources: {} }

/** 与 sources.json 同目录下的 queries.json。 */
export function queriesPathFor(sourcesPath: string): string {
  return join(dirname(sourcesPath), 'queries.json')
}

export function readQueriesFile(path: string): QueriesFile {
  let text: string
  try {
    text = readFileSync(path, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { version: 1, sources: {} }
    throw error
  }
  if (!text.trim()) return { version: 1, sources: {} }
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (error) {
    throw new Error('db: ' + path + ' 不是合法 JSON: ' + (error as Error).message)
  }
  const raw = parsed as Partial<QueriesFile> | null
  const sources: Record<string, StoredQueryTab[]> = {}
  const table = raw && typeof raw === 'object' && raw.sources && typeof raw.sources === 'object' ? raw.sources : {}
  for (const key of Object.keys(table)) {
    const list = (table as Record<string, unknown>)[key]
    if (!Array.isArray(list)) continue
    sources[key] = list.map((item) => normalizeTab(item)).filter((item): item is StoredQueryTab => item !== null)
  }
  return { version: 1, sources }
}

export function writeQueriesFile(path: string, file: QueriesFile): void {
  const dir = dirname(path)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  const text = JSON.stringify(file, null, 2) + '\n'
  const tmp = path + '.tmp-' + process.pid + '-' + String(Date.now())
  writeFileSync(tmp, text, 'utf8')
  renameSync(tmp, path)
}

/** 校验并规整一条页签；不合法返回 null。 */
export function normalizeTab(input: unknown): StoredQueryTab | null {
  if (!input || typeof input !== 'object') return null
  const raw = input as Record<string, unknown>
  const id = typeof raw.id === 'string' ? raw.id.trim() : ''
  if (!id) return null
  const sql = typeof raw.sql === 'string' ? raw.sql : ''
  const title = typeof raw.title === 'string' ? raw.title.slice(0, 120) : ''
  const updatedAt = typeof raw.updatedAt === 'number' && Number.isFinite(raw.updatedAt) ? raw.updatedAt : Date.now()
  return { id: id, title: title, sql: sql, updatedAt: updatedAt, closed: raw.closed === true, named: raw.named === true }
}

export function listTabs(path: string, sourceId: string): StoredQueryTab[] {
  return readQueriesFile(path).sources[sourceId] ?? []
}

/** 按 id 新增或覆盖一条页签，返回写入后的这条。 */
export function saveTab(path: string, sourceId: string, tab: StoredQueryTab): StoredQueryTab {
  const file = readQueriesFile(path)
  const list = file.sources[sourceId] ?? []
  const index = list.findIndex((item) => item.id === tab.id)
  if (index >= 0) list[index] = tab
  else list.push(tab)
  file.sources[sourceId] = list
  writeQueriesFile(path, file)
  return tab
}

/** 彻底删掉一条页签（历史里也不再出现）。 */
export function deleteTab(path: string, sourceId: string, id: string): boolean {
  const file = readQueriesFile(path)
  const list = file.sources[sourceId] ?? []
  const next = list.filter((item) => item.id !== id)
  if (next.length === list.length) return false
  file.sources[sourceId] = next
  writeQueriesFile(path, file)
  return true
}

export { EMPTY as emptyQueriesFile }

/**
 * 引擎适配层接口：所有方言细节都收敛在这里，上层（pool / tools / 设置页）只认统一形状。
 */

import type { EngineKind, SourceConfig } from '../core.js'

export interface QueryOutput {
  columns: string[]
  rows: unknown[][]
  command?: string
}

export interface ExecuteOutput {
  rowsAffected: number
  command?: string
}

export interface ProbeOutput {
  version: string
  database: string
}

export interface TableListOptions {
  schema?: string
  filter?: string
  limit: number
}

export interface TableRow {
  schema: string
  name: string
  kind: string
  rows: number | null
}

export interface ColumnRow {
  column: string
  type: string
  max_length: number | null
  precision: number | null
  scale: number | null
  nullable: boolean
  identity: boolean
  primaryKey: boolean
  default: string | null
}

/** 一个引擎的实现；handle 是驱动自己的连接池对象。 */
export interface EngineAdapter {
  kind: EngineKind
  connect(source: SourceConfig, password: string | undefined): Promise<unknown>
  close(handle: unknown): Promise<void>
  probe(handle: unknown): Promise<ProbeOutput>
  query(handle: unknown, sql: string, params: unknown[] | undefined): Promise<QueryOutput>
  execute(handle: unknown, sql: string, params: unknown[] | undefined): Promise<ExecuteOutput>
  listDatabases(handle: unknown): Promise<string[]>
  listTables(handle: unknown, opts: TableListOptions): Promise<TableRow[]>
  tableColumns(handle: unknown, ref: string): Promise<ColumnRow[]>
}

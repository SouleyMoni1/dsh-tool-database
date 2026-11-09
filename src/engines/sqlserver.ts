/**
 * SQL Server 适配器（mssql / tedious）。
 */

import sql from 'mssql'
import {
  DEFAULT_CONNECT_TIMEOUT_MS,
  DEFAULT_REQUEST_TIMEOUT_MS,
  defaultPortOf,
  parseTableRef,
  type SourceConfig,
} from '../core.js'
import type { ColumnRow, EngineAdapter, ExecuteOutput, ProbeOutput, QueryOutput, TableListOptions, TableRow } from './types.js'

function poolOptions(source: SourceConfig, password: string | undefined): sql.config {
  return {
    server: source.host,
    port: defaultPortOf(source),
    database: source.database,
    user: source.user,
    password,
    options: {
      encrypt: source.encrypt === true || source.ssl === true,
      trustServerCertificate: source.trustServerCertificate !== false,
      enableArithAbort: true,
    },
    pool: { min: 0, max: 4, idleTimeoutMillis: 30_000 },
    connectionTimeout: DEFAULT_CONNECT_TIMEOUT_MS,
    requestTimeout: source.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS,
  }
}

function bind(request: sql.Request, params?: unknown[]): void {
  if (!Array.isArray(params)) return
  params.forEach((value, index) => request.input('p' + String(index), value as never))
}

function columnsOf(result: sql.IResult<unknown>): string[] {
  const recordset = result.recordset as
    | (Record<string, unknown>[] & { columns?: Record<string, unknown> })
    | undefined
  return recordset?.columns ? Object.keys(recordset.columns) : []
}

async function query(handle: unknown, text: string, params?: unknown[]): Promise<QueryOutput> {
  const pool = handle as sql.ConnectionPool
  const request = pool.request()
  bind(request, params)
  const result = await request.query(text)
  const columns = columnsOf(result)
  const objects = (result.recordset ?? []) as Record<string, unknown>[]
  return {
    columns,
    rows: objects.map((row) => columns.map((column) => row[column])),
    command: 'rows',
  }
}

export const sqlserverAdapter: EngineAdapter = {
  kind: 'sqlserver',
  connect: (source, password) => new sql.ConnectionPool(poolOptions(source, password)).connect(),
  close: async (handle) => {
    await (handle as sql.ConnectionPool).close()
  },
  probe: async (handle): Promise<ProbeOutput> => {
    const result = await (handle as sql.ConnectionPool)
      .request()
      .query<{ v: string; d: string }>('SELECT @@VERSION AS v, DB_NAME() AS d')
    const row = result.recordset[0]
    return {
      version: String(row?.v ?? '').split('\n')[0] ?? '',
      database: String(row?.d ?? ''),
    }
  },
  query: (handle, text, params) => query(handle, text, params),
  execute: async (handle, text, params): Promise<ExecuteOutput> => {
    const pool = handle as sql.ConnectionPool
    const request = pool.request()
    bind(request, params)
    const result = await request.query(text)
    const affected = Array.isArray(result.rowsAffected)
      ? result.rowsAffected.reduce((sum, n) => sum + Number(n), 0)
      : 0
    return { rowsAffected: affected, command: 'rows' }
  },
  listDatabases: async (handle) => {
    const result = await (handle as sql.ConnectionPool)
      .request()
      .query<{ name: string }>("SELECT name FROM sys.databases WHERE state = 0 ORDER BY database_id")
    return (result.recordset ?? []).map((row) => String(row.name))
  },
  listTables: async (handle, opts: TableListOptions): Promise<TableRow[]> => {
    const request = (handle as sql.ConnectionPool).request()
    const where: string[] = ["o.type IN ('U','V')"]
    if (opts.schema) {
      where.push('s.name = @schema')
      request.input('schema', opts.schema)
    }
    if (opts.filter) {
      where.push("o.name LIKE '%' + @filter + '%'")
      request.input('filter', opts.filter)
    }
    const text =
      'SELECT s.name AS [schema], o.name AS [name], o.type_desc AS [kind], p.[rows] AS [rows]\n' +
      'FROM sys.objects AS o\n' +
      'JOIN sys.schemas AS s ON s.schema_id = o.schema_id\n' +
      'LEFT JOIN (SELECT object_id, SUM([rows]) AS [rows] FROM sys.partitions\n' +
      '           WHERE index_id IN (0, 1) GROUP BY object_id) AS p ON p.object_id = o.object_id\n' +
      'WHERE ' + where.join(' AND ') + '\n' +
      'ORDER BY s.name, o.name'
    const result = await request.query<{ schema: string; name: string; kind: string; rows: number | null }>(text)
    return (result.recordset ?? []).slice(0, opts.limit).map((row) => ({
      schema: String(row.schema),
      name: String(row.name),
      kind: String(row.kind),
      rows: row.rows === null || row.rows === undefined ? null : Number(row.rows),
    }))
  },
  tableColumns: async (handle, ref): Promise<ColumnRow[]> => {
    const { schema, name } = parseTableRef(ref, 'dbo')
    const request = (handle as sql.ConnectionPool).request()
    request.input('table', schema + '.' + name)
    const text =
      'SELECT c.name AS [column], t.name AS [type], c.max_length, c.[precision], c.scale,\n' +
      '       c.is_nullable, c.is_identity, dc.definition AS [default],\n' +
      '       CASE WHEN pk.column_id IS NULL THEN 0 ELSE 1 END AS is_pk\n' +
      'FROM sys.columns AS c\n' +
      'JOIN sys.types AS t ON t.user_type_id = c.user_type_id\n' +
      'LEFT JOIN sys.default_constraints AS dc\n' +
      '       ON dc.parent_object_id = c.object_id AND dc.parent_column_id = c.column_id\n' +
      'LEFT JOIN (SELECT ic.object_id, ic.column_id FROM sys.indexes AS i\n' +
      '           JOIN sys.index_columns AS ic\n' +
      '             ON ic.object_id = i.object_id AND ic.index_id = i.index_id\n' +
      '           WHERE i.is_primary_key = 1) AS pk\n' +
      '       ON pk.object_id = c.object_id AND pk.column_id = c.column_id\n' +
      'WHERE c.object_id = OBJECT_ID(@table)\n' +
      'ORDER BY c.column_id'
    const result = await request.query<{
      column: string
      type: string
      max_length: number | null
      precision: number | null
      scale: number | null
      is_nullable: boolean
      is_identity: boolean
      default: string | null
      is_pk: number
    }>(text)
    return (result.recordset ?? []).map((row) => ({
      column: String(row.column),
      type: row.type,
      max_length: row.max_length ?? null,
      precision: row.precision ?? null,
      scale: row.scale ?? null,
      nullable: row.is_nullable === true,
      identity: row.is_identity === true,
      primaryKey: Number(row.is_pk) === 1,
      default: row.default ?? null,
    }))
  },
}

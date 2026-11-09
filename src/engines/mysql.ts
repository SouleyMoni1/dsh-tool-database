/**
 * MySQL / MariaDB 适配器（mysql2）。
 */

import mysql from 'mysql2/promise'
import {
  DEFAULT_CONNECT_TIMEOUT_MS,
  defaultPortOf,
  parseTableRef,
  type SourceConfig,
} from '../core.js'
import type { ColumnRow, EngineAdapter, ExecuteOutput, ProbeOutput, QueryOutput, TableListOptions, TableRow } from './types.js'

type Pool = mysql.Pool

function poolOf(source: SourceConfig, password: string | undefined): Pool {
  return mysql.createPool({
    host: source.host,
    port: defaultPortOf(source),
    database: source.database,
    user: source.user,
    password,
    ssl: source.ssl ? { rejectUnauthorized: source.trustServerCertificate === false } : undefined,
    waitForConnections: true,
    connectionLimit: 4,
    connectTimeout: DEFAULT_CONNECT_TIMEOUT_MS,
    enableKeepAlive: true,
    dateStrings: false,
  })
}

export const mysqlAdapter: EngineAdapter = {
  kind: 'mysql',
  connect: async (source, password) => {
    const pool = poolOf(source, password)
    await pool.query('SELECT 1')
    return pool
  },
  close: async (handle) => {
    await (handle as Pool).end()
  },
  probe: async (handle): Promise<ProbeOutput> => {
    const [rows] = await (handle as Pool).query('SELECT VERSION() AS v, DATABASE() AS d')
    const row = (rows as { v: string; d: string }[])[0]
    return { version: String(row?.v ?? ''), database: String(row?.d ?? '') }
  },
  query: async (handle, text, params): Promise<QueryOutput> => {
    const [rows, fields] = await (handle as Pool).query({
      sql: text,
      values: params ?? [],
      rowsAsArray: true,
    })
    const list = (fields ?? []) as { name: string }[]
    return {
      columns: list.map((field) => field.name),
      rows: rows as unknown[][],
      command: 'rows',
    }
  },
  execute: async (handle, text, params): Promise<ExecuteOutput> => {
    const [result] = await (handle as Pool).query({ sql: text, values: params ?? [] })
    const header = result as { affectedRows?: number }
    return { rowsAffected: Number(header.affectedRows ?? 0), command: 'rows' }
  },
  listDatabases: async (handle) => {
    const [rows] = await (handle as Pool).query('SHOW DATABASES')
    return (rows as Record<string, string>[]).map((row) => String(row.Database ?? Object.values(row)[0]))
  },
  listTables: async (handle, opts: TableListOptions): Promise<TableRow[]> => {
    const [rows] = await (handle as Pool).query(
      `SELECT table_schema AS \`schema\`, table_name AS \`name\`,
              CASE table_type WHEN 'BASE TABLE' THEN 'table' WHEN 'VIEW' THEN 'view'
                              ELSE LOWER(table_type) END AS kind,
              table_rows AS \`rows\`
       FROM information_schema.tables
       WHERE table_schema NOT IN ('mysql','information_schema','performance_schema','sys')
         AND (? IS NULL OR table_schema = ?)
         AND (? IS NULL OR table_name LIKE CONCAT('%', ?, '%'))
       ORDER BY 1, 2
       LIMIT ?`,
      [opts.schema ?? null, opts.schema ?? null, opts.filter ?? null, opts.filter ?? null, opts.limit],
    )
    return (rows as Record<string, unknown>[]).map((row) => ({
      schema: String(row.schema),
      name: String(row.name),
      kind: String(row.kind),
      rows: row.rows === null || row.rows === undefined ? null : Number(row.rows),
    }))
  },
  tableColumns: async (handle, ref): Promise<ColumnRow[]> => {
    const { schema, name } = parseTableRef(ref, '')
    const [rows] = await (handle as Pool).query(
      `SELECT column_name AS \`column\`, column_type AS \`type\`,
              character_maximum_length AS max_length,
              numeric_precision AS \`precision\`, numeric_scale AS scale,
              (is_nullable = 'YES') AS nullable,
              (extra LIKE '%auto_increment%') AS identity,
              (column_key = 'PRI') AS primaryKey,
              column_default AS \`default\`
       FROM information_schema.columns
       WHERE table_schema = COALESCE(NULLIF(?, ''), DATABASE()) AND table_name = ?
       ORDER BY ordinal_position`,
      [schema, name],
    )
    return (rows as Record<string, unknown>[]).map((row) => ({
      column: String(row.column),
      type: String(row.type),
      max_length: row.max_length === null || row.max_length === undefined ? null : Number(row.max_length),
      precision: row.precision === null || row.precision === undefined ? null : Number(row.precision),
      scale: row.scale === null || row.scale === undefined ? null : Number(row.scale),
      nullable: Number(row.nullable) === 1 || row.nullable === true,
      identity: Number(row.identity) === 1 || row.identity === true,
      primaryKey: Number(row.primaryKey) === 1 || row.primaryKey === true,
      default: row.default === null || row.default === undefined ? null : String(row.default),
    }))
  },
}

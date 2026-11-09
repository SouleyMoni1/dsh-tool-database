/**
 * PostgreSQL 适配器（pg）。
 */

import pg from 'pg'
import type { QueryArrayConfig, QueryArrayResult } from 'pg'
import {
  DEFAULT_CONNECT_TIMEOUT_MS,
  DEFAULT_REQUEST_TIMEOUT_MS,
  defaultPortOf,
  parseTableRef,
  type SourceConfig,
} from '../core.js'
import type { ColumnRow, EngineAdapter, ExecuteOutput, ProbeOutput, QueryOutput, TableListOptions, TableRow } from './types.js'

type Pool = pg.Pool

function poolOf(source: SourceConfig, password: string | undefined): Pool {
  return new pg.Pool({
    host: source.host,
    port: defaultPortOf(source),
    database: source.database,
    user: source.user,
    password,
    ssl: source.ssl ? { rejectUnauthorized: source.trustServerCertificate === false } : false,
    max: 4,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: DEFAULT_CONNECT_TIMEOUT_MS,
    statement_timeout: source.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS,
  })
}

export const postgresAdapter: EngineAdapter = {
  kind: 'postgres',
  connect: async (source, password) => {
    const pool = poolOf(source, password)
    const client = await pool.connect()
    client.release()
    return pool
  },
  close: async (handle) => {
    await (handle as Pool).end()
  },
  probe: async (handle): Promise<ProbeOutput> => {
    const result = await (handle as Pool).query<{ v: string; d: string }>(
      'SELECT version() AS v, current_database() AS d',
    )
    const row = result.rows[0]
    return {
      version: String(row?.v ?? '').split(',')[0] ?? '',
      database: String(row?.d ?? ''),
    }
  },
  query: async (handle, text, params): Promise<QueryOutput> => {
    const config: QueryArrayConfig = { text, values: params ?? [], rowMode: 'array' }
    const result = (await (handle as Pool).query(config)) as QueryArrayResult
    const fields = result.fields ?? []
    const rows = (result.rows ?? []) as unknown[][]
    return { columns: fields.map((field) => field.name), rows, command: result.command }
  },
  execute: async (handle, text, params): Promise<ExecuteOutput> => {
    const result = await (handle as Pool).query({ text, values: params ?? [] })
    return { rowsAffected: result.rowCount ?? 0, command: result.command }
  },
  listDatabases: async (handle) => {
    const result = await (handle as Pool).query<{ datname: string }>(
      'SELECT datname FROM pg_database WHERE datallowconn ORDER BY datname',
    )
    return (result.rows ?? []).map((row) => String(row.datname))
  },
  listTables: async (handle, opts: TableListOptions): Promise<TableRow[]> => {
    const result = await (handle as Pool).query(
      `SELECT n.nspname AS schema, c.relname AS name,
              CASE c.relkind WHEN 'r' THEN 'table' WHEN 'v' THEN 'view'
                             WHEN 'm' THEN 'materialized view' WHEN 'p' THEN 'partitioned table'
                             WHEN 'f' THEN 'foreign table' ELSE c.relkind::text END AS kind,
              CASE WHEN c.reltuples < 0 THEN NULL ELSE c.reltuples::bigint END AS rows
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE c.relkind IN ('r','v','m','p','f')
         AND n.nspname NOT IN ('pg_catalog','information_schema')
         AND ($1::text IS NULL OR n.nspname = $1)
         AND ($2::text IS NULL OR c.relname ILIKE '%' || $2 || '%')
       ORDER BY 1, 2
       LIMIT $3`,
      [opts.schema ?? null, opts.filter ?? null, opts.limit],
    )
    return (result.rows ?? []).map((row) => ({
      schema: String(row.schema),
      name: String(row.name),
      kind: String(row.kind),
      rows: row.rows === null || row.rows === undefined ? null : Number(row.rows),
    }))
  },
  tableColumns: async (handle, ref): Promise<ColumnRow[]> => {
    const { schema, name } = parseTableRef(ref, 'public')
    const result = await (handle as Pool).query(
      `SELECT c.column_name AS column, c.udt_name AS type,
              c.character_maximum_length AS max_length,
              c.numeric_precision AS precision, c.numeric_scale AS scale,
              (c.is_nullable = 'YES') AS nullable,
              (c.is_identity = 'YES') AS identity,
              c.column_default AS default,
              EXISTS (
                SELECT 1 FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu
                  ON kcu.constraint_name = tc.constraint_name
                 AND kcu.table_schema = tc.table_schema
                WHERE tc.constraint_type = 'PRIMARY KEY'
                  AND tc.table_schema = c.table_schema
                  AND tc.table_name = c.table_name
                  AND kcu.column_name = c.column_name
              ) AS primary_key
       FROM information_schema.columns c
       WHERE c.table_schema = $1 AND c.table_name = $2
       ORDER BY c.ordinal_position`,
      [schema, name],
    )
    return (result.rows ?? []).map((row) => ({
      column: String(row.column),
      type: String(row.type),
      max_length: row.max_length === null || row.max_length === undefined ? null : Number(row.max_length),
      precision: row.precision === null || row.precision === undefined ? null : Number(row.precision),
      scale: row.scale === null || row.scale === undefined ? null : Number(row.scale),
      nullable: row.nullable === true,
      identity: row.identity === true,
      primaryKey: row.primary_key === true,
      default: row.default === null || row.default === undefined ? null : String(row.default),
    }))
  },
}

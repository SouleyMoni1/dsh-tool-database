/**
 * 引擎注册表。
 */

import type { EngineKind } from '../core.js'
import { mysqlAdapter } from './mysql.js'
import { postgresAdapter } from './postgres.js'
import { sqlserverAdapter } from './sqlserver.js'
import type { EngineAdapter } from './types.js'

const adapters: Record<EngineKind, EngineAdapter> = {
  sqlserver: sqlserverAdapter,
  postgres: postgresAdapter,
  mysql: mysqlAdapter,
}

export function adapterOf(kind: EngineKind): EngineAdapter {
  const adapter = adapters[kind]
  if (!adapter) throw new Error('db: 不支持的引擎: ' + String(kind))
  return adapter
}

export type { ColumnRow, EngineAdapter, ExecuteOutput, ProbeOutput, QueryOutput, TableListOptions, TableRow } from './types.js'

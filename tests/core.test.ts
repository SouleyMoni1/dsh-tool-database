import { describe, expect, it } from 'vitest'
import {
  clampLimit,
  describeSource,
  engineInfo,
  formatColumnType,
  normalizeValue,
  parseSources,
  parseTableRef,
  resolvePassword,
  serializeRows,
} from '../src/core.ts'
import {
  assertReadonlySql,
  assertWriteSql,
  isDdlSql,
  isReadonlySql,
  isSingleStatement,
  isWriteSql,
  stripLiterals,
} from '../src/sql-guard.ts'

describe('isReadonlySql', () => {
  it('allows read-only statements', () => {
    expect(isReadonlySql('SELECT * FROM users')).toBe(true)
    expect(isReadonlySql('select top 10 * from users')).toBe(true)
    expect(isReadonlySql('WITH x AS (SELECT 1 AS n) SELECT * FROM x')).toBe(true)
    expect(isReadonlySql('VALUES (1), (2)')).toBe(true)
    expect(isReadonlySql('SELECT a FROM t WITH (NOLOCK)')).toBe(true)
  })

  it('rejects writes and DDL', () => {
    expect(isReadonlySql('INSERT INTO t VALUES (1)')).toBe(false)
    expect(isReadonlySql('UPDATE t SET a = 1')).toBe(false)
    expect(isReadonlySql('DELETE FROM t')).toBe(false)
    expect(isReadonlySql('CREATE TABLE x (a INT)')).toBe(false)
    expect(isReadonlySql('DROP TABLE t')).toBe(false)
    expect(isReadonlySql('TRUNCATE TABLE t')).toBe(false)
  })

  it('rejects SELECT INTO and dynamic execution', () => {
    expect(isReadonlySql('SELECT * INTO #tmp FROM users')).toBe(false)
    expect(isReadonlySql('SELECT * INTO dbo.copy FROM users')).toBe(false)
    expect(isReadonlySql('EXEC sp_who')).toBe(false)
    expect(isReadonlySql("SELECT * FROM OPENROWSET('SQLNCLI', 'x', 'y')")).toBe(false)
  })

  it('rejects multi-statement input', () => {
    expect(isReadonlySql('SELECT 1; SELECT 2')).toBe(false)
    expect(isSingleStatement('SELECT 1;')).toBe(true)
    expect(isSingleStatement('SELECT 1; SELECT 2')).toBe(false)
  })

  it('does not trip on keywords inside literals, comments or quoted identifiers', () => {
    expect(isReadonlySql("SELECT 'DELETE FROM t' AS sample")).toBe(true)
    expect(isReadonlySql('SELECT a FROM t -- DROP TABLE t')).toBe(true)
    expect(isReadonlySql('SELECT [update] FROM t')).toBe(true)
    expect(isReadonlySql('SELECT `update` FROM t')).toBe(true)
    expect(isReadonlySql("SELECT a FROM t WHERE b = ';'")).toBe(true)
    expect(isSingleStatement("SELECT ';' AS s")).toBe(true)
  })
})

describe('stripLiterals', () => {
  const norm = (sql: string): string => stripLiterals(sql).replace(/\s+/g, ' ').trim()

  it('removes strings, comments and quoted identifiers', () => {
    expect(norm("SELECT 'a''b' FROM [my table] /* c */ -- d")).toBe('SELECT FROM')
    expect(norm('SELECT [update] FROM t -- DROP TABLE t')).toBe('SELECT FROM t')
    expect(norm('SELECT 1 /* note */ + 2')).toBe('SELECT 1 + 2')
    expect(norm("SELECT 'x'")).toBe('SELECT')
  })
})

describe('assertReadonlySql', () => {
  it('accepts a plain select', () => {
    expect(() => assertReadonlySql('SELECT 1')).not.toThrow()
  })
  it('explains the rejection', () => {
    expect(() => assertReadonlySql('SELECT 1; SELECT 2')).toThrow(/单条语句/)
    expect(() => assertReadonlySql('DELETE FROM t')).toThrow(/只读通道/)
    expect(() => assertReadonlySql('   ')).toThrow(/不能为空/)
  })
})

describe('write channel guards', () => {
  it('classifies statements', () => {
    expect(isWriteSql('INSERT INTO t (a) VALUES (1)')).toBe(true)
    expect(isWriteSql('MERGE INTO t USING s ON 1=1 WHEN MATCHED THEN DELETE;')).toBe(true)
    expect(isWriteSql('SELECT 1')).toBe(false)
    expect(isDdlSql('ALTER TABLE t ADD c INT')).toBe(true)
    expect(isDdlSql('SELECT 1')).toBe(false)
  })

  it('enforces source switches', () => {
    expect(() =>
      assertWriteSql('INSERT INTO t (a) VALUES (1)', { allowDdl: false, allowBatch: false }),
    ).not.toThrow()
    expect(() => assertWriteSql('DROP TABLE t', { allowDdl: false, allowBatch: false })).toThrow(/allowDdl/)
    expect(() => assertWriteSql('DROP TABLE t', { allowDdl: true, allowBatch: false })).not.toThrow()
    expect(() =>
      assertWriteSql('INSERT INTO t (a) VALUES (1); INSERT INTO t (a) VALUES (2)', {
        allowDdl: false,
        allowBatch: false,
      }),
    ).toThrow(/单条语句/)
    expect(() =>
      assertWriteSql('INSERT INTO t (a) VALUES (1); INSERT INTO t (a) VALUES (2)', {
        allowDdl: false,
        allowBatch: true,
      }),
    ).not.toThrow()
  })

  it('rejects privilege escalation and non-write statements', () => {
    expect(() => assertWriteSql("EXEC xp_cmdshell 'dir'", { allowDdl: true, allowBatch: true })).toThrow(/写通道|提权/)
    expect(() => assertWriteSql('SELECT 1', { allowDdl: false, allowBatch: false })).toThrow(/写通道/)
  })
})

describe('table references', () => {
  it('parses table references', () => {
    expect(parseTableRef('users')).toEqual({ schema: 'dbo', name: 'users' })
    expect(parseTableRef('sales.orders')).toEqual({ schema: 'sales', name: 'orders' })
    expect(parseTableRef('[sales].[orders]')).toEqual({ schema: 'sales', name: 'orders' })
    expect(parseTableRef('"public"."users"')).toEqual({ schema: 'public', name: 'users' })
    expect(parseTableRef('users', 'public')).toEqual({ schema: 'public', name: 'users' })
    expect(() => parseTableRef('')).toThrow(/不能为空/)
  })
})

describe('formatColumnType', () => {
  it('renders length and precision per engine', () => {
    expect(formatColumnType({ type: 'nvarchar', max_length: 100 })).toBe('nvarchar(50)')
    expect(formatColumnType({ type: 'nvarchar', max_length: -1 })).toBe('nvarchar(max)')
    expect(formatColumnType({ type: 'varchar', max_length: 50 })).toBe('varchar(50)')
    expect(formatColumnType({ type: 'decimal', precision: 18, scale: 2 })).toBe('decimal(18,2)')
    expect(formatColumnType({ type: 'int' })).toBe('int')
    expect(formatColumnType({ type: 'varchar', max_length: 32, engine: 'postgres' })).toBe('varchar(32)')
  })
})

describe('normalizeValue', () => {
  it('converts driver values to JSON-safe shapes', () => {
    expect(normalizeValue(null)).toBeNull()
    expect(normalizeValue(undefined)).toBeNull()
    expect(normalizeValue(42)).toBe(42)
    expect(normalizeValue(10n)).toBe('10')
    const date = new Date('2026-01-02T03:04:05.000Z')
    expect(normalizeValue(date)).toBe('2026-01-02T03:04:05.000Z')
    expect(normalizeValue(Buffer.from([0xde, 0xad]))).toBe('0xdead')
    expect(normalizeValue({ a: 1 })).toBe('{"a":1}')
  })
})

describe('serializeRows', () => {
  it('caps rows and reports truncation', () => {
    const rows = [
      [1, 'x'],
      [2, 'y'],
    ]
    const r = serializeRows(rows, ['a', 'b'], 1)
    expect(r.columns).toEqual(['a', 'b'])
    expect(r.rows).toEqual([[1, 'x']])
    expect(r.truncated).toBe(true)
    expect(r.rowCount).toBe(2)
  })
  it('keeps column order when empty', () => {
    expect(serializeRows([], ['a', 'b'], 10)).toEqual({
      columns: ['a', 'b'],
      rows: [],
      truncated: false,
      rowCount: 0,
    })
  })
})

describe('clampLimit', () => {
  it('bounds the row budget', () => {
    expect(clampLimit(undefined)).toBe(100)
    expect(clampLimit(10)).toBe(10)
    expect(clampLimit(0)).toBe(1)
    expect(clampLimit(9999)).toBe(500)
    expect(clampLimit(Number.NaN)).toBe(100)
  })
})

describe('parseSources', () => {
  const good = { id: 'prod_WMS', host: '10.0.0.9', database: 'demo_erp', user: 'reader' }

  it('normalizes a valid list', () => {
    const [s] = parseSources([good])
    expect(s).toMatchObject({ id: 'prod_WMS', host: '10.0.0.9', port: 1433, engine: 'sqlserver' })
    expect(s?.writable).toBe(false)
    expect(s?.allowDdl).toBe(false)
    expect(s?.encrypt).toBe(false)
    expect(s?.trustServerCertificate).toBe(true)
  })

  it('accepts the legacy "server" key and engine-specific default ports', () => {
    const [legacy] = parseSources([{ id: 'old', server: '10.0.0.9' }])
    expect(legacy).toMatchObject({ host: '10.0.0.9', server: '10.0.0.9', port: 1433 })
    const [pg] = parseSources([{ id: 'pg', engine: 'postgres', host: 'db', database: 'app' }])
    expect(pg?.port).toBe(engineInfo('postgres').defaultPort)
    const [my] = parseSources([{ id: 'my', engine: 'mysql', host: 'db' }])
    expect(my?.port).toBe(3306)
  })

  it('honours explicit switches', () => {
    const [s] = parseSources([{ ...good, writable: true, allowDdl: true, encrypt: true, port: 1444 }])
    expect(s).toMatchObject({ writable: true, allowDdl: true, encrypt: true, port: 1444 })
  })

  it('fails fast on bad input', () => {
    expect(() => parseSources({})).toThrow(/必须是数组/)
    expect(() => parseSources([{ host: 'x' }])).toThrow(/id 不能为空/)
    expect(() => parseSources([good, good])).toThrow(/id 重复/)
    expect(() => parseSources([{ id: 'a' }])).toThrow(/缺少 host/)
    expect(() => parseSources([{ ...good, port: 0 }])).toThrow(/port 非法/)
    expect(() => parseSources([{ ...good, engine: 'oracle' }])).toThrow(/engine 不支持/)
  })
})

describe('credential boundary', () => {
  const source = parseSources([
    { id: 'prod', host: 'h', engine: 'postgres', user: 'u', password: 'plain', passwordEnv: 'MSSQL_PROD_PW' },
  ])[0]!

  it('never exposes the password in the model-facing view', () => {
    const view = describeSource(source)
    expect(view).toMatchObject({ id: 'prod', engine: 'postgres', hasPassword: true, writable: false })
    expect(JSON.stringify(view)).not.toContain('plain')
    expect(JSON.stringify(view)).not.toContain('MSSQL_PROD_PW')
  })

  it('prefers passwordEnv and fails loudly when it is missing', () => {
    expect(resolvePassword(source, { MSSQL_PROD_PW: 'from-env' })).toBe('from-env')
    expect(() => resolvePassword(source, {})).toThrow(/MSSQL_PROD_PW/)
    const plainOnly = parseSources([{ id: 'dev', host: 'h', password: 'devpw' }])[0]!
    expect(resolvePassword(plainOnly, {})).toBe('devpw')
  })
})

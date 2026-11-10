import { describe, expect, it } from 'vitest'
import { hasTopLevelOrderBy, pageSql } from '../src/pagination.js'

describe('pageSql', () => {
  it('SQL Server：没有 ORDER BY 时补一个稳定占位排序', () => {
    expect(pageSql('sqlserver', 'SELECT a FROM t', 100, 50)).toBe(
      'SELECT a FROM t ORDER BY (SELECT NULL) OFFSET 100 ROWS FETCH NEXT 50 ROWS ONLY',
    )
  })

  it('SQL Server：已有顶层 ORDER BY 就直接接 OFFSET', () => {
    expect(pageSql('sqlserver', 'SELECT a FROM t ORDER BY a', 0, 20)).toBe(
      'SELECT a FROM t ORDER BY a OFFSET 0 ROWS FETCH NEXT 20 ROWS ONLY',
    )
    expect(hasTopLevelOrderBy('SELECT ROW_NUMBER() OVER (ORDER BY a) AS rn FROM t')).toBe(false)
  })

  it('SQL Server：CTE / TOP / 子查询里的 ORDER BY 不误判', () => {
    expect(pageSql('sqlserver', 'WITH c AS (SELECT 1 AS a) SELECT a FROM c', 0, 10)).toContain('OFFSET 0 ROWS')
    expect(hasTopLevelOrderBy('SELECT TOP 10 a FROM t ORDER BY a')).toBe(true)
  })

  it('已经写了分页 / FOR JSON 的语句不再拼', () => {
    expect(pageSql('sqlserver', 'SELECT a FROM t ORDER BY a OFFSET 0 ROWS FETCH NEXT 10 ROWS ONLY', 10, 10)).toBeNull()
    expect(pageSql('sqlserver', 'SELECT a FROM t FOR JSON AUTO', 0, 10)).toBeNull()
  })

  it('TOP / DISTINCT / 无 ORDER BY 的 UNION 不能拼 OFFSET，退化成单页', () => {
    expect(pageSql('sqlserver', 'SELECT TOP 2 name FROM sys.databases', 0, 10)).toBeNull()
    expect(pageSql('sqlserver', 'SELECT DISTINCT a FROM t', 0, 10)).toBeNull()
    expect(pageSql('sqlserver', 'SELECT a FROM t UNION SELECT b FROM u', 0, 10)).toBeNull()
    expect(pageSql('sqlserver', 'SELECT a FROM t UNION SELECT b FROM u ORDER BY a', 0, 10)).toBe(
      'SELECT a FROM t UNION SELECT b FROM u ORDER BY a OFFSET 0 ROWS FETCH NEXT 10 ROWS ONLY',
    )
  })

  it('PostgreSQL / MySQL 用 LIMIT OFFSET', () => {
    expect(pageSql('postgres', 'SELECT a FROM t', 20, 10)).toBe('SELECT a FROM t LIMIT 10 OFFSET 20')
    expect(pageSql('mysql', 'SELECT a FROM t;', 0, 5)).toBe('SELECT a FROM t LIMIT 5 OFFSET 0')
    expect(pageSql('mysql', 'SELECT a FROM t LIMIT 5', 0, 5)).toBeNull()
  })
})

/**
 * 多语句脚本：拆分、逐条校验、批量执行结果的单测（不碰网络）。
 */

import { describe, expect, it } from 'vitest'
import {
  assertReadonlyScript,
  assertWriteScript,
  splitStatements,
} from '../src/sql-guard.js'

describe('splitStatements', () => {
  it('按分号拆开，忽略首尾空白与空语句', () => {
    expect(splitStatements('SELECT 1; SELECT 2;')).toEqual(['SELECT 1', 'SELECT 2'])
    expect(splitStatements('  ;;  ')).toEqual([])
  })

  it('字符串、注释、引号标识符里的分号不拆', () => {
    expect(splitStatements("SELECT ';' AS s; SELECT 2")).toEqual(["SELECT ';' AS s", 'SELECT 2'])
    expect(splitStatements('-- a; b\nSELECT 1')).toEqual(['-- a; b\nSELECT 1'])
    expect(splitStatements('/* a;b */ SELECT 1; SELECT 2')).toEqual(['/* a;b */ SELECT 1', 'SELECT 2'])
    expect(splitStatements('SELECT [a;b] FROM t; SELECT 2')).toEqual(['SELECT [a;b] FROM t', 'SELECT 2'])
  })

  it('没有分号时按行首关键字切分', () => {
    expect(splitStatements('SELECT 1\nSELECT 2')).toEqual(['SELECT 1', 'SELECT 2'])
    expect(splitStatements('SELECT a,\n       b\nFROM t\n\nSELECT 2')).toEqual(['SELECT a,\n       b\nFROM t', 'SELECT 2'])
    expect(splitStatements('UPDATE t SET a = 1\nWHERE id = 2\nSELECT 3')).toEqual([
      'UPDATE t SET a = 1\nWHERE id = 2',
      'SELECT 3',
    ])
  })

  it('跨行没写完的语句不会被切开', () => {
    expect(splitStatements('SELECT a FROM t\nUNION ALL\nSELECT b FROM u')).toHaveLength(1)
    expect(splitStatements('SELECT * FROM t\nWHERE id IN (\nSELECT id FROM u)')).toHaveLength(1)
    expect(splitStatements('INSERT INTO t (a)\nSELECT a FROM s')).toHaveLength(1)
    expect(splitStatements('WITH c AS (SELECT 1 AS a)\nSELECT a FROM c')).toHaveLength(1)
  })

  it('单独一行的 GO 也当批处理分隔符', () => {
    expect(splitStatements('SELECT 1\nGO\nSELECT 2')).toEqual(['SELECT 1', 'SELECT 2'])
    expect(splitStatements('SELECT\nGO')).toEqual(['SELECT'])
    expect(splitStatements('SELECT 1;\n-- 收尾注释\n')).toEqual(['SELECT 1'])
  })
})

describe('脚本级断言', () => {
  it('只读脚本逐条校验，写语句混进来就拒绝', () => {
    expect(assertReadonlyScript('SELECT 1; SELECT 2')).toHaveLength(2)
    expect(() => assertReadonlyScript('SELECT 1; UPDATE t SET a = 1')).toThrow(/只读通道/)
    expect(() => assertReadonlyScript('')).toThrow(/不能为空/)
  })

  it('写脚本逐条校验：第二条不是写语句也拒绝', () => {
    expect(assertWriteScript('UPDATE t SET a = 1; INSERT INTO t (a) VALUES (1)', { allowDdl: false, allowBatch: true })).toHaveLength(2)
    expect(() => assertWriteScript('UPDATE t SET a = 1; DROP TABLE t', { allowDdl: false, allowBatch: true })).toThrow(/allowDdl/)
    expect(() => assertWriteScript('UPDATE t SET a = 1; SELECT 1', { allowDdl: false, allowBatch: true })).toThrow(/写通道/)
    expect(() => assertWriteScript('UPDATE t SET a = 1; UPDATE t SET a = 2', { allowDdl: false, allowBatch: false })).toThrow(/allowBatch/)
  })
})

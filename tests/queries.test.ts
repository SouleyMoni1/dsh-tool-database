/**
 * 查询页签存储（queries.json）的单测：不碰网络、不碰真实数据库。
 */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { deleteTab, listTabs, normalizeTab, queriesPathFor, readQueriesFile, saveTab } from '../src/query-store.js'

const dirs: string[] = []

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'dbx-queries-'))
  dirs.push(dir)
  return dir
}

afterEach(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
  dirs.length = 0
})

function tab(id: string, extra: Record<string, unknown> = {}) {
  return Object.assign({ id: id, title: 'SELECT 1', sql: 'SELECT 1', updatedAt: 1, closed: false, named: false }, extra)
}

describe('queries.json', () => {
  it('缺文件时返回空清单', () => {
    const path = queriesPathFor(join(tempDir(), 'sources.json'))
    expect(readQueriesFile(path)).toEqual({ version: 1, sources: {} })
    expect(listTabs(path, 'a')).toEqual([])
  })

  it('新增、覆盖、按源隔离', () => {
    const path = queriesPathFor(join(tempDir(), 'sources.json'))
    saveTab(path, 'src-a', tab('q1'))
    saveTab(path, 'src-b', tab('q2', { title: '', sql: '', updatedAt: 2, closed: true }))
    expect(listTabs(path, 'src-a').map((item) => item.id)).toEqual(['q1'])
    expect(listTabs(path, 'src-b').map((item) => item.id)).toEqual(['q2'])

    saveTab(path, 'src-a', tab('q1', { title: '改了', sql: 'SELECT 2', updatedAt: 3 }))
    const list = listTabs(path, 'src-a')
    expect(list).toHaveLength(1)
    expect(list[0].sql).toBe('SELECT 2')
    expect(list[0].title).toBe('改了')
  })

  it('自定义命名标记会保存下来', () => {
    const path = queriesPathFor(join(tempDir(), 'sources.json'))
    saveTab(path, 'src-a', tab('q1', { title: '月度产量核对', named: true }))
    expect(listTabs(path, 'src-a')[0]).toMatchObject({ title: '月度产量核对', named: true })
    saveTab(path, 'src-a', tab('q1', { title: 'SELECT 1', named: false }))
    expect(listTabs(path, 'src-a')[0].named).toBe(false)
  })

  it('关闭的页签保留、删除后消失', () => {
    const path = queriesPathFor(join(tempDir(), 'sources.json'))
    saveTab(path, 'src-a', tab('q1', { closed: true }))
    expect(listTabs(path, 'src-a')[0].closed).toBe(true)
    expect(deleteTab(path, 'src-a', 'q1')).toBe(true)
    expect(listTabs(path, 'src-a')).toEqual([])
    expect(deleteTab(path, 'src-a', 'q1')).toBe(false)
  })

  it('非法 JSON 明确报错，非法页签被过滤', () => {
    const dir = tempDir()
    const path = queriesPathFor(join(dir, 'sources.json'))
    writeFileSync(path, '{ not json', 'utf8')
    expect(() => readQueriesFile(path)).toThrow(/不是合法 JSON/)

    writeFileSync(path, JSON.stringify({ version: 1, sources: { a: [{ id: 'ok', sql: 'x' }, { sql: 'no id' }] } }), 'utf8')
    expect(listTabs(path, 'a').map((item) => item.id)).toEqual(['ok'])
    expect(listTabs(path, 'a')[0].closed).toBe(false)
    expect(listTabs(path, 'a')[0].named).toBe(false)
  })

  it('normalizeTab 兜底默认值', () => {
    expect(normalizeTab(null)).toBeNull()
    expect(normalizeTab({ sql: 'x' })).toBeNull()
    expect(normalizeTab({ id: ' q1 ' })).toEqual({
      id: 'q1',
      title: '',
      sql: '',
      updatedAt: expect.any(Number),
      closed: false,
      named: false,
    })
    expect(normalizeTab({ id: 'q1', named: true, title: '月度产量' })?.named).toBe(true)
  })
})

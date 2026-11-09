/**
 * 连接字符串互转 + 清单/控制台配置读写 + 迁移的单测（不碰网络、不碰真实数据库）。
 */

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { SourceConfig } from '../src/core.js'
import { PASSWORD_SENTINEL, envNameOf, formatDsn, parseDsn } from '../src/dsn.js'
import {
  migrateLegacySources,
  readConsoleConfig,
  readSourcesFile,
  removeSource,
  upsertSource,
  writeConsoleConfig,
  writeSourcesFile,
} from '../src/settings-store.js'

const dirs: string[] = []
function scratch(): string {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-db-test-'))
  dirs.push(dir)
  return dir
}
afterEach(() => {
  while (dirs.length) rmSync(dirs.pop() as string, { recursive: true, force: true })
})

const SAMPLE: SourceConfig = {
  id: 'prod_WMS',
  engine: 'sqlserver',
  description: '【正式·只读】',
  host: '10.0.0.9',
  port: 1433,
  database: 'demo_erp',
  user: 'reader',
  password: 'p@ss word',
  writable: false,
  allowDdl: false,
}

describe('parseDsn', () => {
  it('解析 sqlserver:// 形式并还原百分号编码', () => {
    expect(parseDsn('sqlserver://reader:p%40ss@10.0.0.9:1433/demo_erp')).toEqual({
      engine: 'sqlserver',
      host: '10.0.0.9',
      port: 1433,
      database: 'demo_erp',
      user: 'reader',
      password: 'p@ss',
    })
  })

  it('省略端口取引擎默认端口，省略库名/账号也成立', () => {
    expect(parseDsn('mssql://10.0.0.9/DemoBarCode')).toMatchObject({
      engine: 'sqlserver',
      host: '10.0.0.9',
      port: 1433,
      database: 'DemoBarCode',
    })
    expect(parseDsn('postgres://u:p@pg:5432/app')).toMatchObject({ engine: 'postgres', port: 5432 })
    expect(parseDsn('mysql://u:p@my/app')).toMatchObject({ engine: 'mysql', port: 3306 })
  })

  it('支持 ADO 风格 Server=host,port;Database=…;User Id=…;Password=…', () => {
    expect(parseDsn('Server=10.0.0.9,1533;Database=DemoBarCode_Test;User Id=reader2;Password=abc')).toEqual({
      engine: 'sqlserver',
      host: '10.0.0.9',
      port: 1533,
      database: 'DemoBarCode_Test',
      user: 'reader2',
      password: 'abc',
    })
  })

  it('拒绝空串、非法协议、非法端口', () => {
    expect(() => parseDsn('  ')).toThrow(/不能为空/)
    expect(() => parseDsn('oracle://a@b/c')).toThrow(/不支持的连接串前缀/)
    expect(() => parseDsn('sqlserver://h:99999/db')).toThrow(/无法解析|端口非法/)
  })
})

describe('formatDsn', () => {
  it('mask 时只回显哨兵，明文密码不外泄', () => {
    const masked = formatDsn(SAMPLE, { mask: true })
    expect(masked).toBe('sqlserver://reader:' + PASSWORD_SENTINEL + '@10.0.0.9:1433/demo_erp')
    expect(masked).not.toContain('p@ss')
  })

  it('非 mask 时明文可被 parseDsn 读回（密码含特殊字符也成立）', () => {
    const plain = formatDsn(SAMPLE)
    expect(parseDsn(plain).password).toBe('p@ss word')
    expect(parseDsn(plain).engine).toBe('sqlserver')
  })

  it('各引擎输出对应 scheme', () => {
    const pg: SourceConfig = { id: 'pg', engine: 'postgres', host: 'h', user: 'u', database: 'd' }
    expect(formatDsn(pg)).toBe('postgres://u@h:5432/d')
    const my: SourceConfig = { id: 'my', engine: 'mysql', host: 'h', user: 'u', database: 'd' }
    expect(formatDsn(my)).toBe('mysql://u@h:3306/d')
  })

  it('passwordEnv 回显为 ${ENV} 占位而不是编码后的乱码', () => {
    const viaEnv: SourceConfig = { id: 'x', host: 'h', user: 'u', passwordEnv: 'MSSQL_PW' }
    const text = formatDsn(viaEnv, { mask: true })
    expect(text).toBe('sqlserver://u:${MSSQL_PW}@h:1433')
    expect(envNameOf(parseDsn(text).password)).toBe('MSSQL_PW')
  })

  it('没有账号时不输出 @', () => {
    expect(formatDsn({ id: 'x', host: 'h', database: 'd' })).toBe('sqlserver://h:1433/d')
  })
})

describe('settings-store', () => {
  it('文件不存在时视为空清单', () => {
    expect(readSourcesFile(join(scratch(), 'nope.json'))).toEqual([])
  })

  it('写回后可读回，且字段顺序稳定、无 undefined', () => {
    const file = join(scratch(), 'sources.json')
    writeSourcesFile(file, [SAMPLE])
    const text = readFileSync(file, 'utf8')
    expect(text.endsWith('\n')).toBe(true)
    expect(text).not.toContain('undefined')
    expect(Object.keys(JSON.parse(text)[0])).toEqual([
      'id',
      'engine',
      'stage',
      'description',
      'host',
      'port',
      'database',
      'user',
      'password',
      'writable',
    ])
    const back = readSourcesFile(file)[0] as SourceConfig
    expect(back).toMatchObject({ ...SAMPLE, server: SAMPLE.host })
    expect(back.stage).toBe('prod')
    expect(back.port).toBe(1433)
    expect(back.writable).toBe(false)
  })

  it('stage 写回后按 dev/test/prod 原样读回', () => {
    const file = join(scratch(), 'stages.json')
    writeSourcesFile(file, [
      { ...SAMPLE, id: 'a_dev', stage: 'dev' },
      { ...SAMPLE, id: 'b_test', stage: 'test' },
      { ...SAMPLE, id: 'c_prod', stage: 'prod' },
    ])
    expect(readSourcesFile(file).map((item) => item.stage)).toEqual(['dev', 'test', 'prod'])
  })

  it('upsert 追加 / 改名 / 撞 id 报错', () => {
    const list: SourceConfig[] = [{ id: 'a', host: 'h1' }]
    const added = upsertSource(list, { id: 'b', host: 'h2' })
    expect(added.map((item) => item.id)).toEqual(['a', 'b'])
    const renamed = upsertSource(added, { id: 'c', host: 'h2' }, 'b')
    expect(renamed.map((item) => item.id)).toEqual(['a', 'c'])
    expect(() => upsertSource(renamed, { id: 'a', host: 'h3' }, 'zzz')).toThrow(/已存在/)
    expect(upsertSource(renamed, { id: 'a', host: 'h3' })[0]).toEqual({ id: 'a', host: 'h3' })
  })

  it('remove 删除，删不存在的 id 报错', () => {
    const list: SourceConfig[] = [{ id: 'a', host: 'h1' }, { id: 'b', host: 'h2' }]
    expect(removeSource(list, 'a').map((item) => item.id)).toEqual(['b'])
    expect(() => removeSource(list, 'zzz')).toThrow(/不存在/)
  })

  it('JSON 非法时报可读错误', () => {
    const file = join(scratch(), 'bad.json')
    writeFileSync(file, '{ oops', 'utf8')
    expect(() => readSourcesFile(file)).toThrow(/不是合法 JSON/)
  })

  it('控制台配置默认值与读写', () => {
    const dir = scratch()
    const file = join(dir, 'config.json')
    expect(readConsoleConfig(file)).toEqual({ writeMode: 'source', limit: 100 })
    writeConsoleConfig({ writeMode: 'readonly', limit: 50 }, file)
    expect(readConsoleConfig(file)).toEqual({ writeMode: 'readonly', limit: 50 })
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({ writeMode: 'readonly', limit: 50 })
    writeFileSync(file, '{ bad', 'utf8')
    expect(readConsoleConfig(file)).toEqual({ writeMode: 'source', limit: 100 })
  })

  it('老清单迁移只复制一次', () => {
    const dir = scratch()
    const legacy = join(dir, 'old', 'sources.json')
    const target = join(dir, 'new', 'sources.json')
    writeFileSync(join(dir, 'marker'), '', 'utf8')
    writeSourcesFile(legacy, [SAMPLE])
    expect(migrateLegacySources(legacy, target)).toBe(true)
    expect(readSourcesFile(target)[0]).toMatchObject({ id: 'prod_WMS', host: '10.0.0.9' })
    expect(migrateLegacySources(legacy, target)).toBe(false)
  })
})

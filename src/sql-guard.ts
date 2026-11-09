/**
 * SQL 护栏（方言无关部分）：只读白名单、单语句判定、写通道双闸门、提权禁词。
 */

const READONLY_PREFIXES = ['SELECT', 'WITH', 'VALUES']
const WRITE_PREFIXES = ['INSERT', 'UPDATE', 'DELETE', 'MERGE']
const DDL_PREFIXES = ['CREATE', 'ALTER', 'DROP', 'TRUNCATE']

/** 只读通道的禁词：SELECT INTO、动态执行、跨源读取、DDL/DML 与实例级操作。 */
const READONLY_DENY =
  /\b(INTO|EXEC|EXECUTE|DBCC|WAITFOR|OPENROWSET|OPENQUERY|OPENDATASOURCE|BULK|SHUTDOWN|RECONFIGURE|KILL|BACKUP|RESTORE|GRANT|REVOKE|DENY|USE|SET|CREATE|ALTER|DROP|TRUNCATE|MERGE|INSERT|UPDATE|DELETE)\b/i

/** 写通道也一律拒绝的提权/外联关键字。 */
const WRITE_DENY =
  /\b(xp_[a-z_]+|sp_configure|OPENROWSET|OPENQUERY|OPENDATASOURCE|BULK|SHUTDOWN|RECONFIGURE|KILL|BACKUP|RESTORE|GRANT|REVOKE)\b/i

/** 剥离字符串字面量、注释与带引号标识符，只留下可判定的 SQL 骨架。 */
export function stripLiterals(sql: string): string {
  let out = ''
  let i = 0
  const n = sql.length
  while (i < n) {
    const ch = sql[i] as string
    if (ch === "'") {
      i++
      while (i < n) {
        if (sql[i] === "'") {
          if (sql[i + 1] === "'") {
            i += 2
            continue
          }
          i++
          break
        }
        i++
      }
      out += ' '
    } else if (ch === '-' && sql[i + 1] === '-') {
      while (i < n && sql[i] !== '\n') i++
      out += ' '
    } else if (ch === '/' && sql[i + 1] === '*') {
      i += 2
      while (i < n && !(sql[i] === '*' && sql[i + 1] === '/')) i++
      i += 2
      out += ' '
    } else if (ch === '"' || ch === '[' || ch === '`') {
      const close = ch === '[' ? ']' : ch
      i++
      while (i < n) {
        if (sql[i] === close) {
          if (sql[i + 1] === close) {
            i += 2
            continue
          }
          i++
          break
        }
        i++
      }
      out += ' '
    } else {
      out += ch
      i++
    }
  }
  return out
}

/** 单条语句判定：结尾分号允许，中间出现分号即视为多语句。 */
export function isSingleStatement(sql: string): boolean {
  return !stripLiterals(sql).replace(/;+\s*$/, '').includes(';')
}

function firstKeyword(body: string): string {
  const m = /^\s*([A-Za-z_][A-Za-z_0-9]*)/.exec(body)
  return m?.[1]?.toUpperCase() ?? ''
}

/** 只读通道准入：以只读关键字开头 + 单语句 + 未命中禁词。 */
export function isReadonlySql(sql: string): boolean {
  const body = stripLiterals(sql)
  if (!body.trim()) return false
  if (!READONLY_PREFIXES.includes(firstKeyword(body))) return false
  if (!isSingleStatement(sql)) return false
  return !READONLY_DENY.test(body)
}

export function isWriteSql(sql: string): boolean {
  return WRITE_PREFIXES.includes(firstKeyword(stripLiterals(sql)))
}

export function isDdlSql(sql: string): boolean {
  return DDL_PREFIXES.includes(firstKeyword(stripLiterals(sql)))
}

/** 只读通道断言；不通过直接抛错（错误文案给模型自纠）。 */
export function assertReadonlySql(sql: string): void {
  if (!sql || !sql.trim()) throw new Error('db: SQL 不能为空')
  if (!isSingleStatement(sql)) {
    throw new Error('db: 只读通道只接受单条语句，检测到分号分隔的多语句')
  }
  if (!isReadonlySql(sql)) {
    throw new Error('db: 只读通道仅放行 SELECT / WITH / VALUES 单条查询；写操作请用 db_execute')
  }
}

/** 写通道断言：源开关 + 语句类别 + 提权禁词。 */
export function assertWriteSql(sql: string, opts: { allowDdl: boolean; allowBatch: boolean }): void {
  const body = stripLiterals(sql)
  if (!body.trim()) throw new Error('db: SQL 不能为空')
  if (!opts.allowBatch && !isSingleStatement(sql)) {
    throw new Error('db: 写通道默认只允许单条语句；需要批量执行请在源配置打开 allowBatch')
  }
  const head = firstKeyword(body)
  if (DDL_PREFIXES.includes(head)) {
    if (!opts.allowDdl) throw new Error('db: 当前源未开启 allowDdl，拒绝执行 DDL')
  } else if (!WRITE_PREFIXES.includes(head)) {
    throw new Error('db: 写通道只接受 INSERT / UPDATE / DELETE / MERGE（或已开启 allowDdl 的 DDL）')
  }
  if (WRITE_DENY.test(body)) throw new Error('db: 语句命中提权/外联关键字，已拒绝')
}

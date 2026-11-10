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

/** 把脚本拆成单条语句：分号分隔（字符串 / 注释 / 引号标识符里的分号不算），另支持 SSMS 风格的单独一行 GO。 */
export function splitStatements(sql: string): string[] {
  const chunks: string[] = []
  let buf = ''
  let i = 0
  const n = sql.length
  const push = () => {
    const trimmed = buf.trim()
    if (trimmed) chunks.push(trimmed)
    buf = ''
  }
  while (i < n) {
    const ch = sql[i] as string
    if (ch === "'" || ch === '"' || ch === '[' || ch === '`') {
      const close = ch === '[' ? ']' : ch
      buf += ch
      i++
      while (i < n) {
        buf += sql[i]
        if (sql[i] === close) {
          if (sql[i + 1] === close) {
            buf += sql[i + 1]
            i += 2
            continue
          }
          i++
          break
        }
        i++
      }
      continue
    }
    if (ch === '-' && sql[i + 1] === '-') {
      while (i < n && sql[i] !== '\n') {
        buf += sql[i]
        i++
      }
      continue
    }
    if (ch === '/' && sql[i + 1] === '*') {
      while (i < n && !(sql[i] === '*' && sql[i + 1] === '/')) {
        buf += sql[i]
        i++
      }
      if (i < n) {
        buf += '*/'
        i += 2
      }
      continue
    }
    if (ch === ';') {
      push()
      i++
      continue
    }
    buf += ch
    i++
  }
  push()
  // GO 只作为批处理分隔符，不能当语句执行
  const out: string[] = []
  for (const chunk of chunks) {
    let piece = ''
    for (const line of chunk.split(/\r?\n/)) {
      if (/^\s*GO\s*$/i.test(line)) {
        const trimmed = piece.trim()
        if (trimmed) out.push(trimmed)
        piece = ''
        continue
      }
      piece += line + '\n'
    }
    const trimmed = piece.trim()
    if (trimmed) out.push(trimmed)
  }
  const merged: string[] = []
  for (const chunk of out) {
    for (const part of splitByKeywordLine(chunk)) merged.push(part)
  }
  // 纯注释的行不算一条语句（否则尾部写个注释就会报“不支持的语句类型”）
  return merged.filter((item) => stripLiterals(item).trim().length > 0)
}

/** 只读脚本断言：逐条校验，全部是 SELECT / WITH / VALUES 才放行，返回拆好的语句。 */
export function assertReadonlyScript(sql: string): string[] {
  const parts = splitStatements(sql)
  if (parts.length === 0) throw new Error('db: SQL 不能为空')
  for (const part of parts) assertReadonlySql(part)
  return parts
}

/** 写脚本断言：逐条校验（类别 / DDL 开关 / 提权禁词），批量需要 allowBatch。 */
export function assertWriteScript(sql: string, opts: { allowDdl: boolean; allowBatch: boolean }): string[] {
  const parts = splitStatements(sql)
  if (parts.length === 0) throw new Error('db: SQL 不能为空')
  if (parts.length > 1 && !opts.allowBatch) {
    throw new Error('db: 写通道默认只允许单条语句；需要批量执行请在源配置打开 allowBatch')
  }
  for (const part of parts) assertWriteSql(part, { allowDdl: opts.allowDdl, allowBatch: true })
  return parts
}

/** 新语句行首关键字：没有分号的脚本靠它切分（启发式，推荐还是写 ;）。 */
const BATCH_STARTERS = new Set([
  'SELECT',
  'WITH',
  'VALUES',
  'INSERT',
  'UPDATE',
  'DELETE',
  'MERGE',
  'CREATE',
  'ALTER',
  'DROP',
  'TRUNCATE',
  'EXEC',
  'EXECUTE',
  'DECLARE',
  'SET',
  'USE',
  'BEGIN',
  'COMMIT',
  'ROLLBACK',
  'IF',
  'WHILE',
  'PRINT',
  'RAISERROR',
])

/** 上一行以这些结尾说明语句还没写完，不能在这里切。 */
const CONTINUE_TAIL =
  /([,()\[+\-*/%<>=|&^~!.]|\b(and|or|not|in|is|like|between|then|else|when|union|intersect|except|all|any|some|join|on|from|into|by|as|case|values|using|apply|over|exists|set|return|begin|end))\s*$/i

function parenDelta(text: string): number {
  let delta = 0
  for (const ch of text) {
    if (ch === '(') delta++
    else if (ch === ')') delta--
  }
  return delta
}

/** 没有分号时按「行首新语句关键字」切分；遇到括号未闭合、上一行是逗号/运算符/连接词时不切。 */
export function splitByKeywordLine(chunk: string): string[] {
  const lines = chunk.split(/\r?\n/)
  const out: string[] = []
  let current: string[] = []
  let depth = 0
  let prevContinues = true
  let hasContent = false
  const flush = () => {
    const text = current.join('\n').trim()
    if (text) out.push(text)
    current = []
  }
  for (const line of lines) {
    const skeleton = stripLiterals(line)
    const head = /^\s*([A-Za-z_][A-Za-z_0-9]*)/.exec(skeleton)?.[1]?.toUpperCase()
    const startsWithParen = /^\s*\(/.test(skeleton)
    const isCommentOnly = skeleton.trim().length === 0 && line.trim().length > 0
    if (
      depth === 0 &&
      hasContent &&
      !prevContinues &&
      !startsWithParen &&
      head !== undefined &&
      BATCH_STARTERS.has(head)
    ) {
      flush()
    }
    current.push(line)
    if (!isCommentOnly) {
      depth = Math.max(0, depth + parenDelta(skeleton))
    }
    if (skeleton.trim().length > 0) {
      hasContent = true
      prevContinues = CONTINUE_TAIL.test(skeleton.trim())
    }
  }
  flush()
  return out
}

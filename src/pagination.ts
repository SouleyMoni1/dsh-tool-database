/**
 * 结果集分页：给单条只读语句拼上引擎自己的分页子句，翻页时不用把整个结果拉回内存。
 * 拼不出来（已经带 OFFSET / LIMIT / FOR JSON 等）就返回 null，调用方退化成单页。
 */

import type { EngineKind } from './core.js'
import { stripLiterals } from './sql-guard.js'

/** 把括号深度 > 0 的字符抹成空格，只留下顶层骨架，方便判断顶层子句。 */
function topLevelMask(sql: string): string {
  const skeleton = stripLiterals(sql)
  let depth = 0
  let out = ''
  for (let i = 0; i < skeleton.length; i++) {
    const ch = skeleton[i] as string
    if (ch === '(') {
      depth++
      out += ' '
      continue
    }
    if (ch === ')') {
      depth = Math.max(0, depth - 1)
      out += ' '
      continue
    }
    out += depth > 0 ? ' ' : ch
  }
  return out
}

export function hasTopLevelOrderBy(sql: string): boolean {
  return /\border\s+by\b/i.test(topLevelMask(sql))
}

/** 能分页返回拼好的 SQL，不能分页返回 null。 */
export function pageSql(engine: EngineKind, sql: string, offset: number, size: number): string | null {
  const body = sql.trim().replace(/;+$/, '')
  if (!body) return null
  if (offset < 0 || size <= 0) return null
  const masked = topLevelMask(body)
  if (/\bfor\s+(json|xml|browse)\b/i.test(masked)) return null
  if (engine === 'sqlserver') {
    if (/\boffset\b/i.test(masked) || /\bfetch\s+next\b/i.test(masked)) return null
    // TOP / DISTINCT / UNION 与 OFFSET-FETCH 不能共存（会直接报错），这类语句退化成单页
    if (/\btop\b/i.test(masked)) return null
    if (/\bdistinct\b/i.test(masked)) return null
    if (/\b(union|except|intersect)\b/i.test(masked) && !hasTopLevelOrderBy(body)) return null
    const tail = ' OFFSET ' + String(offset) + ' ROWS FETCH NEXT ' + String(size) + ' ROWS ONLY'
    return hasTopLevelOrderBy(body)
      ? body + tail
      : body + ' ORDER BY (SELECT NULL)' + tail
  }
  if (/\blimit\b/i.test(masked) || /\boffset\b/i.test(masked)) return null
  return body + ' LIMIT ' + String(size) + ' OFFSET ' + String(offset)
}

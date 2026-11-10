/**
 * dsh-tool-database 浏览器半区。
 *
 * 两个落点：
 *   1. 左侧栏「数据库」面板（main + sidebar.panellist）：左连接列表 + 右查询控制台 / 连接表单；
 *   2. 设置页「数据库」节（settings.section）：控制台默认行数与写策略。
 *
 * 形态说明：DSH 客户端插件必须是单文件、且以 window.__ModuleLoader__.load({ id, factory })
 * 注册工厂；运行时只注入平台 seed（react / react-dom / @deepseek-ai/cordis /
 * @deepseek-ai/dsh-client-ui-* 等），所以这里只 require react 与官方控件库，其余零依赖。
 *
 * 数据流：fetch POST /api/dsh-tool-database（connection 的精确 Fetch 路由，自动带同源围栏），
 * 信封 { channel, endpoint, payload }，宿主侧见 src/settings-rpc.ts。
 */
window.__ModuleLoader__.load({
  id: 'dsh-tool-database',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    const React = require('react')
    const primitives = require('@deepseek-ai/dsh-client-ui-primitives')
    const h = React.createElement
    const Button = primitives.Button
    const Input = primitives.Input
    const Switch = primitives.Switch

    /** 路由与通道必须与 src/settings-rpc.ts 一致。 */
    const RPC_PATH = '/api/dsh-tool-database'
    /** locale 命名空间。 */
    const NS = 'dsh-tool-database'
    /** 设置页标签页 id。 */
    const SECTION_ID = 'database-sources'
    /** 侧栏面板 id（main key + sidebar.panellist id 必须一致）。 */
    const VIEW_ID = 'database'
    /** 列表「按类型分组」偏好的 localStorage key。 */
    const GROUP_KEY = 'dsh-tool-database.group'
    /** 连接列表宽度偏好的 localStorage key。 */
    const SIDE_WIDTH_KEY = 'dsh-tool-database.sideWidth'
    const SIDE_MIN = 180
    const SIDE_MAX = 560

    const zh = {
      view: '数据库',
      nav: '数据库连接',
      title: '数据库连接与查询',
      intro: '左侧管理连接（SQL Server / PostgreSQL / MySQL），右侧直接跑 SQL。改动写回宿主侧清单文件，即时生效。',
      search: '搜索连接 / 主机 / 库',
      add: '新建连接',
      reload: '刷新',
      empty: '还没有连接，点「新建连接」开始。',
      pick: '从左侧选一个连接，或新建一个。',
      engineHint: '支持 SQL Server / PostgreSQL / MySQL。连接与密码只留在本机宿主进程里，模型看到的是源句柄与查询结果，永远拿不到密码。',
      engineHintShort: 'SQL Server / PostgreSQL / MySQL · 密码只留在本机',
      configDriven: '当前连接来自插件 config.sources，本页改动不生效；先清空 config.sources。',
      engine: '引擎',
      stage: '类型',
      groupByStage: '按类型分组',
      ungrouped: '不分组',
      idLabel: '别名（id）',
      idHint: '工具用 source=<别名> 指定它；字母/数字/下划线/点/连字符。',
      descLabel: '描述',
      host: '主机',
      port: '端口',
      database: '数据库',
      user: '账号',
      password: '密码',
      passwordHint: '留空保持原密码；写 ${环境变量名} 表示从环境变量读取（推荐）。',
      savedPasswordMask: '••••••',
      savedPasswordShow: '已保存密码，留空表示不修改',
      ssl: 'TLS / SSL',
      writable: '允许写入',
      writableHint: '打开后 db_execute 才能写（仍需显式 allowWrite）。',
      allowDdl: '允许 DDL',
      ddlHint: '额外放行 CREATE / ALTER / DROP / TRUNCATE。',
      test: '测试连接',
      testing: '连接中…',
      save: '保存',
      saving: '保存中…',
      remove: '删除',
      confirmRemove: '确认删除？',
      cancel: '取消',
      advanced: '高级：直接用连接字符串',
      showPassword: '显示密码',
      hidePassword: '隐藏密码',
      resize: '拖动调整列表宽度',
      dsn: '连接字符串',
      dsnHint: 'sqlserver:// / postgres:// / mysql:// 账号:密码@主机:端口/库名。填了这一项就忽略上面的主机表单。',
      newTitle: '新建连接',
      editTitle: '连接设置',
      saved: '已保存。',
      removed: '已删除。',
      testOK: '连接成功',
      query: '查询',
      sql: 'SQL',
      copyResult: '复制结果',
      copied: '已复制',
      copyFailed: '复制失败',
      columnTag: '字段',
      tableTag: '表',
      untitledQuery: '查询',
      newTab: '新建查询页签',
      closeTab: '关闭页签（保留在历史里）',
      historyLabel: '历史页签',
      historyHint: '页签与 SQL 自动保存到本机，关掉的页签进这里',
      historyEmpty: '还没有历史页签',
      deleteTab: '彻底删除',
      renameHint: '双击页签可重命名',
      resultTag: '结果',
      execTag: '执行',
      statementFailed: '第 {n} 条语句失败',
      prevPage: '上一页',
      nextPage: '下一页',
      pageOf: '第 {n} 页',
      rowsPerPage: '行/页',
      noPaging: '该语句无法翻页（TOP / DISTINCT / UNION），加 WHERE 或改写后再看全部',
      splitHint: '上下拖动调整编辑器与结果的高度',
      run: '执行',
      runSelected: '执行已选择',
      runHint: '执行全部（Ctrl / Cmd + Enter）',
      runSelectedHint: '只执行选中的 SQL（Ctrl / Cmd + Enter）',
      rowNo: '#',
      resizeHint: '拖动调整列宽',
      running: '执行中…',
      rows: '行',
      elapsed: '耗时',
      truncated: '已截断（超过行数上限）',
      writeMode: '控制台写策略',
      writeModeSource: '跟随数据源（推荐）',
      writeModeReadonly: '一律只读',
      writeModeAlways: '始终允许写',
      limit: '默认行数',
      consoleSaving: '保存中…',
      consoleSaved: '已保存。',
      consoleTitle: '控制台设置',
      file: '清单文件',
      settingsIntro: '连接管理在左侧栏的「数据库」面板里；这里只放控制台的全局参数。',
      wrote: '已执行',
      affected: '影响行数',
      result: '结果',
    }

    const en = {
      view: 'Database',
      nav: 'Database connections',
      title: 'Database connections & query',
      intro: 'Manage connections (SQL Server / PostgreSQL / MySQL) on the left, run SQL on the right. Changes are written back to the host list file immediately.',
      search: 'Search id / host / database',
      add: 'New connection',
      reload: 'Reload',
      empty: 'No connection yet — start with “New connection”.',
      pick: 'Pick a connection on the left, or create one.',
      engineHint: 'Supports SQL Server / PostgreSQL / MySQL. Connections and passwords stay in the local host process; the model only sees source handles and query results.',
      engineHintShort: 'SQL Server / PostgreSQL / MySQL · passwords stay local',
      configDriven: 'Connections come from the plugin config.sources; edits here have no effect until that is emptied.',
      engine: 'Engine',
      stage: 'Type',
      groupByStage: 'Group by type',
      ungrouped: 'Ungrouped',
      idLabel: 'Alias (id)',
      idHint: 'Tools address it with source=<alias>; letters / digits / underscore / dot / hyphen.',
      descLabel: 'Description',
      host: 'Host',
      port: 'Port',
      database: 'Database',
      user: 'User',
      password: 'Password',
      passwordHint: 'Leave empty to keep the current password; use ${ENV_NAME} to read it from the environment (recommended).',
      savedPasswordMask: '••••••',
      savedPasswordShow: 'Password saved; leave empty to keep it',
      ssl: 'TLS / SSL',
      writable: 'Writable',
      writableHint: 'db_execute can write only when this is on (and allowWrite is explicit).',
      allowDdl: 'Allow DDL',
      ddlHint: 'Also allow CREATE / ALTER / DROP / TRUNCATE.',
      test: 'Test',
      testing: 'Connecting…',
      save: 'Save',
      saving: 'Saving…',
      remove: 'Delete',
      confirmRemove: 'Delete this connection?',
      cancel: 'Cancel',
      advanced: 'Advanced: use a connection string',
      showPassword: 'Show password',
      hidePassword: 'Hide password',
      resize: 'Drag to resize the list',
      dsn: 'Connection string',
      dsnHint: 'sqlserver:// / postgres:// / mysql:// user:password@host:port/database. When filled, the fields above are ignored.',
      newTitle: 'New connection',
      editTitle: 'Connection settings',
      saved: 'Saved.',
      removed: 'Deleted.',
      testOK: 'Connected',
      query: 'Query',
      sql: 'SQL',
      copyResult: 'Copy result',
      copied: 'Copied',
      copyFailed: 'Copy failed',
      columnTag: 'column',
      tableTag: 'table',
      untitledQuery: 'Query',
      newTab: 'New query tab',
      closeTab: 'Close tab (kept in history)',
      historyLabel: 'History',
      historyHint: 'Tabs and SQL are saved locally; closed tabs appear here',
      historyEmpty: 'No closed tabs yet',
      deleteTab: 'Delete permanently',
      renameHint: 'Double-click a tab to rename',
      resultTag: 'Result',
      execTag: 'Exec',
      statementFailed: 'Statement {n} failed',
      prevPage: 'Prev',
      nextPage: 'Next',
      pageOf: 'Page {n}',
      rowsPerPage: 'rows/page',
      noPaging: 'This statement cannot be paged (TOP / DISTINCT / UNION); narrow it with WHERE',
      splitHint: 'Drag to resize editor and result',
      run: 'Run',
      runSelected: 'Run selection',
      runHint: 'Run whole script (Ctrl / Cmd + Enter)',
      runSelectedHint: 'Run only selected SQL (Ctrl / Cmd + Enter)',
      rowNo: '#',
      resizeHint: 'Drag to resize column',
      running: 'Running…',
      rows: 'rows',
      elapsed: 'took',
      truncated: 'Truncated (row limit reached)',
      writeMode: 'Console write policy',
      writeModeSource: 'Follow the source (recommended)',
      writeModeReadonly: 'Always read-only',
      writeModeAlways: 'Always allow writes',
      limit: 'Default rows',
      consoleSaving: 'Saving…',
      consoleSaved: 'Saved.',
      consoleTitle: 'Console settings',
      file: 'List file',
      settingsIntro: 'Connections live in the “Database” panel in the left sidebar; this page only holds console-wide defaults.',
      wrote: 'Executed',
      affected: 'Rows affected',
      result: 'Result',
    }

    async function call(endpoint, payload) {
      const response = await fetch(RPC_PATH, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ channel: RPC_PATH, endpoint: endpoint, payload: payload || {} }),
      })
      if (!response.ok) throw new Error('HTTP ' + response.status)
      const result = await response.json()
      if (!result.ok) throw new Error((result.error && result.error.message) || 'unknown error')
      return result.value
    }

    function messageOf(error) {
      return error instanceof Error ? error.message : String(error)
    }

    let styled = false
    function ensureStyles() {
      if (styled || typeof document === 'undefined') return
      styled = true
      const style = document.createElement('style')
      style.textContent = [
        '.dbx-root{display:flex;height:100%;max-height:100%;min-height:0;overflow:hidden;box-sizing:border-box;padding:14px 16px;gap:14px;font-size:13px;color:var(--dsw-alias-label-primary,inherit)}',
        '.dbx-page{display:flex;flex-direction:column;height:100%;min-height:0;box-sizing:border-box;padding:14px 16px;gap:12px;font-size:13px;color:var(--dsw-alias-label-primary,inherit)}',
        '.dbx-page-head{display:flex;align-items:baseline;gap:10px;flex:none}',
        '.dbx-page-title{font-size:15px;font-weight:600;margin:0}',
        '.dbx-cols{display:flex;flex:1;min-height:0;gap:0;border-top:1px solid var(--dsw-alias-border-l2,color-mix(in srgb,currentColor 14%,transparent));padding-top:12px}',
        '.dbx-side{display:flex;flex-direction:column;gap:8px;padding:0 8px 0 0;min-height:0;min-width:0}',
        '.dbx-resizer{width:6px;flex:none;align-self:stretch;margin:0 4px;border-radius:3px;cursor:col-resize;background:transparent;transition:background .12s}',
        '.dbx-resizer:hover{background:var(--dsw-alias-border-l2,color-mix(in srgb,currentColor 16%,transparent))}',
        '.dbx-pw{position:relative;display:block;width:100%;box-sizing:border-box}',
        '.dbx-input,.dbx-pw-input{width:100%;box-sizing:border-box;height:30px;border-radius:6px;border:1px solid var(--dsw-alias-border-l2,color-mix(in srgb,currentColor 18%,transparent));background:var(--dsw-alias-bg-layer-1,transparent);color:inherit;font:inherit;padding:0 8px;outline:none}',
        '.dbx-pw-input{padding:0 32px 0 8px}',
        '.dbx-input:focus,.dbx-pw-input:focus{border-color:var(--dsw-alias-state-accent-primary,color-mix(in srgb,currentColor 45%,transparent))}',
        '.dbx-pw-btn{position:absolute;right:6px;top:50%;transform:translateY(-50%);width:24px;height:24px;display:inline-flex;align-items:center;justify-content:center;border:0;background:transparent;color:inherit;opacity:.6;cursor:pointer;padding:0;border-radius:4px}',
        '.dbx-pw-btn:hover{opacity:1}',
        '.dbx-main{flex:1;min-width:0;display:flex;flex-direction:column;min-height:0;overflow:hidden}',
        '.dbx-side-head{display:flex;flex-direction:column;gap:6px}',
        '.dbx-search{width:100%;box-sizing:border-box;min-width:0}',
        '.dbx-side-head input,.dbx-side-head select{box-sizing:border-box;max-width:100%}',
        '.dbx-list{display:flex;flex-direction:column;gap:2px;overflow:auto;min-height:0;flex:1}',
        '.dbx-item{display:flex;flex-direction:column;gap:2px;align-items:flex-start;text-align:left;padding:7px 8px;border-radius:8px;border:1px solid transparent;background:transparent;cursor:pointer;color:inherit;font:inherit;width:100%}',
        '.dbx-item:hover{background:var(--dsw-alias-bg-layer-2,color-mix(in srgb,currentColor 6%,transparent))}',
        '.dbx-item-active{background:var(--dsw-alias-bg-layer-2,color-mix(in srgb,currentColor 8%,transparent));border-color:var(--dsw-alias-border-l2,color-mix(in srgb,currentColor 18%,transparent))}',
        '.dbx-item-top{display:flex;align-items:center;gap:6px;width:100%}',
        '.dbx-item-id{font-weight:600;font-family:var(--dsw-font-markdown-code-block,ui-monospace,monospace);font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;flex:1}',
        '.dbx-item-sub{font-size:11px;color:var(--dsw-alias-label-tertiary,color-mix(in srgb,currentColor 55%,transparent));overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%}',
        '.dbx-tag{border:1px solid var(--dsw-alias-border-l3,color-mix(in srgb,currentColor 22%,transparent));border-radius:999px;padding:0 6px;font-size:10px;line-height:16px;color:var(--dsw-alias-label-tertiary,color-mix(in srgb,currentColor 55%,transparent));white-space:nowrap}',
        '.dbx-tag-write{color:var(--dsw-alias-state-success-primary,#2ea043);border-color:currentColor}',
        '.dbx-item-tags{margin-left:auto;display:flex;align-items:center;gap:4px;flex:none}',
        '.dbx-tag-stage{font-variant-numeric:tabular-nums}',
        '.dbx-stage-dev{color:var(--dsw-alias-state-info-primary,#3b82f6);border-color:currentColor}',
        '.dbx-stage-test{color:var(--dsw-alias-state-warning-primary,#b45309);border-color:currentColor}',
        '.dbx-stage-prod{color:var(--dsw-alias-state-success-primary,#2ea043);border-color:currentColor}',
        '.dbx-group-toggle{display:flex;align-items:center;gap:14px;font-size:12px;color:var(--dsw-alias-label-secondary,color-mix(in srgb,currentColor 72%,transparent));padding:2px 0 4px}',
        '.dbx-radio{display:inline-flex;align-items:center;gap:5px;cursor:pointer;user-select:none}',
        '.dbx-radio input{accent-color:var(--dsw-alias-state-accent-primary,#111);margin:0;cursor:pointer}',
        '.dbx-group{display:flex;flex-direction:column;gap:2px}',
        '.dbx-group-head{display:flex;align-items:center;gap:6px;font-size:11px;font-weight:600;letter-spacing:.02em;color:var(--dsw-alias-label-tertiary,color-mix(in srgb,currentColor 55%,transparent));padding:8px 2px 4px}',
        '.dbx-group-count{font-weight:400;opacity:.7}',
        '.dbx-group + .dbx-group{margin-top:4px}',
        '.dbx-foot{font-size:11px;color:var(--dsw-alias-label-tertiary,color-mix(in srgb,currentColor 55%,transparent));word-break:break-all;line-height:1.5}',
        '.dbx-main-head{display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid var(--dsw-alias-border-l2,color-mix(in srgb,currentColor 14%,transparent));flex-wrap:wrap}',
        '.dbx-main-body{padding:14px;overflow:auto;flex:1;min-height:0;max-height:100%}',
        '.dbx-title{font-weight:600;font-size:14px;margin:0}',
        '.dbx-muted{color:var(--dsw-alias-label-tertiary,color-mix(in srgb,currentColor 55%,transparent));font-size:12px;line-height:1.5}',
        '.dbx-intro{font-size:14px;font-weight:600;margin:0 0 6px}',
        '.dbx-warn{border:1px solid var(--dsw-alias-state-warn-primary,#d4a72c);border-radius:8px;padding:8px 10px;font-size:12px;margin:0 0 12px}',
        '.dbx-err{border:1px solid var(--dsw-alias-state-error-primary,#d1242f);border-radius:8px;padding:8px 10px;font-size:12px;white-space:pre-wrap;margin:8px 0;color:var(--dsw-alias-state-error-primary,#d1242f)}',
        '.dbx-ok{color:var(--dsw-alias-state-success-primary,#2ea043);font-size:12px}',
        '.dbx-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px 12px;max-width:860px}',
        '.dbx-field{display:flex;flex-direction:column;gap:4px;min-width:0}',
        '.dbx-wide{grid-column:1/-1}',
        '.dbx-label{font-size:12px;color:var(--dsw-alias-label-secondary,color-mix(in srgb,currentColor 75%,transparent))}',
        '.dbx-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:14px}',
        '.dbx-select{height:30px;border-radius:6px;border:1px solid var(--dsw-alias-border-l2,color-mix(in srgb,currentColor 18%,transparent));background:var(--dsw-alias-bg-layer-1,transparent);color:inherit;font:inherit;padding:0 8px;min-width:140px}',
        '.dbx-sql{width:100%;height:100%;min-height:0;resize:none;border-radius:8px;border:1px solid var(--dsw-alias-border-l2,color-mix(in srgb,currentColor 18%,transparent));background:var(--dsw-alias-bg-layer-1,transparent);color:inherit;padding:10px;font-family:var(--dsw-font-markdown-code-block,ui-monospace,SFMono-Regular,Menlo,monospace);font-size:12px;line-height:1.55;box-sizing:border-box}',
        '.dbx-editor{display:flex;flex-direction:column;gap:6px;min-width:0}',
        '.dbx-editor-box{position:relative;width:100%;box-sizing:border-box;flex:1;min-height:0}',
        '.dbx-editor-box .dbx-sql{position:relative;z-index:1;display:block;color:transparent;background:transparent;caret-color:var(--dsw-alias-label-primary,currentColor);white-space:pre-wrap;word-break:break-word;overflow:auto;scrollbar-gutter:stable;letter-spacing:normal;word-spacing:normal;font-variant-ligatures:none;text-transform:none;tab-size:4}',
        '.dbx-editor-box .dbx-sql::selection{background:color-mix(in srgb,currentColor 22%,transparent);color:var(--dsw-alias-label-primary,#1f2328);-webkit-text-fill-color:var(--dsw-alias-label-primary,#1f2328)}',
        '.dbx-hl{position:absolute;inset:0;z-index:0;margin:0;overflow:hidden;pointer-events:none;white-space:pre-wrap;word-break:break-word;border:1px solid transparent;border-radius:8px;padding:10px calc(10px + var(--dbx-gutter,0px)) 10px 10px;font-family:var(--dsw-font-markdown-code-block,ui-monospace,SFMono-Regular,Menlo,monospace);font-size:12px;line-height:1.55;box-sizing:border-box;color:var(--dsw-alias-label-primary,inherit);letter-spacing:normal;word-spacing:normal;font-variant-ligatures:none;text-transform:none;tab-size:4}',
        '.dbx-tok-kw{color:var(--dsw-alias-state-info-primary,#2563eb)}',
        '.dbx-tok-str{color:var(--dsw-alias-state-success-primary,#15803d)}',
        '.dbx-tok-num{color:var(--dsw-alias-state-warning-primary,#b45309)}',
        '.dbx-tok-cmt{color:var(--dsw-alias-label-tertiary,color-mix(in srgb,currentColor 55%,transparent))}',
        '.dbx-tok-id{color:inherit}',
        '.dbx-sug{position:absolute;z-index:5;min-width:170px;max-width:340px;max-height:200px;overflow:auto;border-radius:8px;border:1px solid var(--dsw-alias-border-l2,color-mix(in srgb,currentColor 22%,transparent));background:var(--dsw-alias-bg-layer-1,Canvas);box-shadow:0 8px 24px rgba(0,0,0,.16);padding:4px 0}',
        '.dbx-sug-item{display:flex;align-items:center;gap:8px;padding:5px 10px;font-family:var(--dsw-font-markdown-code-block,ui-monospace,monospace);font-size:12px;cursor:pointer;white-space:nowrap;overflow:hidden;color:var(--dsw-alias-label-primary,inherit)}',
        '.dbx-sug-name{overflow:hidden;text-overflow:ellipsis}',
        '.dbx-sug-kind{margin-left:auto;flex:none;font-size:10px;opacity:.6}',
        '.dbx-sug-active{background:var(--dsw-alias-state-accent-primary,#2563eb);color:#fff}',
        '.dbx-result{display:flex;flex-direction:column;gap:6px;min-width:0}',
        '.dbx-result-bar{display:flex;align-items:center;justify-content:flex-end;gap:8px;padding:0 2px}',
        '.dbx-table-wrap{max-width:100%;overflow:auto}',
        '.dbx-status{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12px;color:var(--dsw-alias-label-tertiary,color-mix(in srgb,currentColor 55%,transparent))}',
        '.dbx-table-wrap{overflow:auto;border:1px solid var(--dsw-alias-border-l2,color-mix(in srgb,currentColor 14%,transparent));border-radius:8px;margin-top:0;max-height:52vh}',
        '.dbx-table{border-collapse:collapse;width:100%;font-size:12px}',
        '.dbx-table th,.dbx-table td{border-bottom:1px solid var(--dsw-alias-border-l1,color-mix(in srgb,currentColor 10%,transparent));padding:4px 8px;text-align:left;vertical-align:top;white-space:pre;max-width:420px;overflow:hidden;text-overflow:ellipsis}',
        '.dbx-table th{position:sticky;top:0;background:color-mix(in srgb,currentColor 7%,Canvas);font-weight:600;font-size:13px;letter-spacing:.01em;color:var(--dsw-alias-label-primary,inherit);border-bottom:1px solid color-mix(in srgb,currentColor 22%,transparent);padding:7px 8px;z-index:1}',
        '.dbx-null{color:var(--dsw-alias-label-tertiary,color-mix(in srgb,currentColor 45%,transparent));font-style:italic}',
        '.dbx-details{margin-top:12px;font-size:12px;max-width:860px;min-width:0}',
        '.dbx-details summary{cursor:pointer;color:var(--dsw-alias-label-secondary,color-mix(in srgb,currentColor 75%,transparent))}',
        '.dbx-console{display:flex;flex-direction:column;height:100%;min-height:0;overflow:hidden}',
        '.dbx-console-body{padding:12px 14px;display:flex;flex-direction:column;gap:6px;flex:1;min-height:0;overflow:hidden}',
        '.dbx-tabs{position:relative;display:flex;align-items:center;gap:8px;padding:0;flex-wrap:nowrap}',
        '.dbx-tabs-track{display:flex;align-items:center;gap:6px;flex:1;min-width:0;overflow-x:auto;overflow-y:hidden;padding-bottom:2px}',
        '.dbx-tabs-right{position:relative;flex:none;display:flex;align-items:center}',
        '.dbx-tab{display:flex;align-items:center;gap:6px;flex:none;max-width:220px;padding:5px 8px 5px 10px;border-radius:8px;border:1px solid transparent;cursor:pointer;font-size:12px;color:var(--dsw-alias-label-secondary,color-mix(in srgb,currentColor 75%,transparent));background:color-mix(in srgb,currentColor 4%,transparent)}',
        '.dbx-tab:hover{background:color-mix(in srgb,currentColor 8%,transparent)}',
        '.dbx-tab-active{background:color-mix(in srgb,currentColor 12%,transparent);border-color:color-mix(in srgb,currentColor 20%,transparent);color:var(--dsw-alias-label-primary,inherit);font-weight:600}',
        '.dbx-tab-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--dsw-font-markdown-code-block,ui-monospace,SFMono-Regular,Menlo,monospace)}',
        '.dbx-tab-close{flex:none;width:14px;height:14px;line-height:12px;text-align:center;border-radius:4px;opacity:.55;font-size:13px}',
        '.dbx-tab-close:hover{opacity:1;background:color-mix(in srgb,currentColor 16%,transparent)}',
        '.dbx-tab-add{flex:none;width:24px;height:24px;border-radius:6px;border:1px solid color-mix(in srgb,currentColor 18%,transparent);background:transparent;color:inherit;cursor:pointer;font-size:15px;line-height:1}',
        '.dbx-tab-add:hover{background:color-mix(in srgb,currentColor 10%,transparent)}',
        '.dbx-tab-hist{flex:none;height:24px;padding:0 10px;border-radius:6px;border:1px solid color-mix(in srgb,currentColor 18%,transparent);background:transparent;color:inherit;cursor:pointer;font-size:12px}',
        '.dbx-tab-hist:hover,.dbx-tab-hist-on{background:color-mix(in srgb,currentColor 10%,transparent)}',
        '.dbx-history{position:absolute;right:0;top:30px;z-index:20;width:340px;max-height:300px;overflow:auto;padding:6px;border-radius:10px;border:1px solid color-mix(in srgb,currentColor 20%,transparent);background:var(--dsw-alias-bg-layer-1,Canvas);box-shadow:0 10px 28px rgba(0,0,0,.18)}',
        '.dbx-history-empty{padding:10px;font-size:12px;color:var(--dsw-alias-label-tertiary,color-mix(in srgb,currentColor 55%,transparent))}',
        '.dbx-history-item{display:flex;align-items:flex-start;gap:6px;padding:6px 6px;border-radius:8px}',
        '.dbx-history-item:hover{background:color-mix(in srgb,currentColor 8%,transparent)}',
        '.dbx-history-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;cursor:pointer}',
        '.dbx-history-title{font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
        '.dbx-history-sql{font-size:11px;color:var(--dsw-alias-label-tertiary,color-mix(in srgb,currentColor 55%,transparent));overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--dsw-font-markdown-code-block,ui-monospace,SFMono-Regular,Menlo,monospace)}',
        '.dbx-history-del{flex:none;width:20px;height:20px;border:none;background:transparent;color:inherit;opacity:.5;cursor:pointer;border-radius:4px;font-size:13px}',
        '.dbx-history-del:hover{opacity:1;background:color-mix(in srgb,currentColor 16%,transparent)}',
        '.dbx-editor{display:flex;flex-direction:column;flex:1;min-height:0}',
        '.dbx-split{display:flex;flex-direction:column;flex:1;min-height:0}',
        '.dbx-pane-edit{display:flex;flex:none;min-height:0;overflow:hidden}',
        '.dbx-splitter{position:relative;flex:none;height:8px;margin:0 -2px;cursor:row-resize;border-radius:6px}',
        '.dbx-splitter::after{content:"";position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:46px;height:3px;border-radius:2px;background:color-mix(in srgb,currentColor 20%,transparent);transition:background .12s}',
        '.dbx-splitter:hover::after,.dbx-splitter:active::after{background:color-mix(in srgb,currentColor 42%,transparent);width:70px}',
        '.dbx-pane-result{display:flex;flex-direction:column;flex:1;min-height:0;gap:4px}',
        '.dbx-rs-tabs{display:flex;align-items:center;gap:6px;flex:none;overflow-x:auto;padding:0 0 2px}',
        '.dbx-rs-tab{flex:none;height:24px;padding:0 10px;border-radius:6px;border:1px solid color-mix(in srgb,currentColor 18%,transparent);background:transparent;color:inherit;cursor:pointer;font-size:12px}',
        '.dbx-rs-tab:hover{background:color-mix(in srgb,currentColor 10%,transparent)}',
        '.dbx-rs-tab-active{background:color-mix(in srgb,currentColor 14%,transparent);border-color:color-mix(in srgb,currentColor 30%,transparent);font-weight:600}',
        '.dbx-status-right{display:flex;align-items:center;gap:8px;flex:none}',
        '.dbx-status-text{white-space:nowrap}',
        '.dbx-table th.dbx-col-no,.dbx-table td.dbx-col-no{width:34px;min-width:34px;max-width:34px;padding-left:4px;padding-right:4px;text-align:right;color:var(--dsw-alias-label-tertiary,color-mix(in srgb,currentColor 45%,transparent));font-variant-numeric:tabular-nums}',
        '.dbx-table-fixed{table-layout:fixed}',
        '.dbx-col-resize{position:absolute;top:0;right:-4px;width:8px;height:100%;cursor:col-resize;z-index:2}',
        '.dbx-col-resize:hover{background:color-mix(in srgb,currentColor 20%,transparent)}',
        '.dbx-pg-btn{height:24px;padding:0 10px;border-radius:6px;border:1px solid color-mix(in srgb,currentColor 18%,transparent);background:transparent;color:inherit;cursor:pointer;font-size:12px}',
        '.dbx-pg-btn:hover:not(:disabled){background:color-mix(in srgb,currentColor 10%,transparent)}',
        '.dbx-pg-btn:disabled{opacity:.4;cursor:default}',
        '.dbx-pg-info{color:var(--dsw-alias-label-tertiary,color-mix(in srgb,currentColor 55%,transparent))}',
        '.dbx-pg-size{height:24px;border-radius:6px;border:1px solid color-mix(in srgb,currentColor 18%,transparent);background:transparent;color:inherit;font-size:12px;padding:0 4px}',
        '.dbx-tab-input{width:120px;border:none;border-bottom:1px solid color-mix(in srgb,currentColor 35%,transparent);background:transparent;color:inherit;font:inherit;padding:0 2px;outline:none}',
        '.dbx-tabs{flex:none}',
        '.dbx-result{flex:1;min-height:0}',
        '.dbx-table-wrap{flex:1;min-height:0;max-height:none}',
        '.dbx-console-body>.dbx-status,.dbx-console-body>.dbx-muted,.dbx-console-body>.dbx-error{flex:none}',
      ].join('\n')
      document.head.appendChild(style)
    }

    function engineLabelOf(engines, kind) {
      const found = (engines || []).find((item) => item.kind === kind)
      return found ? found.label : kind
    }

    function defaultPortOf(engines, kind) {
      const found = (engines || []).find((item) => item.kind === kind)
      return found ? found.defaultPort : 1433
    }

    function draftOf(item, engines) {
      const engine = item ? item.engine : 'sqlserver'
      return {
        originalId: item ? item.id : '',
        id: item ? item.id : '',
        engine: engine,
        stage: item ? item.stage : 'prod',
        description: item ? item.description : '',
        host: item ? item.host : '',
        port: item ? item.port : defaultPortOf(engines, engine),
        database: item ? item.database : '',
        user: item ? item.user : '',
        password: '',
        hasPassword: item ? item.hasPassword : false,
        ssl: item ? item.ssl : false,
        writable: item ? item.writable : false,
        allowDdl: item ? item.allowDdl : false,
        dsn: '',
      }
    }

    function Field(props) {
      return h(
        'label',
        { className: props.wide ? 'dbx-field dbx-wide' : 'dbx-field' },
        h('span', { className: 'dbx-label' }, props.label),
        props.children,
        props.hint ? h('span', { className: 'dbx-muted' }, props.hint) : null,
      )
    }

    /** 密码框右侧的眼睛图标：off=true 表示「已隐藏」需要划一道斜线。 */
    function EyeIcon(props) {
      return h(
        'svg',
        { width: 15, height: 15, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': 'true' },
        h('path', {
          d: 'M1.2 8S3.7 3.8 8 3.8 14.8 8 14.8 8 12.3 12.2 8 12.2 1.2 8 1.2 8Z',
          stroke: 'currentColor',
          strokeWidth: 1.2,
          strokeLinejoin: 'round',
        }),
        h('circle', { cx: 8, cy: 8, r: 2.1, stroke: 'currentColor', strokeWidth: 1.2 }),
        props.off ? h('path', { d: 'M3 13 13 3', stroke: 'currentColor', strokeWidth: 1.2, strokeLinecap: 'round' }) : null,
      )
    }

    const SQL_KEYWORDS = [
      'SELECT','FROM','WHERE','GROUP','BY','ORDER','HAVING','LIMIT','OFFSET','TOP','DISTINCT','AS','AND','OR','NOT','IN','LIKE','BETWEEN','IS','NULL','EXISTS','UNION','ALL','JOIN','LEFT','RIGHT','INNER','OUTER','FULL','CROSS','ON','INSERT','INTO','VALUES','UPDATE','SET','DELETE','CREATE','TABLE','VIEW','INDEX','ALTER','DROP','TRUNCATE','CASE','WHEN','THEN','ELSE','END','WITH','OVER','PARTITION','ASC','DESC','COUNT','SUM','AVG','MIN','MAX','CAST','CONVERT','COALESCE','ISNULL','NULLIF','GETDATE','NOW','SUBSTRING','LEN','LENGTH','TRIM','UPPER','LOWER','REPLACE','ROW_NUMBER','RANK','IF','BEGIN','COMMIT','ROLLBACK','EXEC','DECLARE','PRINT','STRING_AGG','IIF','CHARINDEX','STUFF','APPLY','FETCH','ROWS','ONLY','USE','GO',
    ]
    const KEYWORD_RE = new RegExp('^(?:' + SQL_KEYWORDS.join('|') + ')$', 'i')
    function highlightSql(text) {
      const parts = []
      const pattern = /(--[^\n]*|\/\*[\s\S]*?\*\/)|('(?:[^']|'')*'|"(?:[^"]|"")*")|\b(\d+(?:\.\d+)?)\b|([A-Za-z_][A-Za-z0-9_$]*)|(\s+)|([\s\S])/g
      let match
      let key = 0
      while ((match = pattern.exec(text)) !== null) {
        const raw = match[0]
        if (match[1]) parts.push(h('span', { key: key++, className: 'dbx-tok-cmt' }, raw))
        else if (match[2]) parts.push(h('span', { key: key++, className: 'dbx-tok-str' }, raw))
        else if (match[3]) parts.push(h('span', { key: key++, className: 'dbx-tok-num' }, raw))
        else if (match[4]) {
          parts.push(h('span', { key: key++, className: KEYWORD_RE.test(raw) ? 'dbx-tok-kw' : 'dbx-tok-id' }, raw))
        } else parts.push(h('span', { key: key++ }, raw))
        if (match.index === pattern.lastIndex) pattern.lastIndex++
      }
      return parts
    }
    const SQL_CLAUSES = [
      'SELECT','FROM','WHERE','GROUP BY','ORDER BY','HAVING','UNION ALL','UNION','INSERT INTO','VALUES',
      'UPDATE','SET','DELETE FROM','LEFT OUTER JOIN','RIGHT OUTER JOIN','LEFT JOIN','RIGHT JOIN','INNER JOIN',
      'FULL JOIN','CROSS JOIN','JOIN','ON','LIMIT','OFFSET','WITH',
    ]

    async function copyText(text) {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text)
          return true
        }
      } catch (cause) {
        /* 退回 execCommand */
      }
      try {
        const area = document.createElement('textarea')
        area.value = text
        area.style.position = 'fixed'
        area.style.opacity = '0'
        document.body.appendChild(area)
        area.select()
        const ok = document.execCommand('copy')
        document.body.removeChild(area)
        return ok
      } catch (cause) {
        return false
      }
    }

    function resultToTsv(result) {
      if (!result || !result.columns || result.columns.length === 0) return ''
      const cell = (value) => {
        if (value === null || value === undefined) return ''
        const text = typeof value === 'string' ? value : JSON.stringify(value)
        return String(text).replace(/\t/g, ' ').replace(/\r?\n/g, ' ')
      }
      const start = result.paged ? ((result.page || 1) - 1) * (result.pageSize || 0) + 1 : 1
      const lines = ['#\t' + result.columns.join('\t')]
      ;(result.rows || []).forEach((row, index) => {
        lines.push(String(start + index) + '\t' + row.map(cell).join('\t'))
      })
      return lines.join('\n')
    }
    function CopyIcon() {
      return h(
        'svg',
        { width: 14, height: 14, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': 'true' },
        h('rect', { x: 5.2, y: 5.2, width: 8, height: 8, rx: 1.6, stroke: 'currentColor', strokeWidth: 1.2 }),
        h('path', {
          d: 'M10.8 5.2V3.8c0-.6-.5-1.1-1.1-1.1H3.8c-.6 0-1.1.5-1.1 1.1v5.9c0 .6.5 1.1 1.1 1.1h1.4',
          stroke: 'currentColor',
          strokeWidth: 1.2,
          strokeLinecap: 'round',
        }),
      )
    }

    function SqlEditor(props) {
      const t = props.t
      const value = props.value
      const onChange = props.onChange
      const taRef = React.useRef(null)
      const hlRef = React.useRef(null)
      const [tables, setTables] = React.useState([])
      const [menu, setMenu] = React.useState(null)
      const highlighted = React.useMemo(() => highlightSql(value + '\n'), [value])
      const boxRef = React.useRef(null)
      const sugRef = React.useRef(null)
      React.useEffect(() => {
        const syncGutter = () => {
          const area = taRef.current
          const box = boxRef.current
          if (!area || !box) return
          const gutter = Math.max(0, area.offsetWidth - area.clientWidth - 2)
          box.style.setProperty('--dbx-gutter', gutter + 'px')
        }
        syncGutter()
        window.addEventListener('resize', syncGutter)
        return () => window.removeEventListener('resize', syncGutter)
      }, [value])

      React.useEffect(() => {
        if (!props.sourceId) return
        let alive = true
        call('meta/tables', { source: props.sourceId })
          .then((result) => {
            if (!alive || !result || !result.tables) return
            setTables(result.tables.slice(0, 500))
          })
          .catch(() => {
            /* 拿不到表名就只提示关键字 */
          })
        return () => {
          alive = false
        }
      }, [props.sourceId])

      // SQL 里出现的表（FROM / JOIN 后面的第一个标识符）→ 拉这个表的字段名做补全
      const currentTable = React.useMemo(() => {
        const matched = value.match(/\b(?:from|join|update|into)\s+([A-Za-z_][A-Za-z0-9_.$#]*)/gi)
        if (!matched || matched.length === 0) return ''
        const last = matched[matched.length - 1]
        const name = last.replace(/\b(?:from|join|update|into)\s+/i, '')
        return name.split('.').pop() || ''
      }, [value])
      const columnCache = React.useRef({})
      const [columns, setColumns] = React.useState([])
      React.useEffect(() => {
        if (!props.sourceId || !currentTable) {
          setColumns([])
          return
        }
        const key = props.sourceId + '::' + currentTable
        const cached = columnCache.current[key]
        if (cached) {
          setColumns(cached)
          return
        }
        let alive = true
        call('meta/columns', { source: props.sourceId, table: currentTable })
          .then((result) => {
            if (!alive || !result || !result.columns) return
            const names = result.columns.map((item) => item.name)
            columnCache.current[key] = names
            setColumns(names)
          })
          .catch(() => {
            if (alive) setColumns([])
          })
        return () => {
          alive = false
        }
      }, [props.sourceId, currentTable])

      // 上下键切换后把选中项滚进可视区
      React.useEffect(() => {
        if (!menu) return
        const list = sugRef.current
        if (!list) return
        const active = list.querySelector('.dbx-sug-active')
        if (active) active.scrollIntoView({ block: 'nearest' })
      }, [menu && menu.index])

      // 字段/表名是异步拿到的：拿到后如果候选框还开着，用新数据重算一次
      React.useEffect(() => {
        const area = taRef.current
        if (!area || document.activeElement !== area) return
        if (!menu) return
        openMenu(value, area.selectionStart, false)
      }, [columns, tables])

      const wordBefore = (text, caret) => {
        const matched = text.slice(0, caret).match(/[A-Za-z_][A-Za-z0-9_]*$/)
        return { prefix: matched ? matched[0] : '', start: matched ? caret - matched[0].length : caret }
      }
      const openMenu = (text, caret, force) => {
        const { prefix, start } = wordBefore(text, caret)
        const afterDot = caret > 0 && text.charAt(caret - 1) === '.'
        const minLength = columns.length > 0 ? 1 : 2
        if (!force && !afterDot && prefix.length < minLength) {
          setMenu(null)
          return
        }
        const lower = prefix.toLowerCase()
        const pool = columns.map((name) => ({ name: name, kind: 'col' }))
          .concat(SQL_KEYWORDS.map((name) => ({ name: name, kind: 'kw' })))
          .concat(tables.map((name) => ({ name: name, kind: 'tbl' })))
        const seen = {}
        const items = []
        for (const item of pool) {
          const lowered = item.name.toLowerCase()
          if (lower && lowered.indexOf(lower) !== 0) continue
          if (lowered === lower) continue
          if (seen[lowered]) continue
          seen[lowered] = true
          items.push(item)
          if (items.length >= 12) break
        }
        const point = caretPoint(caret)
        const box = boxRef.current
        if (box) point.left = Math.min(point.left, Math.max(0, box.clientWidth - 350))
        setMenu(items.length ? { items: items, start: start, end: caret, index: 0, point: point } : null)
      }
      /** 光标在输入框里的像素位置（相对编辑器外框），用于把候选列表挂到光标下面。 */
      const caretPoint = (caret) => {
        const area = taRef.current
        const box = boxRef.current
        if (!area || !box) return { left: 0, top: 0 }
        const cs = window.getComputedStyle(area)
        const mirror = document.createElement('div')
        const props = [
          'font-family',
          'font-size',
          'font-weight',
          'font-style',
          'line-height',
          'letter-spacing',
          'word-spacing',
          'font-variant-ligatures',
          'text-transform',
          'tab-size',
          'padding-top',
          'padding-right',
          'padding-bottom',
          'padding-left',
          'border-top-width',
          'border-right-width',
          'border-bottom-width',
          'border-left-width',
          'box-sizing',
        ]
        let css = 'position:absolute;left:0;top:0;visibility:hidden;white-space:pre-wrap;word-break:break-word;'
        for (const name of props) {
          const camel = name.replace(/-(\w)/g, (all, ch) => ch.toUpperCase())
          css += name + ':' + cs[camel] + ';'
        }
        mirror.style.cssText = css + 'width:' + area.clientWidth + 'px;'
        mirror.textContent = value.slice(0, caret)
        const marker = document.createElement('span')
        marker.textContent = 'x'
        mirror.appendChild(marker)
        document.body.appendChild(mirror)
        const markerRect = marker.getBoundingClientRect()
        const mirrorRect = mirror.getBoundingClientRect()
        document.body.removeChild(mirror)
        const lineHeight = parseFloat(cs.lineHeight) || 18
        const left = markerRect.left - mirrorRect.left - area.scrollLeft
        const top = markerRect.top - mirrorRect.top - area.scrollTop + lineHeight
        return { left: Math.max(0, Math.round(left)), top: Math.max(0, Math.round(top)) }
      }
      const accept = (item) => {
        if (!menu) return
        const name = item && item.name ? item.name : String(item)
        const next = value.slice(0, menu.start) + name + ' ' + value.slice(menu.end)
        onChange(next)
        setMenu(null)
        const caret = menu.start + name.length + 1
        window.requestAnimationFrame(() => {
          const area = taRef.current
          if (area) {
            area.focus()
            area.setSelectionRange(caret, caret)
          }
        })
      }
      const onKeyDown = (event) => {
        const area = event.target
        if (menu) {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            const delta = event.key === 'ArrowDown' ? 1 : -1
            setMenu(Object.assign({}, menu, { index: (menu.index + delta + menu.items.length) % menu.items.length }))
            return
          }
          if (event.key === 'Enter' || event.key === 'Tab') {
            event.preventDefault()
            accept(menu.items[menu.index])
            return
          }
          if (event.key === 'Escape') {
            event.preventDefault()
            setMenu(null)
            return
          }
        }
        if (event.key === 'Tab') {
          event.preventDefault()
          const start = area.selectionStart
          const end = area.selectionEnd
          onChange(value.slice(0, start) + '  ' + value.slice(end))
          window.requestAnimationFrame(() => area.setSelectionRange(start + 2, start + 2))
          return
        }
        if (event.key === ' ' && (event.ctrlKey || event.metaKey)) {
          event.preventDefault()
          openMenu(value, area.selectionStart, true)
          return
        }
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
          event.preventDefault()
          setMenu(null)
          props.onRun(value.slice(area.selectionStart, area.selectionEnd))
        }
      }
      const syncScroll = (event) => {
        const hl = hlRef.current
        if (!hl) return
        hl.scrollTop = event.target.scrollTop
        hl.scrollLeft = event.target.scrollLeft
      }
      return h(
        'div',
        { className: 'dbx-editor' },

        h(
          'div',
          { className: 'dbx-editor-box', ref: boxRef },
          h('pre', { className: 'dbx-hl', ref: hlRef, 'aria-hidden': 'true' }, highlighted),
          h('textarea', {
            className: 'dbx-sql',
            ref: taRef,
            value: value,
            spellCheck: false,
            placeholder: 'SELECT TOP 10 * FROM ...',
            onKeyDown: onKeyDown,
            onSelect: (event) => {
              const area = event.target
              if (props.onSelectionChange) {
                props.onSelectionChange(area.value.slice(area.selectionStart, area.selectionEnd))
              }
            },
            onKeyUp: (event) => {
              const area = event.target
              if (props.onSelectionChange) {
                props.onSelectionChange(area.value.slice(area.selectionStart, area.selectionEnd))
              }
            },
            onScroll: syncScroll,
            onChange: (event) => {
              onChange(event.target.value)
              openMenu(event.target.value, event.target.selectionStart, false)
            },
            onBlur: () => setMenu(null),
          }),
          menu
            ? h(
                'div',
                {
                  className: 'dbx-sug',
                  ref: sugRef,
                  style: {
                    left: (menu.point ? menu.point.left : 0) + 'px',
                    top: (menu.point ? menu.point.top : 0) + 'px',
                  },
                },
                menu.items.map((item, index) =>
                  h(
                    'div',
                    {
                      key: item.kind + ':' + item.name,
                      className: index === menu.index ? 'dbx-sug-item dbx-sug-active' : 'dbx-sug-item',
                      onMouseEnter: () => setMenu(Object.assign({}, menu, { index: index })),
                      onMouseDown: (event) => {
                        event.preventDefault()
                        accept(item)
                      },
                    },
                    h('span', { className: 'dbx-sug-name' }, item.name),
                    item.kind === 'col'
                      ? h('span', { className: 'dbx-sug-kind' }, t('columnTag'))
                      : item.kind === 'tbl'
                        ? h('span', { className: 'dbx-sug-kind' }, t('tableTag'))
                        : null,
                  ),
                ),
              )
            : null,
        ),
      )
    }
    // 列宽缓存：同一个结果列组合重跑时沿用上次拖出来的宽度
    const columnWidths = new Map()
    const ResultTable = React.memo(function ResultTable(props) {
      const result = props.result
      const t = props.t
      const columns = result && result.columns ? result.columns : []
      const signature = columns.join('\u0001')
      const tableRef = React.useRef(null)
      const colRefs = React.useRef([])
      const cached = React.useMemo(() => {
        const found = columnWidths.get(signature)
        return found && found.length === columns.length + 1 ? found.slice() : null
      }, [signature, columns.length])
      const applyWidths = (list) => {
        const table = tableRef.current
        if (!table) return
        list.forEach((width, index) => {
          const col = colRefs.current[index]
          if (col) col.style.width = width + 'px'
        })
        table.style.width = list.reduce((sum, width) => sum + width, 0) + 'px'
      }
      const startResize = (index, event) => {
        event.preventDefault()
        event.stopPropagation()
        const table = tableRef.current
        if (!table) return
        const widths = [].slice.call(table.querySelectorAll('thead th')).map(function (th) {
          return th.offsetWidth
        })
        const startX = event.clientX
        const startWidth = widths[index]
        const move = (moveEvent) => {
          widths[index] = Math.max(40, Math.round(startWidth + moveEvent.clientX - startX))
          applyWidths(widths)
        }
        const up = () => {
          window.removeEventListener('mousemove', move)
          window.removeEventListener('mouseup', up)
          document.body.style.cursor = ''
          document.body.style.userSelect = ''
          columnWidths.set(signature, widths.slice())
        }
        document.body.style.cursor = 'col-resize'
        document.body.style.userSelect = 'none'
        window.addEventListener('mousemove', move)
        window.addEventListener('mouseup', up)
      }
      if (!result) return null
      if (columns.length === 0) {
        return h(
          'div',
          { className: 'dbx-muted' },
          t('wrote') + ' · ' + t('affected') + ': ' + String(result.rowsAffected == null ? 0 : result.rowsAffected),
        )
      }
      const rowStart = result.paged ? ((result.page || 1) - 1) * (result.pageSize || 0) + 1 : 1
      const totalWidth = cached ? cached.reduce((sum, width) => sum + width, 0) : 0
      return h(
        'div',
        { className: 'dbx-result' },
        h(
          'div',
          { className: 'dbx-table-wrap' },
          h(
            'table',
            {
              className: cached ? 'dbx-table dbx-table-fixed' : 'dbx-table',
              ref: tableRef,
              style: cached ? { width: totalWidth + 'px' } : undefined,
            },
            h(
              'colgroup',
              null,
              [t('rowNo')].concat(columns).map(function (_col, index) {
                return h('col', {
                  key: index,
                  ref: function (el) {
                    colRefs.current[index] = el
                  },
                  style: cached && cached[index] ? { width: cached[index] + 'px' } : undefined,
                })
              }),
            ),
            h(
              'thead',
              null,
              h(
                'tr',
                null,
                h('th', { key: '__no', className: 'dbx-col-no' }, t('rowNo')),
                columns.map(function (col, index) {
                  return h(
                    'th',
                    { key: col },
                    col,
                    h('span', {
                      className: 'dbx-col-resize',
                      title: t('resizeHint'),
                      onMouseDown: function (event) {
                        startResize(index + 1, event)
                      },
                    }),
                  )
                }),
              ),
            ),
            h(
              'tbody',
              null,
              result.rows.map(function (row, rowIndex) {
                return h(
                  'tr',
                  { key: rowIndex },
                  h('td', { key: '__no', className: 'dbx-col-no' }, String(rowStart + rowIndex)),
                  row.map(function (value, colIndex) {
                    if (value === null || value === undefined) {
                      return h('td', { key: colIndex }, h('span', { className: 'dbx-null' }, 'NULL'))
                    }
                    const text = typeof value === 'string' ? value : JSON.stringify(value)
                    return h('td', { key: colIndex, title: text }, text)
                  }),
                )
              }),
            ),
          ),
        ),
      )
    })

    function ConnectionForm(props) {
      const t = props.t
      const draft = props.draft
      const setDraft = props.setDraft
      const busy = props.busy
      const engines = props.engines
      const note = props.note
      const showDsn = props.showDsn
      const setShowDsn = props.setShowDsn
      const [showPassword, setShowPassword] = React.useState(false)
      const patch = (next) => setDraft((prev) => Object.assign({}, prev, next))
      const changeEngine = (nextEngine) => {
        const oldDefault = defaultPortOf(engines, draft.engine)
        const nextDefault = defaultPortOf(engines, nextEngine)
        patch({ engine: nextEngine, port: draft.port === oldDefault || !draft.port ? nextDefault : draft.port })
      }
      return h(
        'div',
        { className: 'dbx-main-body' },
        h('h3', { className: 'dbx-title' }, draft.originalId ? t('editTitle') : t('newTitle')),
        h(
          'div',
          { className: 'dbx-grid', style: { marginTop: '12px' } },
          h(
            Field,
            { label: t('engine') },
            h(
              'select',
              {
                className: 'dbx-select',
                value: draft.engine,
                disabled: busy !== '',
                onChange: (event) => changeEngine(event.target.value),
              },
              (engines || []).map((item) => h('option', { key: item.kind, value: item.kind }, item.label)),
            ),
          ),
          h(
            Field,
            { label: t('idLabel'), hint: t('idHint') },
            h(Input, {
              value: draft.id,
              disabled: busy !== '',
              placeholder: 'prod_WMS',
              onChange: (event) => patch({ id: event.target.value }),
            }),
          ),
          h(
            Field,
            { label: t('stage') },
            h(
              'select',
              {
                className: 'dbx-select',
                value: draft.stage,
                disabled: busy !== '',
                onChange: (event) => patch({ stage: event.target.value }),
              },
              (props.stages || []).map((item) => h('option', { key: item.kind, value: item.kind }, item.label)),
            ),
          ),
          h(
            Field,
            { label: t('descLabel') },
            h(Input, {
              value: draft.description,
              disabled: busy !== '',
              placeholder: '【示例·只读】10.0.0.9/DemoERP',
              onChange: (event) => patch({ description: event.target.value }),
            }),
          ),
          h(
            Field,
            { label: t('host') },
            h(Input, {
              value: draft.host,
              disabled: busy !== '' || showDsn,
              placeholder: '10.0.0.9',
              onChange: (event) => patch({ host: event.target.value }),
            }),
          ),
          h(
            Field,
            { label: t('port') },
            h(Input, {
              value: String(draft.port || ''),
              disabled: busy !== '' || showDsn,
              placeholder: '1433',
              onChange: (event) => patch({ port: event.target.value.replace(/[^0-9]/g, '') }),
            }),
          ),
          h(
            Field,
            { label: t('database') },
            h(Input, {
              value: draft.database,
              disabled: busy !== '' || showDsn,
              placeholder: 'DemoERP',
              onChange: (event) => patch({ database: event.target.value }),
            }),
          ),
          h(
            Field,
            { label: t('user') },
            h(Input, {
              value: draft.user,
              disabled: busy !== '' || showDsn,
              placeholder: 'readonly',
              onChange: (event) => patch({ user: event.target.value }),
            }),
          ),
          h(
            Field,
            { label: t('password'), hint: t('passwordHint'), wide: true },
            h(
              'span',
              { className: 'dbx-pw' },
              h('input', {
                className: 'dbx-pw-input',
                type: showPassword ? 'text' : 'password',
                value: draft.password,
                disabled: busy !== '' || showDsn,
                placeholder: draft.hasPassword
                  ? showPassword
                    ? t('savedPasswordShow')
                    : t('savedPasswordMask')
                  : '',
                autoComplete: 'new-password',
                onChange: (event) => patch({ password: event.target.value }),
              }),
              h(
                'button',
                {
                  type: 'button',
                  className: 'dbx-pw-btn',
                  title: showPassword ? t('hidePassword') : t('showPassword'),
                  'aria-label': showPassword ? t('hidePassword') : t('showPassword'),
                  tabIndex: -1,
                  'aria-pressed': showPassword,
                  onMouseDown: (event) => event.preventDefault(),
                  onClick: () => setShowPassword(!showPassword),
                },
                showPassword ? EyeIcon({ off: true }) : EyeIcon({ off: false }),
              ),
            ),
          ),
          h(
            Field,
            { label: t('ssl') },
            h(Switch, {
              checked: draft.ssl,
              disabled: busy !== '' || showDsn,
              label: t('ssl'),
              onChange: (next) => patch({ ssl: next }),
            }),
          ),
          h(
            Field,
            { label: t('writable'), hint: t('writableHint') },
            h(Switch, {
              checked: draft.writable,
              disabled: busy !== '',
              label: t('writable'),
              onChange: (next) => patch({ writable: next }),
            }),
          ),
          h(
            Field,
            { label: t('allowDdl'), hint: t('ddlHint') },
            h(Switch, {
              checked: draft.allowDdl,
              disabled: busy !== '',
              label: t('allowDdl'),
              onChange: (next) => patch({ allowDdl: next }),
            }),
          ),
        ),
        h(
          'details',
          { className: 'dbx-details', open: showDsn },
          h(
            'summary',
            {
              onClick: (event) => {
                // 取消浏览器默认的展开/收起，否则它会在 React 写入 open 之后再翻一次
                event.preventDefault()
                setShowDsn(!showDsn)
              },
            },
            t('advanced'),
          ),
          showDsn
            ? h(
                'div',
                { className: 'dbx-field dbx-wide', style: { marginTop: '8px' } },
                h('input', {
                  className: 'dbx-input',
                  value: draft.dsn,
                  disabled: busy !== '',
                  placeholder: 'sqlserver://user:password@host:1433/database',
                  onChange: (event) => patch({ dsn: event.target.value }),
                }),
                h('span', { className: 'dbx-muted' }, t('dsnHint')),
              )
            : null,
        ),
        h(
          'div',
          { className: 'dbx-actions' },
          h(
            Button,
            { size: 'sm', variant: 'primary', disabled: busy !== '', onClick: () => void props.onSave() },
            busy === 'save' ? t('saving') : t('save'),
          ),
          h(
            Button,
            { size: 'sm', variant: 'outline', disabled: busy !== '', onClick: () => void props.onTest() },
            busy === 'test' ? t('testing') : t('test'),
          ),
          draft.originalId
            ? h(
                Button,
                {
                  size: 'sm',
                  variant: 'ghost',
                  disabled: busy !== '',
                  onClick: () => void props.onRemove(draft.originalId),
                },
                t('remove'),
              )
            : null,
          h(
            Button,
            { size: 'sm', variant: 'ghost', disabled: busy !== '', onClick: () => props.onCancel() },
            t('cancel'),
          ),
          note ? h('span', { className: note.kind === 'ok' ? 'dbx-ok' : 'dbx-err' }, note.text) : null,
        ),
      )
    }

    function Console(props) {
      const t = props.t
      const source = props.source
      const [tabs, setTabs] = React.useState([])
      const [activeId, setActiveId] = React.useState('')
      const [historyOpen, setHistoryOpen] = React.useState(false)
      const [running, setRunning] = React.useState(false)
      const [error, setError] = React.useState('')
      const [statements, setStatements] = React.useState([])
      const [activeSet, setActiveSet] = React.useState(0)
      const [selected, setSelected] = React.useState('')
      const result = statements[activeSet] || null
      const [copied, setCopied] = React.useState('')
      const [renaming, setRenaming] = React.useState('')
      const [renameValue, setRenameValue] = React.useState('')
      const splitRef = React.useRef(null)
      const [editorH, setEditorH] = React.useState(() => {
        try {
          const saved = Number(window.localStorage.getItem('dbx-editor-height'))
          return Number.isFinite(saved) && saved > 0 ? saved : 240
        } catch (error) {
          return 240
        }
      })
      const saveTimer = React.useRef(0)
      const latest = React.useRef([])
      latest.current = tabs
      const openTabs = tabs.filter((tab) => !tab.closed)
      const historyTabs = tabs.filter((tab) => tab.closed).slice().sort((a, b) => b.updatedAt - a.updatedAt)
      const activeTab = tabs.find((tab) => tab.id === activeId) || openTabs[0] || null
      const sql = activeTab ? activeTab.sql : ''

      const newId = () => 'q' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
      const titleOf = (text) => {
        const line = String(text || '')
          .split('\n')
          .map((row) => row.trim())
          .find((row) => row.length > 0)
        const cleaned = (line || '').replace(/^--\s*/, '').replace(/\s+/g, ' ')
        if (!cleaned) return ''
        return cleaned.length > 28 ? cleaned.slice(0, 28) + '…' : cleaned
      }
      const tabLabel = (tab) =>
        tab.named && tab.title ? tab.title : titleOf(tab.sql) || t('untitledQuery')
      const startRename = (id) => {
        const current = latest.current.find((tab) => tab.id === id)
        if (!current) return
        setRenaming(id)
        setRenameValue(tabLabel(current))
      }
      const commitRename = () => {
        const id = renaming
        setRenaming('')
        if (!id) return
        const current = latest.current.find((tab) => tab.id === id)
        if (!current) return
        const next = renameValue.trim().slice(0, 60)
        const merged = Object.assign({}, current, {
          title: next,
          named: next.length > 0,
          updatedAt: Date.now(),
        })
        setTabs((list) => list.map((tab) => (tab.id === id ? merged : tab)))
        persist(merged)
      }
      const persist = (tab) => {
        void call('queries/save', {
          source: source.id,
          tab: {
            id: tab.id,
            title: tab.named && tab.title ? tab.title : titleOf(tab.sql),
            named: tab.named === true,
            sql: tab.sql,
            updatedAt: tab.updatedAt || Date.now(),
            closed: tab.closed === true,
          },
        }).catch(() => {
          /* 保存失败不打断输入 */
        })
      }
      const flush = () => {
        if (saveTimer.current) {
          window.clearTimeout(saveTimer.current)
          saveTimer.current = 0
        }
        const current = latest.current.find((tab) => tab.id === activeId)
        if (current) persist(current)
      }
      const setSql = (value) => {
        const current = latest.current.find((tab) => tab.id === activeId)
        if (!current) return
        const next = Object.assign({}, current, { sql: value, updatedAt: Date.now() })
        setTabs((list) => list.map((tab) => (tab.id === current.id ? next : tab)))
        if (saveTimer.current) window.clearTimeout(saveTimer.current)
        saveTimer.current = window.setTimeout(() => persist(next), 700)
      }
      const newTab = () => {
        const tab = { id: newId(), title: '', sql: '', updatedAt: Date.now(), closed: false }
        setTabs((list) => list.concat([tab]))
        setActiveId(tab.id)
        setHistoryOpen(false)
        persist(tab)
      }
      const closeTab = (id) => {
        const current = latest.current.find((tab) => tab.id === id)
        const blank = !current || !String(current.sql || '').trim()
        if (blank) {
          // 空白页签直接丢弃，不占历史
          setTabs((list) => list.filter((tab) => tab.id !== id))
          void call('queries/delete', { source: source.id, id: id }).catch(() => {})
        } else {
          persist(Object.assign({}, current, { closed: true, updatedAt: Date.now() }))
          setTabs((list) => list.map((tab) => (tab.id === id ? Object.assign({}, tab, { closed: true }) : tab)))
        }
        if (activeId === id) {
          const rest = latest.current.filter((tab) => !tab.closed && tab.id !== id)
          if (rest.length > 0) setActiveId(rest[rest.length - 1].id)
          else newTab()
        }
      }
      const restoreTab = (id) => {
        const current = latest.current.find((tab) => tab.id === id)
        if (!current) return
        const next = Object.assign({}, current, { closed: false, updatedAt: Date.now() })
        setTabs((list) => list.map((tab) => (tab.id === id ? next : tab)))
        setActiveId(id)
        setHistoryOpen(false)
        persist(next)
      }
      const removeTab = (id) => {
        setTabs((list) => list.filter((tab) => tab.id !== id))
        void call('queries/delete', { source: source.id, id: id }).catch(() => {})
        if (activeId === id) {
          const rest = latest.current.filter((tab) => !tab.closed && tab.id !== id)
          if (rest.length > 0) setActiveId(rest[rest.length - 1].id)
        }
      }

      React.useEffect(() => {
        let alive = true
        setTabs([])
        setActiveId('')
        setStatements([])
        setActiveSet(0)
        setError('')
        setHistoryOpen(false)
        call('queries/list', { source: source.id })
          .then((value) => {
            if (!alive) return
            const list = (value && value.tabs) || []
            const open = list.filter((tab) => !tab.closed)
            if (open.length > 0) {
              setTabs(list)
              setActiveId(open[open.length - 1].id)
            } else {
              const first = { id: newId(), title: '', sql: 'SELECT 1', updatedAt: Date.now(), closed: false }
              setTabs(list.concat([first]))
              setActiveId(first.id)
              persist(first)
            }
          })
          .catch(() => {
            if (!alive) return
            const first = { id: newId(), title: '', sql: 'SELECT 1', updatedAt: Date.now(), closed: false }
            setTabs([first])
            setActiveId(first.id)
          })
        return () => {
          alive = false
        }
      }, [source.id])

      React.useEffect(() => {
        setSelected('')
      }, [activeId])

      React.useEffect(() => {
        try {
          window.localStorage.setItem('dbx-editor-height', String(editorH))
        } catch (error) {
          /* 忽略：隐私模式下 localStorage 可能不可用 */
        }
      }, [editorH])
      const onSplitDown = (event) => {
        event.preventDefault()
        const box = splitRef.current
        if (!box) return
        const total = box.clientHeight
        const startY = event.clientY
        const startH = editorH
        const move = (moveEvent) => {
          const next = Math.round(Math.max(90, Math.min(total - 170, startH + moveEvent.clientY - startY)))
          setEditorH(next)
        }
        const up = () => {
          window.removeEventListener('mousemove', move)
          window.removeEventListener('mouseup', up)
          document.body.style.cursor = ''
          document.body.style.userSelect = ''
        }
        document.body.style.cursor = 'row-resize'
        document.body.style.userSelect = 'none'
        window.addEventListener('mousemove', move)
        window.addEventListener('mouseup', up)
      }
      const copyResult = async () => {
        const ok = await copyText(resultToTsv(result))
        setCopied(ok ? t('copied') : t('copyFailed'))
        window.setTimeout(() => setCopied(''), 1600)
      }
      const runOne = async (index, page, pageSize) => {
        const item = statements[index]
        if (!item) return
        setRunning(true)
        setError('')
        try {
          const value = await call('query/run', {
            source: source.id,
            sql: item.sql,
            page: page,
            pageSize: pageSize,
          })
          const next = (value && value.statements && value.statements[0]) || null
          if (next) setStatements((list) => list.map((row, i) => (i === index ? next : row)))
          if (value && value.error) {
            setError(t('statementFailed').replace('{n}', String(value.error.index + 1)) + '：' + value.error.message)
          }
        } catch (cause) {
          setError(messageOf(cause))
        } finally {
          setRunning(false)
        }
      }
      const goPage = (delta) => {
        if (!result || !result.paged) return
        const next = Math.max(1, (result.page || 1) + delta)
        void runOne(activeSet, next, result.pageSize || 100)
      }
      const changePageSize = (size) => {
        if (!result || !result.paged) return
        void runOne(activeSet, 1, size)
      }
      const run = async (override) => {
        flush()
        const target = typeof override === 'string' && override.trim() ? override : selected.trim() || sql
        setRunning(true)
        setError('')
        try {
          const value = await call('query/run', { source: source.id, sql: target })
          const list = (value && value.statements) || []
          setStatements(list)
          setActiveSet(0)
          if (value && value.error) {
            setError(t('statementFailed').replace('{n}', String(value.error.index + 1)) + '：' + value.error.message)
          }
        } catch (cause) {
          setStatements([])
          setError(messageOf(cause))
        } finally {
          setRunning(false)
        }
      }
      return h(
        'div',
        { className: 'dbx-console' },
        h(
          'div',
          { className: 'dbx-main-head' },
          h('h3', { className: 'dbx-title' }, source.id),
          h('span', { className: 'dbx-tag dbx-tag-stage dbx-stage-' + source.stage }, source.stageLabel),
          h('span', { className: 'dbx-tag' }, source.engineLabel),
          h('span', { className: 'dbx-tag' }, source.host + ':' + String(source.port)),
          source.database ? h('span', { className: 'dbx-tag' }, source.database) : null,
          source.writable ? h('span', { className: 'dbx-tag dbx-tag-write' }, t('writable')) : null,
          h('span', { style: { flex: '1' } }),
          h(
            Button,
            { size: 'sm', variant: 'ghost', disabled: running, onClick: () => props.onEdit(source) },
            t('editTitle'),
          ),
          h(
            Button,
            {
              size: 'sm',
              variant: 'primary',
              disabled: running,
              title: selected.trim() ? t('runSelectedHint') : t('runHint'),
              onClick: () => void run(selected),
            },
            running ? t('running') : selected.trim() ? t('runSelected') : t('run'),
          ),
        ),
        h(
          'div',
          { className: 'dbx-console-body' },
          h(
            'div',
            { className: 'dbx-tabs' },
            h(
              'div',
              { className: 'dbx-tabs-track' },
              openTabs.map((tab) =>
                h(
                  'div',
                  {
                    key: tab.id,
                    className: tab.id === activeId ? 'dbx-tab dbx-tab-active' : 'dbx-tab',
                    title: t('renameHint'),
                    onDoubleClick: () => startRename(tab.id),
                    onMouseDown: () => {
                      if (tab.id === activeId) return
                      flush()
                      setActiveId(tab.id)
                    },
                  },
                  renaming === tab.id
                    ? h('input', {
                        className: 'dbx-tab-input',
                        value: renameValue,
                        autoFocus: true,
                        onMouseDown: (event) => event.stopPropagation(),
                        onChange: (event) => setRenameValue(event.target.value),
                        onKeyDown: (event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault()
                            commitRename()
                          } else if (event.key === 'Escape') {
                            event.preventDefault()
                            setRenaming('')
                          }
                        },
                        onBlur: () => commitRename(),
                      })
                    : h('span', { className: 'dbx-tab-label' }, tabLabel(tab)),
                  h(
                    'span',
                    {
                      className: 'dbx-tab-close',
                      title: t('closeTab'),
                      onMouseDown: (event) => {
                        event.stopPropagation()
                        event.preventDefault()
                        closeTab(tab.id)
                      },
                    },
                    '×',
                  ),
                ),
              ),
              h('button', { className: 'dbx-tab-add', title: t('newTab'), onClick: newTab }, '+'),
            ),
            h(
              'div',
              { className: 'dbx-tabs-right' },
              h(
                'button',
                {
                  className: historyOpen ? 'dbx-tab-hist dbx-tab-hist-on' : 'dbx-tab-hist',
                  title: t('historyHint'),
                  onClick: () => setHistoryOpen(!historyOpen),
                },
                t('historyLabel'),
              ),
              historyOpen
                ? h(
                    'div',
                    { className: 'dbx-history' },
                    historyTabs.length === 0
                      ? h('div', { className: 'dbx-history-empty' }, t('historyEmpty'))
                      : historyTabs.map((tab) =>
                          h(
                            'div',
                            { key: tab.id, className: 'dbx-history-item' },
                            h(
                              'div',
                              { className: 'dbx-history-main', onClick: () => restoreTab(tab.id) },
                              h('span', { className: 'dbx-history-title' }, tabLabel(tab)),
                              h(
                                'span',
                                { className: 'dbx-history-sql' },
                                String(tab.sql || '').replace(/\s+/g, ' ').slice(0, 60),
                              ),
                            ),
                            h(
                              'button',
                              {
                                className: 'dbx-history-del',
                                title: t('deleteTab'),
                                onClick: (event) => {
                                  event.stopPropagation()
                                  removeTab(tab.id)
                                },
                              },
                              '×',
                            ),
                          ),
                        ),
                  )
                : null,
            ),
          ),
          h(
            'div',
            { className: 'dbx-split', ref: splitRef },
            h(
              'div',
              { className: 'dbx-pane-edit', style: { height: editorH + 'px' } },
              h(SqlEditor, {
                t: t,
                value: sql,
                onChange: setSql,
                onRun: (text) => void run(text),
                onSelectionChange: setSelected,
                sourceId: source.id,
                disabled: running,
              }),
            ),
            h('div', { className: 'dbx-splitter', title: t('splitHint'), onMouseDown: onSplitDown }),
            h(
              'div',
              { className: 'dbx-pane-result' },
              error ? h('div', { className: 'dbx-err' }, error) : null,
              statements.length > 1
                ? h(
                    'div',
                    { className: 'dbx-rs-tabs' },
                    statements.map((item, index) =>
                      h(
                        'button',
                        {
                          key: index,
                          className: index === activeSet ? 'dbx-rs-tab dbx-rs-tab-active' : 'dbx-rs-tab',
                          title: item.sql,
                          onClick: () => setActiveSet(index),
                        },
                        (item.wrote ? t('execTag') : t('resultTag')) + ' ' + String(index + 1),
                      ),
                    ),
                  )
                : null,
              h(ResultTable, { result: result, t: t }),
              result
                ? h(
                    'div',
                    { className: 'dbx-status' },
                    result.columns && result.columns.length
                      ? h(
                          Button,
                          {
                            size: 'sm',
                            variant: 'ghost',
                            title: t('copyResult'),
                            'aria-label': t('copyResult'),
                            onClick: () => void copyResult(),
                          },
                          CopyIcon(),
                        )
                      : null,
                    copied ? h('span', { className: 'dbx-tag dbx-tag-write' }, copied) : null,
                    h('span', { style: { flex: '1' } }),
                    h(
                      'span',
                      { className: 'dbx-status-right' },
                      result.paged
                        ? h(
                            'button',
                            {
                              className: 'dbx-pg-btn',
                              disabled: running || (result.page || 1) <= 1,
                              onClick: () => goPage(-1),
                            },
                            t('prevPage'),
                          )
                        : null,
                      result.paged
                        ? h(
                            'button',
                            { className: 'dbx-pg-btn', disabled: running || !result.hasNext, onClick: () => goPage(1) },
                            t('nextPage'),
                          )
                        : null,
                      h(
                        'span',
                        { className: 'dbx-status-text' },
                      (result.wrote
                        ? t('wrote') + ' · ' + t('affected') + ': ' + String(result.rowsAffected || 0)
                        : (result.paged ? t('pageOf').replace('{n}', String(result.page || 1)) + ' · ' : '') +
                          String(result.rowCount) + ' ' + t('rows')) +
                        ' · ' +
                        t('elapsed') +
                        ' ' +
                        String(result.elapsedMs) +
                        ' ms' +
                        (result.truncated
                          ? ' · ' + t('truncated') + (result.paged ? '' : ' · ' + t('noPaging'))
                          : ''),
                      ),
                      result.paged
                        ? h(
                            'select',
                            {
                              className: 'dbx-pg-size',
                              value: String(result.pageSize || 100),
                              disabled: running,
                              onChange: (event) => changePageSize(Number(event.target.value)),
                            },
                            [50, 100, 200, 500].map((size) =>
                              h('option', { key: size, value: String(size) }, String(size) + ' ' + t('rowsPerPage')),
                            ),
                          )
                        : null,
                    ),
                  )
                : null,
            ),
          ),
        ),
      )
    }

    function ConsoleSettings(props) {
      const t = props.t
      const config = props.config
      const [draft, setDraft] = React.useState(config ? Object.assign({}, config) : { writeMode: 'source', limit: 100 })
      const [busy, setBusy] = React.useState('')
      const [note, setNote] = React.useState('')
      React.useEffect(() => {
        if (config) setDraft(Object.assign({}, config))
      }, [config])
      const save = async () => {
        setBusy('save')
        setNote('')
        try {
          const next = await call('console/save', {
            config: { writeMode: draft.writeMode, limit: Number(draft.limit) || 100 },
          })
          setDraft(Object.assign({}, next))
          setNote(t('consoleSaved'))
        } catch (cause) {
          setNote(messageOf(cause))
        } finally {
          setBusy('')
        }
      }
      return h(
        'div',
        { className: 'dbx-grid', style: { marginTop: '10px' } },
        h(
          Field,
          { label: t('writeMode') },
          h(
            'select',
            {
              className: 'dbx-select',
              value: draft.writeMode,
              disabled: busy !== '',
              onChange: (event) => setDraft(Object.assign({}, draft, { writeMode: event.target.value })),
            },
            h('option', { value: 'source' }, t('writeModeSource')),
            h('option', { value: 'readonly' }, t('writeModeReadonly')),
            h('option', { value: 'always' }, t('writeModeAlways')),
          ),
        ),
        h(
          Field,
          { label: t('limit') },
          h(Input, {
            value: String(draft.limit || 100),
            disabled: busy !== '',
            onChange: (event) =>
              setDraft(Object.assign({}, draft, { limit: event.target.value.replace(/[^0-9]/g, '') })),
          }),
        ),
        h(
          'div',
          { className: 'dbx-actions dbx-wide' },
          h(
            Button,
            { size: 'sm', variant: 'primary', disabled: busy !== '', onClick: () => void save() },
            busy === 'save' ? t('consoleSaving') : t('save'),
          ),
          note ? h('span', { className: 'dbx-ok' }, note) : null,
        ),
      )
    }

    function Panel(props) {
      const t = props.t
      const [phase, setPhase] = React.useState('loading')
      const [error, setError] = React.useState('')
      const [data, setData] = React.useState({
        file: '',
        configDriven: false,
        sources: [],
        engines: [],
        consoleConfig: null,
      })
      const [selectedId, setSelectedId] = React.useState('')
      const [editing, setEditing] = React.useState(false)
      const [draft, setDraft] = React.useState(null)
      const [busy, setBusy] = React.useState('')
      const [note, setNote] = React.useState(null)
      const [search, setSearch] = React.useState('')
      const [showDsn, setShowDsn] = React.useState(false)
      const [groupByStage, setGroupByStage] = React.useState(() => {
        try {
          return window.localStorage.getItem(GROUP_KEY) === '1'
        } catch (cause) {
          return false
        }
      })
      const toggleGroup = (next) => {
        setGroupByStage(next)
        try {
          window.localStorage.setItem(GROUP_KEY, next ? '1' : '0')
        } catch (cause) {
          /* 隐私模式禁用 localStorage 时忽略 */
        }
      }
      const [sideWidth, setSideWidth] = React.useState(() => {
        try {
          const saved = Number(window.localStorage.getItem(SIDE_WIDTH_KEY))
          return saved >= SIDE_MIN && saved <= SIDE_MAX ? saved : 264
        } catch (cause) {
          return 264
        }
      })
      const widthRef = React.useRef(sideWidth)
      const dragRef = React.useRef(null)
      widthRef.current = sideWidth
      React.useEffect(() => {
        const onMove = (event) => {
          const drag = dragRef.current
          if (!drag) return
          const next = Math.max(SIDE_MIN, Math.min(SIDE_MAX, drag.startWidth + (event.clientX - drag.startX)))
          drag.nextWidth = next
          setSideWidth(next)
        }
        const onUp = () => {
          const drag = dragRef.current
          if (!drag) return
          dragRef.current = null
          document.body.style.userSelect = ''
          document.body.style.cursor = ''
          try {
            // 用拖动过程中记下的最终值：mouseup 时最后一次 setState 可能还没渲染
            window.localStorage.setItem(SIDE_WIDTH_KEY, String(drag.nextWidth ?? drag.startWidth))
          } catch (cause) {
            /* 忽略 */
          }
        }
        window.addEventListener('mousemove', onMove)
        window.addEventListener('mouseup', onUp)
        return () => {
          window.removeEventListener('mousemove', onMove)
          window.removeEventListener('mouseup', onUp)
          document.body.style.userSelect = ''
          document.body.style.cursor = ''
        }
      }, [])
      const startResize = (event) => {
        event.preventDefault()
        dragRef.current = { startX: event.clientX, startWidth: widthRef.current }
        document.body.style.userSelect = 'none'
        document.body.style.cursor = 'col-resize'
      }

      const load = React.useCallback(async () => {
        setPhase('loading')
        setError('')
        try {
          const value = await call('sources/list', {})
          setData(value)
          setPhase('ready')
        } catch (cause) {
          setError(messageOf(cause))
          setPhase('error')
        }
      }, [])

      React.useEffect(() => {
        void load()
      }, [load])

      const sources = data.sources || []
      const selected = sources.find((item) => item.id === selectedId) || null
      const visible = search
        ? sources.filter((item) =>
            [item.id, item.host, item.database, item.description]
              .join(' ')
              .toLowerCase()
              .includes(search.toLowerCase()),
          )
        : sources
      const stages = data.stages || []
      const byId = (left, right) => left.id.localeCompare(right.id, 'zh-Hans-CN')
      const ordered = visible.slice().sort(byId)
      const groups = groupByStage
        ? stages
            .slice()
            .sort((left, right) => left.order - right.order)
            .map((stage) =>
              Object.assign({}, stage, { items: ordered.filter((item) => item.stage === stage.kind) }),
            )
            .filter((group) => group.items.length > 0)
        : [{ kind: '', label: '', items: ordered }]

      const startNew = () => {
        setEditing(true)
        setSelectedId('')
        setDraft(draftOf(null, data.engines))
        setShowDsn(false)
        setNote(null)
      }
      const startEdit = (item) => {
        setSelectedId(item.id)
        setEditing(true)
        setDraft(draftOf(item, data.engines))
        setShowDsn(false)
        setNote(null)
        if (!item.hasPassword) return
        // 把已保存的密码读回表单，否则眼睛对空输入框点了也没有可见变化
        call('sources/secret', { id: item.id })
          .then((value) => {
            const filled = value.secret || (value.env ? '${' + value.env + '}' : '')
            if (!filled) return
            setDraft((prev) =>
              prev && prev.originalId === item.id ? Object.assign({}, prev, { password: filled }) : prev,
            )
          })
          .catch(() => {
            /* 读不到就保持空，留空即不改密码 */
          })
      }
      const pickSource = (item) => {
        setSelectedId(item.id)
        setEditing(false)
        setDraft(null)
        setNote(null)
      }

      const save = async () => {
        setBusy('save')
        setNote(null)
        try {
          const payload = {
            originalId: draft.originalId,
            source: {
              id: draft.id,
              engine: draft.engine,
              stage: draft.stage,
              description: draft.description,
              host: showDsn ? '' : draft.host,
              port: showDsn ? '' : draft.port,
              database: showDsn ? '' : draft.database,
              user: showDsn ? '' : draft.user,
              password: showDsn ? '' : draft.password,
              ssl: draft.ssl,
              writable: draft.writable,
              allowDdl: draft.allowDdl,
              dsn: showDsn ? draft.dsn : '',
            },
          }
          const value = await call('sources/save', payload)
          setData(Object.assign({}, data, { sources: value.sources }))
          setSelectedId(draft.id)
          setEditing(false)
          setDraft(null)
          setNote({ kind: 'ok', text: t('saved') })
          setPhase('ready')
        } catch (cause) {
          setNote({ kind: 'err', text: messageOf(cause) })
        } finally {
          setBusy('')
        }
      }

      const test = async () => {
        setBusy('test')
        setNote(null)
        try {
          const value = await call('sources/test', {
            originalId: draft.originalId,
            source: {
              id: draft.id,
              engine: draft.engine,
              stage: draft.stage,
              host: showDsn ? '' : draft.host,
              port: showDsn ? '' : draft.port,
              database: showDsn ? '' : draft.database,
              user: showDsn ? '' : draft.user,
              password: showDsn ? '' : draft.password,
              ssl: draft.ssl,
              dsn: showDsn ? draft.dsn : '',
            },
          })
          setNote({ kind: 'ok', text: t('testOK') + ' · ' + value.version })
        } catch (cause) {
          setNote({ kind: 'err', text: messageOf(cause) })
        } finally {
          setBusy('')
        }
      }

      const remove = async (id) => {
        if (!window.confirm(t('confirmRemove'))) return
        setBusy('remove')
        setNote(null)
        try {
          const value = await call('sources/remove', { id: id })
          setData(Object.assign({}, data, { sources: value.sources }))
          if (selectedId === id) setSelectedId('')
          setEditing(false)
          setDraft(null)
          setNote({ kind: 'ok', text: t('removed') })
        } catch (cause) {
          setNote({ kind: 'err', text: messageOf(cause) })
        } finally {
          setBusy('')
        }
      }

      if (phase === 'loading') {
        return h(
          'div',
          { className: 'dbx-root', style: { padding: '16px' } },
          h('span', { className: 'dbx-muted' }, 'Loading…'),
        )
      }
      if (phase === 'error') {
        return h(
          'div',
          { className: 'dbx-root', style: { padding: '16px', flexDirection: 'column', gap: '10px' } },
          h('div', { className: 'dbx-err' }, error),
          h(Button, { size: 'sm', onClick: () => void load() }, t('reload')),
        )
      }

      return h(
        'div',
        { className: 'dbx-page' },
        h(
          'div',
          { className: 'dbx-page-head' },
          h('h2', { className: 'dbx-page-title' }, t('title')),
          h('span', { className: 'dbx-muted' }, t('engineHintShort')),
        ),
        h(
          'div',
          { className: 'dbx-cols' },
        h(
          'aside',
          { className: 'dbx-side', style: { width: sideWidth + 'px', flex: 'none' } },
          h(
            'div',
            { className: 'dbx-side-head' },
            h(Input, {
              value: search,
              className: 'dbx-search',
              placeholder: t('search'),
              onChange: (event) => setSearch(event.target.value),
            }),
            h(Button, { size: 'sm', variant: 'primary', onClick: startNew }, '+ ' + t('add')),
          ),
          h(
            'div',
            { className: 'dbx-group-toggle' },
            h(
              'label',
              { className: 'dbx-radio' },
              h('input', {
                type: 'radio',
                name: 'dbx-group',
                checked: !groupByStage,
                onChange: () => toggleGroup(false),
              }),
              h('span', null, t('ungrouped')),
            ),
            h(
              'label',
              { className: 'dbx-radio' },
              h('input', {
                type: 'radio',
                name: 'dbx-group',
                checked: groupByStage,
                onChange: () => toggleGroup(true),
              }),
              h('span', null, t('groupByStage')),
            ),
          ),
          data.configDriven ? h('div', { className: 'dbx-warn' }, t('configDriven')) : null,
          visible.length === 0
            ? h('div', { className: 'dbx-muted' }, t('empty'))
            : h(
                'div',
                { className: 'dbx-list' },
                groups.map((group) =>
                  h(
                    'div',
                    { key: group.kind || 'all', className: 'dbx-group' },
                    group.kind
                      ? h(
                          'div',
                          { className: 'dbx-group-head' },
                          h('span', null, group.label),
                          h('span', { className: 'dbx-group-count' }, String(group.items.length)),
                        )
                      : null,
                    group.items.map((item) =>
                      h(
                        'button',
                        {
                          key: item.id,
                          type: 'button',
                          className: item.id === selectedId && !editing ? 'dbx-item dbx-item-active' : 'dbx-item',
                          onClick: () => pickSource(item),
                        },
                        h(
                          'span',
                          { className: 'dbx-item-top' },
                          h('span', { className: 'dbx-item-id' }, item.id),
                          h(
                            'span',
                            { className: 'dbx-item-tags' },
                            item.writable ? h('span', { className: 'dbx-tag dbx-tag-write' }, 'W') : null,
                            h('span', { className: 'dbx-tag' }, item.engineLabel),
                            h('span', { className: 'dbx-tag dbx-tag-stage dbx-stage-' + item.stage }, item.stageLabel),
                          ),
                        ),
                        h(
                          'span',
                          { className: 'dbx-item-sub' },
                          item.host + ':' + String(item.port) + (item.database ? ' / ' + item.database : ''),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
          h('div', { className: 'dbx-foot' }, t('file') + ': ' + (data.fileDisplay || data.file)),
        ),
        h('div', {
          className: 'dbx-resizer',
          role: 'separator',
          'aria-orientation': 'vertical',
          'aria-label': t('resize'),
          title: t('resize'),
          onMouseDown: startResize,
        }),
        h(
          'section',
          { className: 'dbx-main' },
          editing
            ? h(ConnectionForm, {
                t: t,
                draft: draft,
                setDraft: setDraft,
                busy: busy,
                engines: data.engines,
                stages: data.stages,
                note: note,
                showDsn: showDsn,
                setShowDsn: setShowDsn,
                onSave: save,
                onTest: test,
                onRemove: remove,
                onCancel: () => {
                  setEditing(false)
                  setDraft(null)
                  setNote(null)
                },
              })
            : selected
              ? h(
                  'div',
                  { style: { display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 } },
                  h(Console, { t: t, source: selected, onEdit: startEdit }),
                )
              : h(
                  'div',
                  { className: 'dbx-main-body' },
                  h('div', { className: 'dbx-intro' }, t('pick')),
                  h('div', { className: 'dbx-muted' }, t('engineHint')),
                  h(
                    'div',
                    { className: 'dbx-actions' },
                    h(Button, { size: 'sm', variant: 'ghost', onClick: () => void load() }, t('reload')),
                  ),
                ),
        ),
        ),
      )
    }

    function View(props) {
      const t = props.t
      return h('div', { style: { height: '100%', minHeight: 0 } }, h(Panel, { t: t }))
    }

    /** 侧边栏「数据库」入口图标（侧边栏负责按钮、文字与选中态）。 */
    function PanelIcon(props) {
      const size = Number(props && props.size) || 16
      return h(
        'svg',
        { width: size, height: size, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': 'true' },
        h('ellipse', { cx: 8, cy: 3.6, rx: 5.2, ry: 2.2, stroke: 'currentColor', strokeWidth: 1.2 }),
        h('path', { d: 'M2.8 3.6v4.2c0 1.2 2.3 2.2 5.2 2.2s5.2-1 5.2-2.2V3.6', stroke: 'currentColor', strokeWidth: 1.2 }),
        h('path', { d: 'M2.8 7.8v4.2c0 1.2 2.3 2.2 5.2 2.2s5.2-1 5.2-2.2V7.8', stroke: 'currentColor', strokeWidth: 1.2 }),
      )
    }

    function SettingsSection(props) {
      const t = props.t
      const [data, setData] = React.useState(null)
      const [error, setError] = React.useState('')
      React.useEffect(() => {
        let alive = true
        call('sources/list', {})
          .then((value) => {
            if (alive) setData(value)
          })
          .catch((cause) => {
            if (alive) setError(messageOf(cause))
          })
        return () => {
          alive = false
        }
      }, [])
      return h(
        'div',
        { className: 'dbx-root', style: { flexDirection: 'column', padding: '16px', gap: '10px', height: 'auto' } },
        h('h2', { className: 'dbx-title', style: { fontSize: '15px' } }, t('title')),
        h('p', { className: 'dbx-muted' }, t('settingsIntro')),
        error ? h('div', { className: 'dbx-err' }, error) : null,
        data
          ? h(
              'div',
              null,
              h('h3', { className: 'dbx-title', style: { marginTop: '8px' } }, t('consoleTitle')),
              h(ConsoleSettings, { t: t, config: data.consoleConfig }),
              h('div', { className: 'dbx-foot', style: { marginTop: '12px' } }, t('file') + ': ' + (data.fileDisplay || data.file)),
            )
          : null,
      )
    }

    const inject = ['slots', 'locale']
    const name = 'dsh-tool-database-client'

    function apply(ctx) {
      ensureStyles()
      ctx.effect(
        () => ctx.locale.register(NS, { zh: zh, en: en }),
        'dsh-tool-database: dictionaries',
      )
      const t = ctx.locale.bind(NS)

      ctx.effect(
        () =>
          ctx.slots.inject('main', () =>
            ctx.slots.register(
              { name: 'main', key: VIEW_ID, locale: NS },
              View,
            ),
          ),
        'dsh-tool-database: main panel',
      )

      ctx.effect(
        () =>
          ctx.slots.inject('sidebar.panellist', () =>
            ctx.slots.register(
              {
                name: 'sidebar.panellist',
                id: VIEW_ID,
                order: 20,
                label: () => t('view'),
                locale: NS,
              },
              PanelIcon,
            ),
          ),
        'dsh-tool-database: sidebar entry',
      )

      ctx.effect(
        () =>
          ctx.slots.inject('settings.section', () =>
            ctx.slots.register(
              {
                name: 'settings.section',
                id: SECTION_ID,
                order: 45,
                label: () => t('nav'),
                locale: NS,
              },
              SettingsSection,
            ),
          ),
        'dsh-tool-database: settings section',
      )
    }

    exports.apply = apply
    exports.inject = inject
    exports.name = name
    return module.exports
  },
})

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
      sqlHint: 'Ctrl / Cmd + Enter 执行。只读连接只能 SELECT；写语句受「控制台写策略」和数据源开关双重限制。',
      run: '执行',
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
      sqlHint: 'Ctrl / Cmd + Enter to run. Read-only connections can only SELECT; writes are gated by the console policy and the source switches.',
      run: 'Run',
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
        '.dbx-root{display:flex;height:100%;min-height:0;box-sizing:border-box;padding:14px 16px;gap:14px;font-size:13px;color:var(--dsw-alias-label-primary,inherit)}',
        '.dbx-page{display:flex;flex-direction:column;height:100%;min-height:0;box-sizing:border-box;padding:14px 16px;gap:12px;font-size:13px;color:var(--dsw-alias-label-primary,inherit)}',
        '.dbx-page-head{display:flex;align-items:baseline;gap:10px;flex:none}',
        '.dbx-page-title{font-size:15px;font-weight:600;margin:0}',
        '.dbx-cols{display:flex;flex:1;min-height:0;gap:0;border-top:1px solid var(--dsw-alias-border-l2,color-mix(in srgb,currentColor 14%,transparent));padding-top:12px}',
        '.dbx-side{display:flex;flex-direction:column;gap:8px;padding:0 8px 0 0;min-height:0;min-width:0}',
        '.dbx-resizer{width:6px;flex:none;align-self:stretch;margin:0 4px;border-radius:3px;cursor:col-resize;background:transparent;transition:background .12s}',
        '.dbx-resizer:hover{background:var(--dsw-alias-border-l2,color-mix(in srgb,currentColor 16%,transparent))}',
        '.dbx-pw{position:relative;display:block;width:100%;box-sizing:border-box}',
        '.dbx-pw input{padding-right:30px}',
        '.dbx-pw-btn{position:absolute;right:12px;top:50%;transform:translateY(-50%);width:24px;height:24px;display:inline-flex;align-items:center;justify-content:center;border:0;background:transparent;color:inherit;opacity:.6;cursor:pointer;padding:0;border-radius:4px}',
        '.dbx-pw-btn:hover{opacity:1}',
        '.dbx-main{flex:1;min-width:0;display:flex;flex-direction:column;min-height:0}',
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
        '.dbx-main-body{padding:14px;overflow:auto;flex:1;min-height:0}',
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
        '.dbx-sql{width:100%;min-height:150px;resize:vertical;border-radius:8px;border:1px solid var(--dsw-alias-border-l2,color-mix(in srgb,currentColor 18%,transparent));background:var(--dsw-alias-bg-layer-1,transparent);color:inherit;padding:10px;font-family:var(--dsw-font-markdown-code-block,ui-monospace,SFMono-Regular,Menlo,monospace);font-size:12px;line-height:1.55;box-sizing:border-box}',
        '.dbx-status{font-size:12px;color:var(--dsw-alias-label-tertiary,color-mix(in srgb,currentColor 55%,transparent))}',
        '.dbx-table-wrap{overflow:auto;border:1px solid var(--dsw-alias-border-l2,color-mix(in srgb,currentColor 14%,transparent));border-radius:8px;margin-top:10px;max-height:52vh}',
        '.dbx-table{border-collapse:collapse;width:100%;font-size:12px}',
        '.dbx-table th,.dbx-table td{border-bottom:1px solid var(--dsw-alias-border-l1,color-mix(in srgb,currentColor 10%,transparent));padding:4px 8px;text-align:left;vertical-align:top;white-space:pre;max-width:420px;overflow:hidden;text-overflow:ellipsis}',
        '.dbx-table th{position:sticky;top:0;background:var(--dsw-alias-bg-layer-2,#fafafa);font-weight:600;z-index:1}',
        '.dbx-null{color:var(--dsw-alias-label-tertiary,color-mix(in srgb,currentColor 45%,transparent));font-style:italic}',
        '.dbx-details{margin-top:12px;font-size:12px}',
        '.dbx-details summary{cursor:pointer;color:var(--dsw-alias-label-secondary,color-mix(in srgb,currentColor 75%,transparent))}',
        '.dbx-console{display:flex;flex-direction:column;height:100%;min-height:0}',
        '.dbx-console-body{padding:12px 14px;display:flex;flex-direction:column;gap:8px;flex:1;min-height:0;overflow:auto}',
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

    function ResultTable(props) {
      const result = props.result
      if (!result) return null
      if (!result.columns || result.columns.length === 0) {
        return h(
          'div',
          { className: 'dbx-muted' },
          props.t('wrote') + ' · ' + props.t('affected') + ': ' + String(result.rowsAffected == null ? 0 : result.rowsAffected),
        )
      }
      return h(
        'div',
        { className: 'dbx-table-wrap' },
        h(
          'table',
          { className: 'dbx-table' },
          h('thead', null, h('tr', null, result.columns.map((col) => h('th', { key: col }, col)))),
          h(
            'tbody',
            null,
            result.rows.map((row, rowIndex) =>
              h(
                'tr',
                { key: rowIndex },
                row.map((value, colIndex) => {
                  if (value === null || value === undefined) {
                    return h('td', { key: colIndex }, h('span', { className: 'dbx-null' }, 'NULL'))
                  }
                  const text = typeof value === 'string' ? value : JSON.stringify(value)
                  return h('td', { key: colIndex, title: text }, text)
                }),
              ),
            ),
          ),
        ),
      )
    }

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
              h(Input, {
                value: draft.password,
                type: showPassword ? 'text' : 'password',
                disabled: busy !== '' || showDsn,
                placeholder: draft.hasPassword ? '******' : '',
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
                h(Input, {
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
      const [sql, setSql] = React.useState('SELECT 1')
      const [running, setRunning] = React.useState(false)
      const [error, setError] = React.useState('')
      const [result, setResult] = React.useState(null)
      const run = async () => {
        setRunning(true)
        setError('')
        try {
          const value = await call('query/run', { source: source.id, sql: sql })
          setResult(value)
        } catch (cause) {
          setResult(null)
          setError(messageOf(cause))
        } finally {
          setRunning(false)
        }
      }
      const onKeyDown = (event) => {
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
          event.preventDefault()
          void run()
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
            { size: 'sm', variant: 'primary', disabled: running, onClick: () => void run() },
            running ? t('running') : t('run'),
          ),
        ),
        h(
          'div',
          { className: 'dbx-console-body' },
          h('textarea', {
            className: 'dbx-sql',
            value: sql,
            spellCheck: false,
            onKeyDown: onKeyDown,
            onChange: (event) => setSql(event.target.value),
            placeholder: 'SELECT TOP 10 * FROM ...',
          }),
          h('span', { className: 'dbx-muted' }, t('sqlHint')),
          error ? h('div', { className: 'dbx-err' }, error) : null,
          result
            ? h(
                'div',
                { className: 'dbx-status' },
                (result.wrote
                  ? t('wrote') + ' · ' + t('affected') + ': ' + String(result.rowsAffected || 0)
                  : String(result.rowCount) + ' ' + t('rows')) +
                  ' · ' +
                  t('elapsed') +
                  ' ' +
                  String(result.elapsedMs) +
                  ' ms' +
                  (result.truncated ? ' · ' + t('truncated') : ''),
              )
            : null,
          h(ResultTable, { result: result, t: t }),
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

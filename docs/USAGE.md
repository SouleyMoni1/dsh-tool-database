# dsh-tool-database 使用手册

> 面向日常使用：装好之后怎么配、怎么让模型查、怎么在界面里跑 SQL。
> 安装/升级细节见 [README](../README.md)。

## 1. 五分钟上手

1. 安装并重启 DSH（见 README「安装」）；
2. 点左侧栏的 **数据库**；
3. 点 **+ 新建连接**，选引擎（SQL Server / PostgreSQL / MySQL）和类型（开发 / 测试 / 正式），填主机、端口、库、账号、密码；
4. 点 **测试连接** → 看到版本号说明通了 → **保存**；
5. 模型侧用 `db_sources` 就能看到这个源，用 `source: "<别名>"` 调用其它工具。

连接保存在 `~/.dsh/database-tool/sources.json`；密码推荐写 `${ENV_NAME}` 让宿主从环境变量取。

编辑已有连接时，本机保存的密码会被读回密码框（默认掩码显示），点右侧的眼睛即可看到明文；
模型侧的工具输出始终不含密码，只有这个本地表单能看到。

## 2. 界面上能做什么

| 位置 | 能做的事 |
| --- | --- |
| 左侧栏 **数据库** 面板 | 连接列表（搜索 / 类型标签 / 引擎徽标 / 可写标记，可按类型分组、可拖动分隔条调宽窄）、SQL 控制台（高亮 / 格式化 / 关键字与字段补全 / Ctrl + Cmd + Enter 执行）、结果表格（行数 / 耗时 / 截断提示 / 一键复制 TSV）、新建与编辑连接、测试连接、删除 |
| 设置 → **数据库连接** | 控制台写策略（跟随数据源 / 一律只读 / 始终允许写）、默认行数 |

列表默认按别名（id）排序；搜索框下面的 **不分组 / 按类型分组** 单选项切换分组视图，
列表右侧从右往左依次是 类型 / 数据库 / 可写；列表与右侧内容之间有一条分隔条，按住左右拖可调列表宽度（记在浏览器本地）；分组时先按开发 → 测试 → 正式，组内再按别名排序，选择记在浏览器本地。

### SQL 控制台

- **高亮**：关键字 / 字符串 / 数字 / 注释四色，输入仍是原生 textarea（选中、复制、输入法正常）；
- **格式化**：工具条「格式化」把子句拆行、关键字大写、`AND / OR` 缩进，字符串与注释不动；
- **补全**：关键字 + 当前库表名 + 当前表字段（`FROM / JOIN` 后面那张表），字段标「字段」排最前，表名标「表」；
  输入 1~2 个字符自动弹，`Ctrl + 空格` 强制弹，`↑ ↓` 选择、`Enter / Tab` 确认、`Esc` 关闭，列表跟着光标走；`别名.` 后直接列字段；
- **复制**：结果区右上角图标复制整表为 TSV（带表头），可直接粘进 Excel；工具条「复制 SQL」复制语句；
- **快捷键**：`Ctrl / Cmd + Enter` 执行，`Tab` 缩进两格。

结果表格只在自身区域内滚动（页面不会整体滚动），表头吸顶且字号比数据大一号。
查询控制台的写语句受两层限制：设置里的写策略 + 数据源自己的 `writable` / `allowDdl`。
只读源上执行 `DELETE` 会直接被拒：`db: 源 X 是只读的（writable 未开启），控制台写语句被拒绝`。

## 3. 模型侧工具

```
db_sources  probe: true                      # 先看有哪些源、哪个连不上
db_tables   source: "prod_WMS" filter: "Order"
db_schema   source: "prod_WMS" table: "dbo.Sys_Log"
db_query    source: "prod_WMS" sql: "SELECT TOP 10 * FROM Sys_Log WHERE CreateTime >= @p0" params: ["2026-01-01"]
db_execute  source: "dev_WMS"  sql: "UPDATE ... WHERE id = @p0" params: [42] allowWrite: true
```

返回是 JSON 字符串：`{ source, engine, columns, rows, truncated, rowCount, elapsedMs }`，
行数默认 100、上限 500；`truncated: true` 表示被截断，继续取数请改 SQL（分页 / 加条件）。

### 参数占位

| 引擎 | 占位符 | 示例 |
| --- | --- | --- |
| SQL Server | `@p0`, `@p1` … | `WHERE id = @p0` |
| PostgreSQL | `$1`, `$2` … | `WHERE id = $1` |
| MySQL | `?` | `WHERE id = ?` |

### 只读护栏（`db_query`）

- 只放行 `SELECT` / `WITH` / `VALUES` 开头的**单条**语句；
- 命中 `INTO` / `EXEC` / `OPENROWSET` / `DBCC` / `WAITFOR` / DDL / DML 等关键字会被拒；
- 判定前会剥离字符串、注释、`[]` / `""` / 反引号标识符，字面量里的关键字不会误伤。

### 写通道（`db_execute`）

必须同时满足：源 `writable: true` + 调用带 `allowWrite: true`；DDL 还要源 `allowDdl: true`；
默认只允许单条语句（批量要开 `allowBatch`）；`xp_*` / `BACKUP` / `GRANT` 等提权语句一律拒绝。

## 4. 源清单写法（不想用界面时）

`~/.dsh/database-tool/sources.json`：

```json
[
  {
    "id": "prod_WMS",
    "engine": "sqlserver",
    "host": "10.0.0.9",
    "port": 1433,
    "database": "DemoERP",
    "user": "readonly",
    "passwordEnv": "DEMO_ERP_PW",
    "writable": false
  },
  {
    "id": "report_pg",
    "engine": "postgres",
    "host": "pg.internal",
    "port": 5432,
    "database": "analytics",
    "user": "reader",
    "passwordEnv": "DEMO_PG_PW",
    "ssl": true
  }
]
```

改完保存即生效（按 mtime 热加载），不用重启 DSH。
字段含义见 README「字段」表；老版本的 `server` 字段仍然认，缺省引擎是 `sqlserver`。

## 5. 从 dsh-tool-mssql 升级

```bash
dsh plugin --profile web remove dsh-tool-mssql
dsh plugin --profile web add dsh-tool-database
```

首次启动会把 `~/.dsh/mssql-tool/sources.json` 复制成 `~/.dsh/database-tool/sources.json`（只复制不删除）。
工具名从 `mssql_*` 换成 `db_*`，参数基本一致；`mssql_query` → `db_query`、`mssql_execute` → `db_execute`。

## 6. 排错

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| 面板里没连接 | 清单文件不存在或为空 | 用界面新建一条，或检查 `sources.json` 的 JSON 合法性 |
| `引用的环境变量 X 未设置或为空` | DSH 进程读不到该变量 | 设系统环境变量后重启 DSH，或先用明文 `password` 过渡 |
| 测试连接报 `Login failed` / `password authentication failed` | 账号或密码错、或只允许特定来源 | 核对账号权限与来源 IP；SQL Server 确认混合验证已开 |
| `self signed certificate` | 服务端证书自签 | 打开该源的 TLS / SSL，或 SQL Server 加 `trustServerCertificate: true` |
| `ECONNREFUSED` | 端口不通 / 服务没监听本机网段 | 检查防火墙与服务监听地址 |
| `db_schema` 返回空 | 账号没有元数据可见权限 | 授予对应库的元数据读权限，或换账号 |
| `Timeout` | 语句超过 `requestTimeoutMs`（默认 15s） | 优化 SQL，或给该源加大超时 |
| 控制台写语句被拒 | 写策略是「一律只读」或源 `writable` 未开 | 设置 → 数据库连接改策略；或编辑连接打开「允许写入」（慎用） |
| 界面显示 `当前连接来自插件 config.sources` | profile 的 `cordis.patch.yml` 里写了 `sources` | 清空 `config.sources`，改用界面 / JSON 文件管理 |

## 7. 已知限制

- 写通道默认单条语句，批量请开 `allowBatch`；
- 连接池按「引擎 + 源 id + 主机 + 端口 + 库 + 账号」缓存，改这几项需重启 DSH 才换池；
- 查询结果一次性取回再截断，超大结果集请用分页 SQL；
- `ssl: false` 时流量不加密，跨公网请开 TLS。

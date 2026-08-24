# TorrentHub

追番管理平台 —— 按三层结构组织资源：**动画 → 集 → 种子**。

acg-rss 将种子按标题自动解析（分辨率 / 季 / 集 / 番组名 / 字幕组），
关联到追踪的作品下；每个作品都有 Mikan 风格的层级视图：
作品 → 剧集 → 发布版本（字幕组 / 分辨率 / 大小）。

```
动画（anime） → 集（anime_episodes） → 种子（torrent_items）
```

站点大部分页面**公开**（追番列表、作品详情、剧集）；管理操作与
管理区页面（`/admin/*`）需要管理员账号登录。第一个注册的账号自动成为管理员
（`pnpm db:seed` 也会把 demo 用户提升为管理员）。

## 功能

- **多语言界面** — English、简体中文、日本語、한국어，可在应用内切换
- **追番管理** — 追踪作品（标题 + 多语言别名 + 观看状态 +
  地区 / 放送星期 / 类型等元数据），种子按解析标题自动关联到作品与集
- **层级视图** — 作品 → 集 → 发布版本；同集不同字幕组 / 分辨率的
  版本聚合展示；集数未识别的资源单独分组
- **标题解析** — 从种子标题解析分辨率 / 季 / 集 / 番组名 / 字幕组
  （SxxExx、第 N 话、EP 前缀等）
- **资源管理** — `/torrents` 种子索引：搜索 / 按作品筛选 / 分页；
  管理员可手动添加、编辑、删除种子（info-hash 自动去重，
  入库后自动关联到追番）
- **管理区**（`/admin/*`，仅管理员）— 动漫管理：全表视图 + 修改人 /
  修改时间审计 + 编辑 / 删除；集管理：编辑剧集备注（`content`）

> 注：RSS 抓取与 qBittorrent 自动下载链路已移除；种子入库走
> `/torrents` 手动添加，后续可再接入第三方 API。

## 技术栈

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 ·
next-intl · PostgreSQL + Drizzle ORM · zod

## 数据库结构

三层资源层级 + 账号表，共 6 张表（定义见 `src/db/schema.ts`）：

```
users ──< anime ──< anime_infos      （多语言名称，参与匹配）
              └──< anime_episodes ──< torrent_items
                           └──< episode_contents（多语言剧集简介）
```

### anime — 动画（第 1 层）

| 列 | 类型 | 说明 |
| --- | --- | --- |
| `id` | serial PK | |
| `user_id` | int → users（级联删除） | 归属用户 |
| `title` | varchar(255) | 主显示名（与 anime_infos 中 kind=primary 同步） |
| `season` | int，默认 1 | 第几季（集号在其内编号） |
| `year` | int | 放送年份 |
| `origin` | varchar(16) | 制作地区：JP / CN / HK / TW / KR / WEST / OTHER |
| `air_day` | int | 每周放送星期（ISO 星期：1=周一 … 7=周日） |
| `type` | varchar(16) | 类型：TV / MOVIE / OVA / ONA / SPECIAL / OTHER |
| `cover_url` | text | 封面图地址（海报；绝对 http(s) 链接） |
| `watch_status` | varchar(16) | PLANNED / WATCHING / PAUSED / COMPLETED / DROPPED |
| `created_at` | timestamptz | |
| `updated_by` | int → users（置空） | 最后修改人（保存动作每次写入） |
| `updated_at` | timestamptz | 修改时间（ORM 更新时自动刷新） |

### anime_infos — 动画名称（匹配用别名）

| 列 | 类型 | 说明 |
| --- | --- | --- |
| `id` | serial PK | |
| `anime_id` | int → anime（级联删除） | |
| `kind` | varchar(16) | `primary`（显示名）/ `synonym`（别名） |
| `lang` | varchar(16) | 自由标签：`ja`、`zh-Hans`、`en`、`romaji`… |
| `title` | varchar(255) | 名称本体 |
| `content` | text | 附着在该名称下的自由备注 / 简介（可空） |
| `created_at` | timestamptz | |

唯一约束 `(anime_id, title)`。所有名称（主名 + 别名）都参与种子匹配。

### anime_episodes — 集（第 2 层）

| 列 | 类型 | 说明 |
| --- | --- | --- |
| `id` | serial PK | |
| `anime_id` | int → anime（级联删除） | |
| `number` | int | 集数（从发布标题解析） |
| `content` | text | 旧版单语言简介；已被 episode_contents 取代，仅作渲染兜底 |
| `cover_url` | text | 剧集截图 / 缩略图地址 |
| `created_at` / `updated_at` | timestamptz | `updated_at` 随 ORM 更新自动刷新 |

唯一约束 `(anime_id, number)`。集行由链接器按需创建：新种子匹配到
作品且解析出集数时自动建行；同一集的不同版本（字幕组 / 分辨率）
共用一行。集数未识别的种子只挂在作品上，不建集行。

### episode_contents — 多语言剧集简介

| 列 | 类型 | 说明 |
| --- | --- | --- |
| `id` | serial PK | |
| `episode_id` | int → anime_episodes（级联删除） | |
| `lang` | varchar(16) | 语言标签，对应 UI 语言：`en`、`zh-CN`、`ja`、`ko` |
| `content` | text | 该语言下的剧集简介 |
| `created_at` / `updated_at` | timestamptz | |

唯一约束 `(episode_id, lang)`。剧集页按访客语言选取对应行，
无匹配时回退到任意一行，再回退到 anime_episodes.content。

### torrent_items — 种子（第 3 层）

| 列 | 类型 | 说明 |
| --- | --- | --- |
| `id` | serial PK | |
| `title` / `description` | text | 原始标题 / 描述 |
| `magnet` / `torrent_url` | text | 磁力链 / .torrent 地址 |
| `info_hash` | varchar(64)，唯一 | 去重键：btih，无则 sha1(torrent_url) |
| `size` | bigint | 体积（字节） |
| `publish_time` | timestamptz | 发布时间 |
| `category` | varchar(128) | 来源分类 |
| `anime_title` / `season` / `episode` / `resolution` / `subgroup` | — | 标题解析字段（种子固有属性） |
| `anime_id` | int → anime（置空） | 链接器命中作品时设置 |
| `episode_id` | int → anime_episodes（置空） | 集数解析出时指向集行 |
| `created_at` | timestamptz | |

### users — 账号

| 列 | 类型 | 说明 |
| --- | --- | --- |
| `id` | serial PK | |
| `username` / `email` | varchar，唯一 | |
| `password_hash` | text | bcrypt |
| `role` | varchar(16)，默认 `user` | `admin` 可管理追番 |
| `created_at` / `updated_at` | timestamptz | |

## 快速开始

### 1. 环境要求

- Node.js 20+
- PostgreSQL 15+（或直接使用自带的 Docker Compose）

### 2. 安装依赖

```bash
pnpm install
```

### 3. 启动 PostgreSQL

```bash
docker compose up -d
```

（或者把 `.env` 里的 `DATABASE_URL` 指向你自己的 PostgreSQL）

### 4. 配置环境变量

复制 `.env.example` 为 `.env` 并调整：

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/torrent_hub
AUTH_SECRET=<任意长随机字符串>       # 签名会话 Cookie
```

### 5. 建表 & 初始数据

```bash
pnpm db:push     # 应用表结构
pnpm db:seed     # demo 用户（demo / demo12345，管理员）
```

### 6. 运行

```bash
pnpm dev
```

打开 http://localhost:3000 —— 浏览无需登录；用 `demo` / `demo12345`
登录后可管理追番。

## 脚本

| 命令 | 说明 |
| --- | --- |
| `pnpm dev` | 开发服务器 |
| `pnpm build` / `pnpm start` | 生产构建 / 启动 |
| `pnpm db:push` | 应用表结构到数据库 |
| `pnpm db:generate` / `db:migrate` | 生成 / 执行 SQL 迁移 |
| `pnpm db:studio` | Drizzle Studio（浏览数据） |
| `pnpm db:seed` | 初始化 demo 用户 |
| `pnpm db:backfill-episodes` | 旧结构数据回填集表（见下） |
| `pnpm lint` | ESLint |

## 旧数据迁移

从"RSS 聚合 + 自动下载"旧版本升级时，已关联到作品且解析出集数的
存量种子需要回填到集表：

```bash
pnpm db:push                  # 先应用新表结构（会 DROP 已移除的表）
pnpm db:backfill-episodes     # 为存量种子创建集行并挂链
```

> `db:push` 会删除 rss_feeds / download_rules / download_tasks /
> qbittorrent_accounts / api_tokens 表及 torrent_items.feed_id 列，
> 执行前请备份。


## 路线图

- 种子入库数据源（手动添加 / 第三方 API）
- 通知系统（Telegram / Discord / Email）
- 字幕组聚合页（`/subgroup/[name]`）

> 请合规使用：只下载你有合法权利获取的内容。

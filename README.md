# TorrentHub

Torrent RSS aggregation + qBittorrent auto-download management platform.

TorrentHub watches your torrent RSS feeds, deduplicates items by info-hash,
matches them against your download rules, and pushes magnets straight to your
own qBittorrent Web UI — then keeps download progress in sync.

```
RSS Feed → 内容解析 → 规则匹配 → 自动下载 → qBittorrent → 下载状态同步
```

## Features

- **Multi-language UI** — English, 简体中文, 日本語, 한국어 (switchable in-app)
- **RSS feeds** — add any torrent RSS (nyaa.si custom fields supported),
  per-feed refresh interval, manual fetch, error tracking
- **Dedup & parsing** — info-hash based dedup; titles parsed into
  resolution / season / episode / series name
- **Search** — keyword search with feed and resolution filters
- **Download rules** — keywords (all must match), exclude keywords, regex,
  resolution, size range, per-feed restriction
- **qBittorrent binding** — multiple clients per user, credentials encrypted
  with AES-256-GCM, connection test before saving
- **Download tracking** — status/progress/speeds polled every minute
- **API tokens** — Bearer-token auth for external automation
- **Background jobs** — built-in scheduler (no Redis needed): RSS refresh,
  rule matching, qBittorrent sync

## Tech stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 ·
next-intl · PostgreSQL + Drizzle ORM · zod

## Getting started

### 1. Requirements

- Node.js 20+
- PostgreSQL 15+ (or just use the bundled Docker Compose)

### 2. Install dependencies

```bash
pnpm install
```

### 3. Start PostgreSQL

```bash
docker compose up -d
```

(or point `DATABASE_URL` in `.env` at your own PostgreSQL)

### 4. Configure environment

Copy `.env.example` to `.env` and adjust:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/torrent_hub
AUTH_SECRET=<any long random string>       # signs session cookies
ENCRYPTION_KEY=<any long random string>    # encrypts qB credentials
JOBS_ENABLED=true                           # background scheduler
```

### 5. Create tables & seed

```bash
pnpm db:push     # apply the schema
pnpm db:seed     # demo user (demo / demo12345) + sample Nyaa feed
```

### 6. Run

```bash
pnpm dev
```

Open http://localhost:3000 — sign in with `demo` / `demo12345`, or register
a new account.

## Usage

1. **Feeds** — add your torrent RSS sources (e.g.
   `https://nyaa.si/?page=rss&c=0_1&f=0`), hit "Fetch now" to index items.
2. **Settings → qBittorrent** — bind your client (Web UI URL + credentials),
   use "Test connection" to verify. Credentials are stored AES-256-GCM
   encrypted.
3. **Rules** — create rules like keywords `葬送的芙莉莲, 1080p` with size
   bounds; every new matching torrent is pushed automatically.
4. **Torrents** — browse/search everything indexed; "Download now" pushes a
   single torrent to all your bound clients.
5. **Downloads** — live status/progress pulled from your clients every
   minute; failed tasks can be retried.

## Background scheduler

Runs inside the Next.js server process (started via `instrumentation.ts`):

| Job | Interval | Purpose |
| --- | --- | --- |
| RSS sweep | every 60 s | refresh feeds whose interval is due |
| Matcher catch-up | every 5 min | re-check recent torrents against rules |
| qBittorrent sync | every 60 s | update task status/progress/speeds |

Set `JOBS_ENABLED=false` to disable (e.g. when running multiple replicas,
or if you prefer external cron against API routes).

## Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | development server |
| `pnpm build` / `pnpm start` | production build / serve |
| `pnpm db:push` | apply schema to the database |
| `pnpm db:generate` / `db:migrate` | generate / run SQL migrations |
| `pnpm db:studio` | Drizzle Studio (browse data) |
| `pnpm db:seed` | seed demo user + sample feed |
| `pnpm lint` | ESLint |

## Project structure

```
src/
├── app/
│   └── [locale]/
│       ├── layout.tsx          # root layout, i18n provider, theme bootstrap
│       ├── page.tsx            # landing
│       ├── login/ register/    # auth pages
│       └── (app)/              # authenticated shell (sidebar)
│           ├── dashboard/
│           ├── feeds/
│           ├── torrents/
│           ├── rules/
│           ├── downloads/
│           └── settings/
├── components/                 # UI primitives + feature components
├── db/                         # Drizzle schema, client, seed
├── i18n/                       # next-intl routing / request config
├── lib/                        # parsers & formatters (shared)
├── messages/                   # en / zh-CN / ja / ko catalogues
└── server/
    ├── auth/                   # sessions, password, API tokens
    ├── rss/                    # feed parsing + ingest
    ├── qbittorrent/            # Web API client + account actions
    ├── rules/ feeds/ downloads/ tokens/  # server actions
    └── jobs/                   # scheduler + qB sync
```

## Roadmap

- Notifications (Telegram / Discord / Email)
- Anime tracker (series/episode library on top of the parsed fields)
- Meilisearch-backed full-text search
- Multi-client support (Transmission, Deluge)

> Use responsibly: only download content you are legally entitled to.

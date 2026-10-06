# Type Invaders — Vercel + Supabase edition

Created by Chinmay Deepak Chandavar.

**Start with [DEPLOY-FREE.md](DEPLOY-FREE.md).** It covers new Supabase, GitHub and Vercel projects, the free-plan limits, SQL setup, environment variables, registration and admin setup.

- React + Vite frontend on Vercel Hobby
- Supabase Auth, PostgreSQL and HTTPS REST/RPC API
- Four-stage typing game with EASY / NORMAL / HARD difficulty
- Leaderboard search, filtering, sorting, paging and CSV export
- Player history, charts, persistent scores, admin word packs and suspensions
- Protected database functions; no private keys in the browser

This is a separate hosting edition. The earlier MySQL + Spring Boot edition is unchanged. Local accounts and scores are not migrated.

## Local run

Use Node.js 22.12+ or 24. Copy `.env.example` to `.env.local`, enter your Supabase project URL and publishable key, and apply `supabase/schema.sql` first.

```sh
npm ci
npm run dev
```

```sh
npm run build
npm test
```

The SQL tests use an isolated PostgreSQL engine (PGlite); they do not access a live Supabase account. PGlite is a development test dependency only. The deployed app uses your real Supabase PostgreSQL database.

## API

The Supabase SDK calls `POST /rest/v1/rpc/ti_*` with the publishable key and signed-in user's access token. Public read functions are `ti_leaderboard` and `ti_words`. Profile, run and admin functions validate identity and role in the database. These are Supabase RPC endpoints over its HTTP API, not the earlier Spring REST route layout.

## Files

| Path | Purpose |
| --- | --- |
| `DEPLOY-FREE.md` | Full setup, cost and troubleshooting guide |
| `supabase/schema.sql` | Tables, permissions, RPC functions, triggers and seed words |
| `supabase/make-admin.sql` | Promote your own registered account |
| `src/api/` | Supabase connection and game API adapter |
| `vercel.json` | Vercel build and refresh routing |
| `tests/` | Isolated database authorization and game-flow verification |

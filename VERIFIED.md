# Verification performed

- Production Vite build with configured Supabase URL/key: passed.
- Isolated PostgreSQL engine (PGlite) tests: 10 passed, 0 failed.
- Tested schema rerun, signup trigger validation, role spoof prevention, direct table access denial, user-owned runs, rank calculation, score saving, duplicate submission rejection, persistent rejected audits, assist exclusion, sorting/filtering/paging, word-pack edits, suspensions and start throttling.
- Chromium browser using the real Supabase JavaScript SDK, simulated Auth/HTTP responses, and the same SQL functions: registration, sign-in/out, refresh persistence, game loss and score save, HARD difficulty, profile, leaderboard search, CSV export, mobile layout and admin screens passed. No uncaught page errors.
- Visual review: profile and mobile leaderboard checked.

No real Supabase or Vercel project was provisioned or deployed during preparation. Your hosted environment, credentials, email delivery, domain routing and live quotas still need the checklist in DEPLOY-FREE.md. Tests do not prove cheat-proof gameplay or production-scale performance.

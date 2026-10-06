# Host Type Invaders for free: Vercel + Supabase

This is a separate hosting edition of your game. It runs with React/Vite on Vercel and Supabase Auth + PostgreSQL + its HTTPS data API. Your laptop can be switched off after deployment.

The previous MySQL/Spring Boot ZIP remains your local/coursework edition. This ZIP does not use MySQL or run Spring Boot. Existing local accounts and scores are not automatically copied; register fresh accounts here.

## 1. Choose the free plans

Use your own GitHub account, **Vercel Hobby** and a **Supabase Free** organization. Use the included `your-project.vercel.app` address. No purchased domain, paid database connection, separate Java server, Vercel Function, Supabase Edge Function, or Realtime subscription is required.

Official limits checked on 5 October 2026 (providers can change them):

| Service | Selected plan | Useful limits / conditions |
| --- | --- | --- |
| Vercel | Hobby, $0 | Personal, non-commercial use; 100 GB fast data transfer and 1 million CDN requests included per month. Exceeding limits can restrict service until the quota resets. |
| Supabase | Free, $0 | 2 active free projects, 500 MB database per project, 50,000 monthly active users, 5 GB egress plus 5 GB cached egress, 1 GB file storage. Free projects pause after 1 week of inactivity. |
| Domain | Included Vercel address | Use the free `vercel.app` address. Buying your own domain is optional and normally costs money. |

Stay on these free plans; skip Pro trials and paid add-ons. A Supabase Pro organization starts at $25/month; Vercel Pro is paid too. This guide does not require either upgrade. A free deployment has quotas and no guarantee of uninterrupted availability.

The app uses Supabase's HTTPS API, so you do **not** paste a PostgreSQL connection string into Vercel, configure a connection pool, or pay a connection subscription. Unlimited API requests on Supabase Free still operate within its compute, data-transfer and other limits.

Sources: [Supabase pricing](https://supabase.com/pricing), [Vercel Hobby](https://vercel.com/docs/plans/hobby).

## 2. Create a NEW Supabase project

1. Open <https://supabase.com/dashboard> and sign in, for example using GitHub.
2. Create an organization if needed. Select the **Free** plan. If your organization is already paid, create/use a Free organization for this guide.
3. Click **New project**.
4. Name it `type-invaders`. Generate a strong database password and save it privately. This password is for database administration and is NOT used by the React app.
5. Choose a region close to you, such as Mumbai if available, and click **Create new project**.
6. Wait for the project to finish provisioning. If you already have two active free projects, resolve that limit before creating another; do not select a paid upgrade just to follow this guide.

## 3. Create the tables, functions, and starter words

1. In the new Supabase project, open **SQL Editor → New query**.
2. Open `supabase/schema.sql` from this ZIP in a text editor.
3. Copy its ENTIRE contents into SQL Editor and click **Run**.
4. The script creates three tables: `ti_profiles`, `ti_runs`, and `ti_word_packs`, plus the game API functions and five starter word packs.
5. Success can say “Success. No rows returned.” That is normal. The `ti_word_packs` table should contain 5 rows.

Do this before anyone registers. The registration trigger creates a profile from the supplied callsign. Re-running this exact script is safe and preserves accounts, scores, and existing word packs.

Use a fresh project. Do not run test fixtures or `tests/` code inside Supabase. The `auth.users` table is supplied and managed by Supabase itself.

The tables have Row Level Security enabled and no direct browser table grants. The browser calls deliberately granted SQL functions; those check the authenticated user and stored admin role. Keep those restrictions in place.

## 4. Configure sign-up for the free demo

Open **Authentication → Sign In / Providers → Email** (dashboard labels may vary).

- Enable email/password sign-in.
- For a personal/college demo without an email provider, turn **Confirm email OFF**, then save. Users can register and sign in immediately with email + password; their email ownership is **not verified** in this mode.
- Use at least an 8-character password. This app has no email-based password-recovery screen.

This step avoids the default Supabase email service limitation: without custom SMTP it sends only to project-team addresses, with a low sending quota (currently 2 emails/hour). Simply leaving confirmation enabled will not let arbitrary friends receive signup emails.

If you want verified emails for a public launch, configure your own SMTP provider and keep confirmation ON instead. SMTP may have its own free quota or cost, so that setup is outside the zero-email-service demo. The app handles the confirmation-required response and shows a “check your email” message.

Sources: [Password auth](https://supabase.com/docs/guides/auth/passwords), [SMTP restrictions](https://supabase.com/docs/guides/auth/auth-smtp).

## 5. Copy the two public connection values

Open the project's **Connect** dialog, or **Settings → API Keys**.

Copy:

1. Project URL: `https://YOUR-PROJECT-REF.supabase.co`
2. **Publishable key**: starts with `sb_publishable_`

Create a publishable key in API Keys if one is not displayed. Use the new publishable key format for this edition.

You will enter them in Vercel as:

```text
VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_REAL_KEY
```

These are browser values. Never put your database password, `sb_secret_` key, or legacy `service_role` key in a `VITE_` variable or GitHub. Those privileged keys are not needed by this app.

Source: [Supabase API keys](https://supabase.com/docs/guides/api/api-keys).

## 6. Create a NEW GitHub repository

1. Extract this ZIP.
2. Open the inner `type-invaders-vercel` folder. You should see `package.json`, `src`, `supabase`, and `vercel.json` directly inside it.
3. On <https://github.com/new>, create a repository named `type-invaders-vercel`. Choose a personal repository, and leave “Add README”, license and gitignore unchecked because this folder already has files.
4. Open PowerShell **inside the folder containing `package.json`** and run:

```powershell
git init
git add .
git commit -m "Type Invaders: Vercel and Supabase edition"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/type-invaders-vercel.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username. Use the URL of the NEW repository. No force push is needed. Upload the extracted project contents, not the ZIP file itself. The included `.gitignore` excludes local env files, dependencies and build output.

## 7. Create the NEW Vercel project

1. Open <https://vercel.com/new> and sign in with GitHub.
2. Select your **Hobby/personal** account or Hobby team.
3. Import the new `type-invaders-vercel` repository. If it is not listed, grant the Vercel GitHub app access to this repository.
4. Check the settings:

| Setting | Value |
| --- | --- |
| Framework Preset | Vite |
| Root Directory | `./` (folder that contains `package.json`) |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `npm ci` |
| Node.js | 22.x or 24.x |

5. Expand **Environment Variables** BEFORE deploying. Add the two real values from step 5 using the exact names. Include Production and Preview if you plan to test preview deployments. Previews will share this Supabase database.
6. Click **Deploy**.
7. Open the generated `https://YOUR-PROJECT.vercel.app` URL.

If you uploaded a parent folder to GitHub, set Root Directory to `type-invaders-vercel` instead. The root must be the directory containing `package.json`.

The included `vercel.json` supplies build settings and SPA rewrites, so refreshing `/play`, `/profile`, or `/leaderboard` works.

## 8. Set the Supabase site URL

In Supabase, open **Authentication → URL Configuration**:

- **Site URL:** `https://YOUR-PROJECT.vercel.app`
- **Redirect URLs:** add `https://YOUR-PROJECT.vercel.app/login`
- If running locally, also add `http://localhost:5173/login`.

Use your actual domain. Add an exact preview URL only when you need email links on that preview. Save the changes.

Register through the **game website** with a unique callsign, real email and a password. Sign-in uses your EMAIL; the callsign is the public leaderboard name.

## 9. Make your own account admin (optional)

Register your account through the website first. Then open `supabase/make-admin.sql`, replace the example email with your own registered email, and run it in the Supabase SQL Editor. Refresh the website or sign out and back in. You should see **Admin** in the navigation.

No shared default admin account or password exists. Admins can maintain word packs and suspend players. Built-in F9 assist is admin-only; assisted results appear in that player's history but are excluded from the public leaderboard and personal best.

## 10. Confirm it works

1. Register, sign out, and sign back in using email.
2. Start a game and finish/lose one run. Look for **Saved: ... points**.
3. Open **Profile** and check that run's score and difficulty.
4. Open **Leaderboard** and test search, difficulty, sorting and CSV export. Assisted practice will not appear here.
5. Refresh `/profile` directly. You should stay signed in and avoid a 404.
6. Open an incognito window. The public leaderboard should work, while Play/Profile require sign-in and Admin requires your admin role.

This package was tested locally with the production React build, a PostgreSQL engine (PGlite), and a browser using simulated Supabase Auth/HTTP responses. Hosted credentials, email delivery, Vercel rewrites, and your real Supabase project still require these deployment checks.

## Local development (optional)

Install Node.js 22.12+ or 24, then in this project's folder:

```powershell
Copy-Item .env.example .env.local
notepad .env.local
npm ci
npm run dev
```

Put your two real Supabase values in `.env.local`. Open <http://localhost:5173>. This uses your hosted Supabase project; MySQL, Java and Maven are not required for this edition.

Build and database verification:

```powershell
npm run build
npm test
```

The tests run an isolated PostgreSQL engine locally. They never connect to your hosted database. Vercel runs the build; it does not need to run the tests.

## Fix common deployment problems

| Symptom | Fix |
| --- | --- |
| “Finish setting up Type Invaders” | Add both `VITE_SUPABASE_...` variables in Vercel, then redeploy. Vite embeds them at build time. |
| “Use your Supabase project URL and publishable key” | Copy the project HTTPS URL and `sb_publishable_...` key, without quotes or placeholders. |
| Database setup incomplete / function not found | Run all of `supabase/schema.sql` in the SAME Supabase project your URL points to. |
| “Database error saving new user” | Callsign may already be taken (case-insensitive), invalid, or the schema/trigger was not installed. Try a new 3–24 character callsign and check Auth logs. |
| Invalid login credentials | Sign in with email, not callsign. Old MySQL accounts are separate; register here first. |
| Email not confirmed / signup email never arrives | Follow step 4. Confirmation ON requires usable SMTP for external users. Existing unconfirmed users must still be confirmed through Auth management or receive a confirmation email. |
| Failed to fetch / project unavailable after days | Check network, copied project URL, and whether Supabase paused the project. Resume it in the dashboard. |
| `/profile` returns 404 on refresh | Ensure `vercel.json` was committed and Vercel Root Directory points to this project. Redeploy. |
| Admin menu missing | Run `make-admin.sql` for the correct already-registered email, then refresh/sign in again. |
| Score absent from public board | Check saved message, difficulty/search filters, whether assist was used, or whether the player is suspended. |
| Too many starts | Wait one minute; run creation is capped at 10 per minute per player. |
| Build cannot find package.json | Correct the Vercel Root Directory to the folder containing it. |

Later changes: edit files, `git add .`, `git commit -m "Update game"`, then `git push`. Vercel redeploys automatically. Database changes still need to be applied in Supabase. Back up important scores yourself; free database automatic backups are not included.

## Scope of score checks

The database enforces ownership, server timestamps, payload bounds, one submission per run, plausible score ceilings and admin permissions. Rank is recalculated in SQL. The gameplay itself runs in the browser, so these checks do not make the game cheat-proof or suitable for a prize competition.

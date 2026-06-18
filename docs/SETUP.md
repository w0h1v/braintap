# Setup — Accounts, Cloud Sync & Deployment

BrainTap works fully offline with `localStorage`. Follow this to enable accounts
(Google + email/password), cross-device sync, and global leaderboards, then deploy.

## 1. Create a Supabase project

1. Create a project at <https://supabase.com>.
2. In **Project Settings → API**, copy the **Project URL** and the **anon /
   publishable** key.
3. Locally:
   ```bash
   cp .env.example .env.local
   ```
   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=https://YOURPROJECT.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   ```

## 2. Apply the database schema

Run `supabase/migrations/0001_init.sql` against your project — either:

- **Dashboard:** SQL Editor → paste the file → Run, or
- **CLI:**
  ```bash
  supabase link --project-ref YOURREF
  supabase db push
  ```

This creates `profiles` and `game_results` with row-level security (users only
touch their own rows), the `get_daily_leaderboard()` / `get_live_count()` RPCs
used by the leaderboard, and a trigger that auto-creates a profile on signup.

## 3. Email/password auth

Works immediately. **Authentication → Providers → Email** is on by default.
Optionally disable "Confirm email" for faster local testing (the signup page
already handles the confirmation flow either way).

## 4. Google OAuth

1. In **Google Cloud Console** → APIs & Services → Credentials → create an
   **OAuth 2.0 Client ID** (Web application).
2. Authorized redirect URI:
   `https://YOURPROJECT.supabase.co/auth/v1/callback`
3. In Supabase **Authentication → Providers → Google**, paste the Client ID and
   Client Secret, save.
4. In Supabase **Authentication → URL Configuration**, set:
   - **Site URL:** your production URL (and `http://localhost:3000` for dev)
   - **Redirect URLs:** add `http://localhost:3000/auth/callback` and
     `https://YOURDOMAIN/auth/callback`

The app sends users to `/auth/callback`, which exchanges the code for a session
(`src/app/auth/callback/route.ts`) and the middleware keeps it fresh.

## 5. Deploy to Vercel

1. Push to GitHub and import the repo at <https://vercel.com>.
2. Add the three env vars from `.env.local` (set `NEXT_PUBLIC_SITE_URL` to your
   production URL).
3. Deploy. Update the Supabase **Site URL / Redirect URLs** and the Google OAuth
   redirect to your production domain.

## How data flows

- **Offline / signed out:** the zustand store (`src/lib/progress.ts`) persists
  results, streaks, settings to `localStorage`.
- **Signed in:** `src/lib/sync.ts` pushes local results to `game_results`
  (keeping the better score) and pulls remote results back, and upserts the
  profile streak. The leaderboard reads the RPCs; offline it synthesizes a
  deterministic local board so the UI is never empty.

Everything degrades gracefully: if Supabase env is absent, auth UI shows a
"play as guest" notice and all network calls no-op.

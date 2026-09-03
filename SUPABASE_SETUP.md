# Connect Level Up Discovery to Supabase

## 1. Create the database

Open **Supabase → SQL Editor → New query**, paste the complete contents of `supabase/level-up-schema.sql`, and select **Run**.

## 2. Configure the sign-in return address

Open **Supabase → Authentication → URL Configuration**.

- Site URL: `https://pinalworkforce1-del.github.io/LU_Discovery/`
- Redirect URL: `https://pinalworkforce1-del.github.io/LU_Discovery/**`

## 3. Add GitHub Actions secrets

Open **GitHub repository → Settings → Secrets and variables → Actions → New repository secret** and create:

- `VITE_SUPABASE_URL` — the Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — the Supabase publishable key

The publishable key is intentionally used in the browser. Never add a Supabase secret key or `service_role` key to this application.

## 4. Deploy

Upload the updated source files and commit to `main`. The included GitHub workflow supplies the two repository secrets during `npm run build` and deploys the result.

## 5. Pilot test

1. Open Discovery in a private/incognito browser window.
2. Enter an email and request the secure link.
3. Open the email link and begin Discovery.
4. Complete one reflection and confirm the cloud icon settles into its saved state.
5. In Supabase **Table Editor → module_progress**, confirm a `discovery` record exists.
6. Sign in from a second browser or device and confirm the participant resumes at the same scene.

## Current privacy boundary

Participants can read and update only their own profile and module progress. Coach access is intentionally not enabled yet; it will be added with explicit participant assignment and role-based policies when the coach dashboard is built.

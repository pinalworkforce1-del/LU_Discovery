# Level Up — Discovery

Interactive Discovery module for Level Up. Learners explore strengths, values, purpose, support needs, and a next quest through narrated scenes, accessible exploration cards, native reflections, cloud-saved progress, a coach snapshot, and a completion certificate.

## Local development

```bash
npm install
cp .env.example .env
npm run dev
```

Add the Supabase project URL and publishable key to `.env` before starting locally.

## Supabase

1. Run `supabase/level-up-schema.sql` in the Supabase SQL Editor.
2. In **Authentication → URL Configuration**, set the Site URL to `https://pinalworkforce1-del.github.io/LU_Discovery/` and add the same address to Redirect URLs.
3. In GitHub **Settings → Secrets and variables → Actions**, create repository secrets named `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

The browser receives only Supabase's public publishable key. Row-level security restricts each participant to their own profile and module progress.

## GitHub Pages

The included workflow builds and deploys the site whenever `main` is updated. In repository settings, set **Pages → Build and deployment → Source** to **GitHub Actions**.

Signed-in progress is synchronized to Supabase. A device copy remains available as a resilient fallback and existing pilot progress is migrated when a participant first signs in.

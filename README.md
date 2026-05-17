# YouPeak — Gym Journal

A minimalist gym journal app built with React, Supabase, and Vercel. Track workouts, exercises, sets, and goals. Bilingual (English / Serbian Latin).

**Repository:** [github.com/laslo-uri/you-peak](https://github.com/laslo-uri/you-peak) · **Version:** 0.1.0 (see `package.json`)

## Features

- **Activities (journal)** — Multiple sessions per day, optional start/end time, grouped home view
- **Exercises & sets** — Add from the library (with default sets) or custom lines; log reps × weight
- **Exercise library** — Browse by muscle group (global + user presets)
- **Public feed** — Share activities publicly; only you can edit your own
- **i18n** — English and Serbian (Latin)

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. In **SQL Editor**, either run `supabase/full_sql_script.sql` once (reset + schema + seed for local dev), **or** run `reset.sql` → `schema.sql` → `seed.sql` in order
3. In **Settings → API**, copy the Project URL and anon key

### 2. Environment

```bash
cp .env.example .env
# Edit .env and add:
# VITE_SUPABASE_URL=https://xxx.supabase.co
# VITE_SUPABASE_ANON_KEY=eyJ...
```

### 3. Run locally

```bash
npm install
npm run dev
```

### 4. Deploy to Vercel

**Required for the live site:** Vite bakes `VITE_*` variables in at **build** time. If they are missing, the app calls `placeholder.supabase.co` and sign-in shows “Failed to fetch”.

1. [Vercel Dashboard](https://vercel.com) → your project → **Settings** → **Environment Variables**
2. Add **`VITE_SUPABASE_URL`** = your Supabase **Project URL** (e.g. `https://abcdefgh.supabase.co`)
3. Add **`VITE_SUPABASE_ANON_KEY`** = the **anon public** key (Supabase → **Project Settings** → **API**)
4. Enable both for **Production** (and **Preview** if you use preview deploys)
5. **Deployments** → open the latest deployment → **⋯** → **Redeploy** (or push a new commit). Editing env vars alone does not update an old bundle.

CLI alternative: `npx vercel` then set the same names in the dashboard as above.

Or connect the GitHub repo to Vercel, add the two variables, then trigger a deploy.

## Development

Requires **Node.js 20+** (see `.nvmrc`).

| Command | Description |
|---------|-------------|
| `npm run dev` | Local dev server |
| `npm run lint` | ESLint |
| `npm run test` | Vitest (unit/component) |
| `npm run test:e2e` | Playwright smoke tests |
| `npm run build` | Production build (`dist/`) |
| `npm run check` | lint + test + build (matches most of CI) |

**CI:** pushes and PRs to `main` run [`.github/workflows/ci.yml`](.github/workflows/ci.yml) (lint, tests, build, e2e).

## Tech stack

- React + TypeScript + Vite
- Tailwind CSS v4
- Supabase (Auth + Postgres)
- React Router, TanStack Query
- i18next (en / sr)
- Vitest + Testing Library (unit/component tests)
- Playwright (e2e; see `e2e/` and `playwright.config.ts`)

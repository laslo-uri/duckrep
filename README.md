# YouPeak — Gym Journal

A minimalist gym journal app built with React and local SQLite. Track workouts, exercises, sets, and goals. Trilingual (English / Serbian Latin / Hungarian). Optional Tauri desktop shell.

**Repository:** [github.com/laslo-uri/you-peak](https://github.com/laslo-uri/you-peak) · **Version:** 0.1.0 (see `package.json`)

## Features

- **Activities (journal)** — Multiple sessions per day, optional start/end time, grouped home view
- **Exercises & sets** — Add from the library (with default sets) or custom lines; log reps × weight
- **Exercise library** — Browse by muscle group (global + user presets)
- **Local-first** — All data stored in SQLite on this device (browser: sql.js persisted to IndexedDB, with localStorage migration/fallback; desktop: Tauri SQL plugin). Settings includes a browser SQLite backup export.
- **i18n** — English, Serbian (Latin), and Hungarian

## Setup

### Run locally (web)

```bash
npm install
npm run dev
```

No `.env` or cloud backend required. The database is created automatically on first load.

### Deploy to Vercel

Static SPA — connect the GitHub repo and deploy. No environment variables needed.

```bash
npm run build
```

## Development

Requires **Node.js 20+** (see `.nvmrc`).

| Command | Description |
|---------|-------------|
| `npm run dev` | Local dev server |
| `npm run lint` | ESLint |
| `npm run test` | Vitest (unit/component) |
| `npm run test:e2e` | Playwright smoke + journal tests |
| `npm run build` | Production build (`dist/`) |
| `npm run check` | lint + test + build |

**CI:** pushes and PRs to `main` run [`.github/workflows/ci.yml`](.github/workflows/ci.yml) (lint, tests, build, Playwright e2e).

## Desktop (Tauri)

**Prerequisites:** [Rust](https://rustup.rs/), Node 20+, WebView2 (included on Windows 10/11).

```powershell
npm install
npm run icon          # first time / after logo change
npm run tauri:dev     # dev window
npm run tauri:build   # release exe + NSIS installer
powershell -ExecutionPolicy Bypass -File scripts/create-desktop-shortcut.ps1
```

**Outputs:**

- `src-tauri/target/release/youpeak.exe`
- `src-tauri/target/release/bundle/nsis/YouPeak_0.1.0_x64-setup.exe`

## Tech stack

- React + TypeScript + Vite
- Tailwind CSS v4
- SQLite (sql.js in browser, `@tauri-apps/plugin-sql` on desktop)
- React Router, TanStack Query
- i18next (en / sr / hu)
- Vitest + Testing Library (unit/component tests)
- Playwright (e2e; see `e2e/` and `playwright.config.ts`)

## Legacy Supabase

The `supabase/` folder contains SQL from an earlier cloud-backed version. The app no longer uses Supabase. See [`supabase/README.md`](supabase/README.md).

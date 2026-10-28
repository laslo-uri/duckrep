# Duckrep — every rep, logged

A training journal: workouts, exercises, sets and body stats. Local-first (SQLite on the device), locked with a passphrase and encrypted at rest, trilingual (English / Serbian Latin / Hungarian). Ships as a website, a Tauri desktop app and a Capacitor shell for Android and iOS.

*Duckrep* (duck + rep) belongs to the same family of personal apps as Stashbird (finance) and Hawkdone (tasks): a bird plus what it does. It was called **YouPeak** until October 2026; food tracking moved out to its own app, **Dovediet**, at the same time (see [Food moved to Dovediet](#food-moved-to-dovediet)).

**Repository:** [github.com/laslo-uri/duckrep](https://github.com/laslo-uri/duckrep) · **Version:** 0.1.0 (see `package.json`)

## Features

- **Activities (journal)** — Multiple sessions per day, optional start/end time, grouped home view
- **Exercises & sets** — Add from the library (with default sets) or custom lines; log reps × weight
- **Exercise search** — A body map (front and back, our own SVG) filters by muscle; text search and an equipment filter; one click adds the exercise to today's activity (or starts one). Works offline on the built-in library; MuscleWiki is an optional second source (below)
- **Body stats** — Height, weight log, goal weight, training stats and streaks
- **Lock and encryption** — See below
- **Backups** — Settings → Data exports and imports a journal JSON, and downloads the full SQLite database
- **i18n** — English, Serbian (Latin), and Hungarian

## Lock screen and encryption

The app opens on a lock screen. The first start creates a passphrase (at least 10 characters), or takes `VITE_DUCKREP_PASSWORD` from `.env` once (see `.env.example`; that value is compiled into the bundle, so change it afterwards in Settings → Security). Same scheme as Stashbird and Hawkdone: the passphrase is never stored; PBKDF2-SHA256 (310,000 rounds) derives a 32-byte key, a sealed constant verifies it, and the key lives only in memory until "Lock now" or the auto-lock timer (Settings → Security, default 15 minutes without input). There is no recovery of a lost passphrase, so export a backup now and then.

The journal is one SQLite database (sql.js, in memory while unlocked). After every change the whole file is sealed with XSalsa20-Poly1305 (tweetnacl) and written as one record together with the salt and the verifier, so a write is atomic:

- browser and phone shell: IndexedDB `duckrep-db`, store `vault`
- desktop: `%APPDATA%\com.duckrep.app\journal.vault` (temp file + rename, `vault_*` commands in `src-tauri/src/lib.rs`)

Code: `src/lib/vault/` (crypto, storage, vault, auto-lock), `src/components/LockScreen.tsx`, `src/components/VaultGate.tsx`, `src/components/SecuritySettings.tsx`. Preferences (theme, language, auto-lock delay) are not secret and stay in the plain user store.

## Moving from YouPeak

- **Desktop:** on the first start the Tauri shell copies `%APPDATA%\com.youpeak.app` and `%LOCALAPPDATA%\com.youpeak.app` to `com.duckrep.app` (only when the new folders do not exist yet). The first unlock reads the copied plaintext `youpeak.db` (its WAL flag is cleared for sql.js), seals it into `journal.vault` and deletes the plaintext copy. The original `com.youpeak.app` folders are left untouched as a fallback; delete them by hand once Duckrep shows your data.
- **Browser:** on the same origin, the first unlock seals the old IndexedDB `youpeak-db` (or the older localStorage dump) into `duckrep-db` and removes the plaintext. A new domain is a new origin with an empty browser store: export a journal JSON on the old site and import it on the new one.
- Preferences: `youpeak-theme` is still read when `duckrep-theme` is missing. Journal JSON files exported by YouPeak import as they are.

## Food moved to Dovediet

Food logging and nutrition goals live in **Dovediet** now. Nothing was deleted from existing journals:

- Journals started under YouPeak keep the `food_entries` table and the `calorie_goal`, `protein_goal_g`, `carbs_goal_g`, `fat_goal_g` columns of `user_stats`. No migration drops them; Duckrep simply no longer reads or writes them. New journals do not create them.
- **Settings → Data → Export journal JSON** includes them under `food` next to `workouts`, so Dovediet can import them:

  ```json
  "food": {
    "entries": [{ "id": "…", "user_id": "…", "date": "2026-10-01", "name": "Oats", "calories": 370, "protein_g": 13.5, "carbs_g": 60, "fat_g": 7, "created_at": "…" }],
    "goals": { "calorie_goal": 2400, "protein_goal_g": 150, "carbs_goal_g": null, "fat_goal_g": 70 }
  }
  ```

  The key is absent when the journal never had food. **Export SQLite** (the full unencrypted database) contains the table too.
- The old `/food` route redirects to the journal.

## Setup

### Run locally (web)

```bash
npm install
npm run dev
```

No `.env` or cloud backend required. The lock screen asks for a passphrase on first load.

### Deploy to Vercel

Static SPA plus one function: `api/musclewiki.ts` (the MuscleWiki proxy). Connect the GitHub repo and deploy. `vercel.json` pins the Vite build and keeps `/api/*` out of the SPA rewrite.

### Environment

All variables are optional.

| Variable | Description |
|----------|-------------|
| `VITE_DUCKREP_PASSWORD` | Passphrase used once, for first-time setup, instead of asking. Compiled into the bundle; never set it on a public deploy. |
| `VITE_GTM_ID` | Google Tag Manager container ID (`GTM-XXXXXXX`). Loads `gtm.js` only after the visitor accepts cookies. |
| `VITE_GA_ID` | GA4 measurement ID (`G-XXXXXXXXXX`). Loads `gtag.js` only after the visitor accepts cookies. |
| `MUSCLEWIKI_API_KEY` | **Server-only** (no `VITE_` prefix): MuscleWiki API key, read by `api/musclewiki.ts` on Vercel and by the Vite dev/preview servers. Never in the bundle. |
| `VITE_MUSCLEWIKI_PROXY` | Origin of a deployed Duckrep (e.g. `https://you-peak.vercel.app`) whose `/api/musclewiki` the desktop and phone builds call. Not a secret. Web builds use their own origin. |

### MuscleWiki (optional)

The Exercises page has a **MuscleWiki** source next to the offline library. What its API requires (checked 2026-10-28, [docs](https://api.musclewiki.com/documentation), [API terms](https://api.musclewiki.com/api-terms)):

- A key from the MuscleWiki API dashboard (not RapidAPI). The free BASIC plan is playground-only; direct API access starts at TESTING ($10/month, English only); other languages need GROWTH.
- A monthly call quota (`429` when used up). Every `/stream/` request, including each video range request, counts as a call.
- The key must not ship in a client app, and the API sends no CORS headers. So the app calls Duckrep's own proxy, which adds the key server-side, forwards only read endpoints, and passes video through with MuscleWiki's `no-store` headers.
- Caching: metadata up to 30 days (the app keeps `/categories` and `/muscles` 30 days in `localStorage`), thumbnails and body-map images 24 h, videos transient only. No offline storage or bundling of their media. Adding a MuscleWiki exercise to a workout files only its name and muscle group in your library (`musclewiki:<id>`).
- Attribution: "Exercise data and videos provided by MuscleWiki.com" is shown under the results.

Without a key (or offline, or on a static host) the tab says so and the library keeps working. The body map and the offline muscle and equipment data come from [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (public domain): `npm run import-anatomy` regenerates `src/lib/db/exerciseAnatomy.generated.ts`.

Consent uses Google Consent Mode v2: every storage flag defaults to `denied`, the choice is kept in `localStorage` under `cookie-consent`, and the "Cookies" link in the footer reopens the banner. Logic in `src/lib/consent.ts`, banner in `src/components/CookieConsent.tsx`.

## Development

Requires **Node.js 20+** (see `.nvmrc`). CI reads that file.

| Command | Description |
|---------|-------------|
| `npm run dev` | Local dev server |
| `npm run lint` | ESLint |
| `npm run test` | Vitest (unit/component) |
| `npm run test:e2e` | Playwright: smoke, journal, lock, exercise search (MuscleWiki mocked), axe at 375/768/1440 in light and dark with a console-error check (`e2e/helpers/vault.ts` gets past the lock screen) |
| `npm run build` | Production build (`dist/`) |
| `npm run check` | lint + test + build |
| `npm run ci:local` | `check` plus the whole e2e suite: what GitHub Actions runs |

**CI:** pushes and PRs to `main` run [`.github/workflows/ci.yml`](.github/workflows/ci.yml) (lint, tests, build, Playwright e2e).

## Brand and icons

The mark is a dark duck with fire-orange wings biting a dumbbell, on a black tile; the wordmark is **Duck** in the text colour (white on dark, near-black on light) and **rep** in fire orange. Palette: `#09090B` `#18181B` `#2E2E33` `#45454D` (zinc/black), `#D63A08 → #E88818` (fire gradient), `#B83A0A` / `#C2410C` (orange on light), `#F06A20` (orange on dark), `#FAFAFA`. Themes in `src/index.css`: light "Chalk" and dark "Forge"; orange is the accent, button text is white on `#C2410C` (light) and black on `#F06A20` (dark), both WCAG AA.

The approved sources live in `__draft/bird-apps-brand/duckrep/` (outside the repo) and are copied, never edited here: `public/logo.svg` (rounded tile, also `favicon.svg` and `src-tauri/icon-source.svg`), `public/logo-fullbleed.svg` (square, for maskable and Apple icons), `public/duckrep-mark.svg` (the duck alone, Android adaptive foreground). `src/components/DuckrepLogo.tsx` shows the tile as an image plus the two-tone wordmark; hovering the logo makes the duck do one rep.

```bash
node scripts/build-web-icons.mjs   # apple-touch-icon, icon-192/512, maskable 512, og-image.png
npx tauri icon <1024px png of src-tauri/icon-source.svg> -o src-tauri/icons
npm run icon:desktop               # multi-size icon.ico for the Desktop shortcut
npm run icon:android               # Capacitor launcher icons (legacy, round, adaptive foreground; background #09090B)
```

## Desktop (Tauri)

**Prerequisites:** [Rust](https://rustup.rs/), Node 20+, WebView2 (included on Windows 10/11).

```powershell
npm install
npm run tauri:dev     # dev window
npm run tauri:build   # release exe + NSIS installer
powershell -ExecutionPolicy Bypass -File scripts/create-desktop-shortcut.ps1
```

**Outputs:**

- `src-tauri/target/release/duckrep.exe`
- `src-tauri/target/release/bundle/nsis/Duckrep_0.1.0_x64-setup.exe`

The shortcut script writes `Duckrep.lnk` on the Desktop and removes the old `YouPeak.lnk`.

## Phones (Capacitor)

The phone apps are the same React app inside a native WebView (app id `com.duckrep.app`). The website keeps normal URLs; the native shell uses a hash router so deep links do not 404. Data stays on the device (IndexedDB, sealed), same as the browser.

### Android (Windows)

Install [Android Studio](https://developer.android.com/studio) (SDK + a device or emulator), then:

```powershell
npm install
npm run cap:sync
npm run cap:android
```

`cap:sync` builds the web app and copies it into `android/`. In Android Studio, run the `app` configuration. Store signing is not set up.

### iOS (Mac)

`npx cap add ios` only works on macOS: `npm install`, `npm run build`, `npx cap add ios`, `npx cap sync`, `npx cap open ios`, then run `ios/App` from Xcode.

## Tech stack

- React + TypeScript + Vite, Tailwind CSS v4
- SQLite via sql.js on every platform, sealed with tweetnacl (XSalsa20-Poly1305) and a PBKDF2 key
- Tauri 2 (desktop), Capacitor (Android and iOS shells)
- React Router, TanStack Query, i18next (en / sr / hu)
- Vitest + Testing Library, Playwright

## Legacy Supabase

The `supabase/` folder contains SQL from an earlier cloud-backed version. The app no longer uses Supabase. See [`supabase/README.md`](supabase/README.md).

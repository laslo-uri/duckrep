# Duckrep — every rep, logged

A training journal: workouts, exercises, sets and body stats. Local-first (SQLite on the device), locked with a passphrase and encrypted at rest, trilingual (English / Serbian Latin / Hungarian). Ships as a website, a Tauri desktop app and a Capacitor shell for Android and iOS.

*Duckrep* (duck + rep) belongs to the same family of personal apps as Stashbird (finance) and Hawkdone (tasks): a bird plus what it does. It was called **YouPeak** until October 2026; food tracking moved out to its own app, **Dovediet**, at the same time (see [Food moved to Dovediet](#food-moved-to-dovediet)).

**Repository:** [github.com/laslo-uri/duckrep](https://github.com/laslo-uri/duckrep) · **Version:** 0.1.0 (see `package.json`)

## Features

- **Activities (journal)** — Multiple sessions per day, optional start/end time, grouped home view
- **Exercises & sets** — Add from the library (with default sets) or custom lines; log reps × weight
- **Exercise library** — Browse by muscle group (global + user presets)
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

Static SPA — connect the GitHub repo and deploy. `vercel.json` pins the Vite build.

### Environment

All variables are optional.

| Variable | Description |
|----------|-------------|
| `VITE_DUCKREP_PASSWORD` | Passphrase used once, for first-time setup, instead of asking. Compiled into the bundle; never set it on a public deploy. |
| `VITE_GTM_ID` | Google Tag Manager container ID (`GTM-XXXXXXX`). Loads `gtm.js` only after the visitor accepts cookies. |
| `VITE_GA_ID` | GA4 measurement ID (`G-XXXXXXXXXX`). Loads `gtag.js` only after the visitor accepts cookies. |

Consent uses Google Consent Mode v2: every storage flag defaults to `denied`, the choice is kept in `localStorage` under `cookie-consent`, and the "Cookies" link in the footer reopens the banner. Logic in `src/lib/consent.ts`, banner in `src/components/CookieConsent.tsx`.

## Development

Requires **Node.js 20+** (see `.nvmrc`). CI reads that file.

| Command | Description |
|---------|-------------|
| `npm run dev` | Local dev server |
| `npm run lint` | ESLint |
| `npm run test` | Vitest (unit/component) |
| `npm run test:e2e` | Playwright smoke + journal + lock tests (`e2e/helpers/vault.ts` gets past the lock screen) |
| `npm run build` | Production build (`dist/`) |
| `npm run check` | lint + test + build |

**CI:** pushes and PRs to `main` run [`.github/workflows/ci.yml`](.github/workflows/ci.yml) (lint, tests, build, Playwright e2e).

## Brand and icons

The mark is a mallard on a navy tile with a dumbbell in its bill (Stashbird holds a coin, Hawkdone has a check for an eye). Teal wing stripes, cream body, amber bill. `public/logo.svg` (rounded tile) and `public/logo-fullbleed.svg` (square, for iOS/Android which round icons themselves) are the masters; the same shapes are inline in `src/components/DuckrepLogo.tsx`, where hovering the logo makes the duck do one rep.

```bash
node scripts/build-web-icons.mjs   # apple-touch-icon, icon-192/512, maskable 512, og-image.png
npm run icon                       # Tauri icons (ico, icns, png, Android, iOS) from src-tauri/icon-source.svg
npm run icon:desktop               # multi-size icon.ico for the Desktop shortcut
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

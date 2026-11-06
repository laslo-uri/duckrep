/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** First-run passphrase for local builds only. Never set it on a public deploy. */
  readonly VITE_DUCKREP_PASSWORD?: string;
  /** Deployed Duckrep origin whose /api/musclewiki the desktop and phone shells use. Optional, not a secret. */
  readonly VITE_MUSCLEWIKI_PROXY?: string;
  /** Google Tag Manager container (GTM-XXXXXXX). Optional; analytics stays off without it. */
  readonly VITE_GTM_ID?: string;
  /** GA4 measurement ID (G-XXXXXXXXXX). Optional; analytics stays off without it. */
  readonly VITE_GA_ID?: string;
}

declare const __APP_VERSION__: string;

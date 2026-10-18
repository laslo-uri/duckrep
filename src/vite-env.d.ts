/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MUSCLEWIKI_API_KEY?: string;
  /** Google Tag Manager container (GTM-XXXXXXX). Optional; analytics stays off without it. */
  readonly VITE_GTM_ID?: string;
  /** GA4 measurement ID (G-XXXXXXXXXX). Optional; analytics stays off without it. */
  readonly VITE_GA_ID?: string;
}

declare const __APP_VERSION__: string;

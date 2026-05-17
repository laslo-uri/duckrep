import { createClient } from '@supabase/supabase-js';

// Real values must be set at build time (Vite): .env locally, Vercel Project → Settings → Environment Variables.
// Placeholders avoid a hard crash when vars are missing (e.g. first deploy); API calls will fail until you set real values and redeploy.
const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder';

const missingRealConfig =
  !import.meta.env.VITE_SUPABASE_URL?.trim() ||
  !import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

if (import.meta.env.DEV && missingRealConfig) {
  console.warn(
    'Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — copy .env.example to .env and fill them in.',
  );
} else if (!import.meta.env.DEV && missingRealConfig) {
  console.error(
    'Production build has no Supabase env vars. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY on your host (e.g. Vercel) and redeploy.',
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/** True when Vite env vars are set at build time (real project, not placeholders). */
export const isSupabaseConfigured = Boolean(
  import.meta.env.VITE_SUPABASE_URL?.trim() && import.meta.env.VITE_SUPABASE_ANON_KEY?.trim(),
);

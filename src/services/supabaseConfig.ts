// ─────────────────────────────────────────────────────────────────────────────
// Supabase / Google configuration
//
// Fill these with your own project values. You can hard-code them here, OR paste
// them at runtime from Settings → Collaboration (handy for demos without a
// rebuild). Runtime values, when present, take precedence over these.
//
// Where to find them:
//   • SUPABASE_URL / SUPABASE_ANON_KEY  → Supabase dashboard → Project Settings → API
//   • GOOGLE_WEB_CLIENT_ID              → Google Cloud console → Credentials →
//                                         OAuth 2.0 "Web application" client ID.
//                                         This is the same client ID you paste into
//                                         Supabase → Authentication → Providers → Google.
//   • GOOGLE_IOS_CLIENT_ID              → Google Cloud console → OAuth "iOS" client ID
//                                         (only needed for native iOS Google sign-in).
//
// Leaving these as the YOUR_… placeholders keeps the app fully offline: local
// accounts still work and live sharing simply shows a "connect Supabase" prompt.
// ─────────────────────────────────────────────────────────────────────────────

export const SUPABASE_URL = 'YOUR_SUPABASE_URL';
export const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

export const GOOGLE_WEB_CLIENT_ID = 'YOUR_GOOGLE_WEB_CLIENT_ID';
export const GOOGLE_IOS_CLIENT_ID = 'YOUR_GOOGLE_IOS_CLIENT_ID';

export function isPlaceholder(value: string | null | undefined): boolean {
  return !value || value.trim().length === 0 || value.includes('YOUR_');
}

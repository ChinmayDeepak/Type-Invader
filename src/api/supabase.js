import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

export const setupError = !url || !key
  ? "Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY, then rebuild the app. Follow DEPLOY-FREE.md."
  : !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url) || !key.startsWith("sb_publishable_")
  ? "Use your Supabase project URL and publishable key (sb_publishable_…). See DEPLOY-FREE.md."
  : "";

// No database password or service-role/secret key belongs in this application.
export const supabase = setupError ? null : createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
export function requireSupabase() {
  if (!supabase) throw new Error(setupError);
  return supabase;
}

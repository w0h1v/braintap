import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** True when Supabase env is configured (accounts/cloud sync available). */
export const isSupabaseConfigured = Boolean(url && anon);

let cached: SupabaseClient | null = null;

/**
 * Browser Supabase client, or null when not configured. Callers must handle
 * the null case (the app works fully offline with localStorage).
 */
export function getSupabaseBrowser(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (cached) return cached;
  cached = createBrowserClient(url!, anon!);
  return cached;
}

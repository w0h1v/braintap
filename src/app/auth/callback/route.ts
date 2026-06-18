import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";

/**
 * OAuth / email-confirmation callback. Exchanges the `?code=` for a session,
 * sets the cookie, then redirects home. If Supabase isn't configured (or no
 * code is present) we just redirect home.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const home = new URL("/", url.origin);

  const supabase = getSupabaseServer();
  if (supabase && code) {
    try {
      await supabase.auth.exchangeCodeForSession(code);
    } catch {
      // ignore — fall through to home redirect
    }
  }

  return NextResponse.redirect(home);
}

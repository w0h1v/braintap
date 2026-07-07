// delete-account — permanently deletes the calling user's auth account.
//
// App Store Guideline 5.1.1(v): apps that support account creation must let
// users delete the account in-app. Clients cannot call `auth.admin.deleteUser`
// themselves, so this function does it with the service-role key after
// verifying the caller's own JWT. Deleting the `auth.users` row cascades to
// `profiles` and `game_results` (see supabase/migrations/0001_init.sql).
//
// Deploy: supabase functions deploy delete-account
// Invoke: supabase.functions.invoke("delete-account", { method: "POST" })
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) {
    return json(401, { error: "Missing authorization" });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  // Resolve the caller from their own access token — a user can only ever
  // delete themselves. (The anon/service keys are not user tokens and fail here.)
  const { data, error: userError } = await admin.auth.getUser(token);
  if (userError || !data.user) {
    return json(401, { error: "Invalid or expired session" });
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(data.user.id);
  if (deleteError) {
    console.error("delete-account failed", { userId: data.user.id, error: deleteError.message });
    return json(500, { error: "Deletion failed. Please try again." });
  }

  return json(200, { deleted: true });
});

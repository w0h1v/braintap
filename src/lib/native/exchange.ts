import type { SupabaseClient } from "@supabase/supabase-js";
import { SocialLogin } from "@capgo/capacitor-social-login";
import { initSocialLogin } from "./socialLogin";
import { getNonce } from "./nonce";

/**
 * Native Sign in with Apple → Supabase. NATIVE ONLY (dynamic-imported behind a
 * `Capacitor.isNativePlatform()` guard). The plugin returns an Apple identity
 * token bound to SHA-256(nonce); Supabase validates it against the raw nonce.
 */
export async function signInAppleNative(
  supabase: SupabaseClient,
): Promise<{ error?: string }> {
  await initSocialLogin();
  const { rawNonce, nonceDigest } = await getNonce();
  const res = await SocialLogin.login({
    provider: "apple",
    options: { scopes: ["email", "name"], nonce: nonceDigest },
  });
  if (res.provider !== "apple" || !res.result.idToken) {
    return { error: "Apple sign-in did not return an identity token." };
  }
  const { error } = await supabase.auth.signInWithIdToken({
    provider: "apple",
    token: res.result.idToken,
    nonce: rawNonce,
  });
  return error ? { error: error.message } : {};
}

/** Native Google sign-in → Supabase (same nonce contract as Apple). */
export async function signInGoogleNative(
  supabase: SupabaseClient,
): Promise<{ error?: string }> {
  await initSocialLogin();
  const { rawNonce, nonceDigest } = await getNonce();
  const res = await SocialLogin.login({
    provider: "google",
    options: { scopes: ["email", "profile"], nonce: nonceDigest },
  });
  const idToken =
    res.provider === "google" && "idToken" in res.result ? res.result.idToken : null;
  if (!idToken) {
    return { error: "Google sign-in did not return an identity token." };
  }
  const { error } = await supabase.auth.signInWithIdToken({
    provider: "google",
    token: idToken,
    nonce: rawNonce,
  });
  return error ? { error: error.message } : {};
}

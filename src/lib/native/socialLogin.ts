import { SocialLogin } from "@capgo/capacitor-social-login";

/**
 * One-time init of the native social-login SDK. NATIVE ONLY — callers must guard
 * with `Capacitor.isNativePlatform()` and dynamic-import this module so the
 * plugin never loads in the web bundle.
 *
 * Google needs the OAuth client ids (set in env, supplied at build); Apple needs
 * no config on native iOS (the system handles `ASAuthorizationController`).
 */
let initialized = false;

export async function initSocialLogin(): Promise<void> {
  if (initialized) return;
  await SocialLogin.initialize({
    google: {
      iOSClientId: process.env.NEXT_PUBLIC_GOOGLE_IOS_CLIENT_ID,
      webClientId: process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID,
      mode: "online",
    },
    apple: {},
  });
  initialized = true;
}

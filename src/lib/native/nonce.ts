/**
 * Cryptographic nonce for native id-token sign-in (Apple / Google).
 *
 * The provider receives the SHA-256 *digest* of the nonce (embedded in the
 * returned identity token); Supabase receives the *raw* nonce and re-hashes it
 * to validate the token. Passing the wrong one to either side fails validation.
 */
export async function getNonce(): Promise<{ rawNonce: string; nonceDigest: string }> {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const rawNonce = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  const hashBuf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawNonce));
  const nonceDigest = Array.from(new Uint8Array(hashBuf), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
  return { rawNonce, nonceDigest };
}

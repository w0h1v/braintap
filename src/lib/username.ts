/**
 * Display-name validation (App Store Guideline 1.2 — user-generated content).
 *
 * Usernames are shown publicly on leaderboards, so they must pass a charset
 * rule and a profanity screen. The SAME rules are enforced server-side by
 * `public.is_username_allowed` (supabase/migrations/0005_ugc_compliance.sql) —
 * this module only exists to give instant feedback at signup. Keep the two
 * blocklists in sync when editing.
 */

export const USERNAME_MIN = 2;
export const USERNAME_MAX = 20;

/** Letters/digits at the ends; letters, digits, `. _ -` and spaces inside. */
const USERNAME_RE = /^[A-Za-z0-9][A-Za-z0-9._ -]*[A-Za-z0-9]$/;

/**
 * Slurs and strong profanity that are near-always intentional even embedded in
 * a longer name. Matched as substrings of the normalized (lowercased,
 * de-leeted, letters-only) form. Deliberately short: catching sneaky spellings
 * beats cataloguing every mild word, and reports cover the rest.
 */
const BLOCKED = [
  "fuck",
  "shit",
  "cunt",
  "bitch",
  "whore",
  "slut",
  "faggot",
  "nigg",
  "kike",
  "wetback",
  "beaner",
  "retard",
  "rapist",
  "pedo",
  "hitler",
  "nazi",
  "porn",
  "penis",
  "vagina",
  "dildo",
  "blowjob",
  "handjob",
  "jizz",
  "twat",
  "wank",
  "cocksuck",
  "molest",
];

/** Fold common leet substitutions, then strip to letters only. */
function normalize(name: string): string {
  const folded = name
    .toLowerCase()
    .replace(/[0134578@$!]/g, (ch) => "oieastbasi"["0134578@$!".indexOf(ch)]);
  return folded.replace(/[^a-z]/g, "");
}

export function containsBlockedWord(name: string): boolean {
  const normalized = normalize(name);
  return BLOCKED.some((word) => normalized.includes(word));
}

/**
 * Returns a user-facing error message, or null when the name is acceptable.
 * Callers should validate `name.trim()`.
 */
export function validateUsername(name: string): string | null {
  if (name.length < USERNAME_MIN) {
    return `Pick a display name with at least ${USERNAME_MIN} characters.`;
  }
  if (name.length > USERNAME_MAX) {
    return `Display names can be at most ${USERNAME_MAX} characters.`;
  }
  if (!USERNAME_RE.test(name)) {
    return "Display names can use letters, numbers, spaces, dots, dashes, and underscores.";
  }
  if (containsBlockedWord(name)) {
    return "That display name isn't allowed. Pick something else.";
  }
  return null;
}

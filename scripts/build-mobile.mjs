// Static-export build for the Capacitor (mobile) shell.
//
// `output: "export"` (set in next.config.mjs when BUILD_TARGET=mobile) can't
// include server-only features. The mobile app doesn't need any of them — it
// uses native auth (deep link) instead of the web OAuth callback, ships no
// link-preview OG/Twitter images, and needs no edge middleware. So we
// TEMPORARILY move those files out of the tree, run the export, then restore
// them. The web build (`npm run build`) is never affected — it keeps all of
// these. See docs/mobile-runbook.md.
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";

const ROOT = process.cwd();
const STASH = join(ROOT, ".export-excluded");

const EXCLUDE = [
  "src/middleware.ts",
  "src/app/auth/callback",
  "src/app/opengraph-image.tsx",
  "src/app/twitter-image.tsx",
  "src/app/play/[game]/opengraph-image.tsx",
  "src/app/play/[game]/twitter-image.tsx",
];

const moved = [];

function stash() {
  for (const rel of EXCLUDE) {
    const from = join(ROOT, rel);
    if (!existsSync(from)) continue;
    const to = join(STASH, rel);
    mkdirSync(dirname(to), { recursive: true });
    renameSync(from, to);
    moved.push([from, to]);
  }
}

function restore() {
  for (const [from, to] of moved) {
    mkdirSync(dirname(from), { recursive: true });
    renameSync(to, from);
  }
  if (existsSync(STASH)) rmSync(STASH, { recursive: true, force: true });
}

try {
  stash();
  console.log(`[build:mobile] excluded ${moved.length} web-only path(s) for static export`);
  execSync("next build", {
    stdio: "inherit",
    env: { ...process.env, BUILD_TARGET: "mobile" },
  });
} finally {
  restore();
  console.log("[build:mobile] restored excluded paths");
}

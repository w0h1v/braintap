"use client";

import Link from "next/link";
import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useEntitlement } from "@/lib/entitlement";
import { getMonetizationConfig } from "@/lib/config";

/**
 * BrainTap Premium paywall (MON-3). Purchase/restore go through `useEntitlement`,
 * whose web build is inert (returns false) — so on the website this renders the
 * offer but the buy/restore actions report "available in the app". A native
 * (RevenueCat) build makes `purchase()`/`restore()` real; those two calls are
 * the only seams to fill (see docs/mobile-runbook.md). The archive gate that
 * opens this only engages on native (billingAvailable), so the web is unchanged.
 */
export function Paywall({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { isPremium, billingAvailable, purchase, restore } = useEntitlement();
  const [busy, setBusy] = useState<null | "buy" | "restore">(null);
  const [msg, setMsg] = useState<string | null>(null);
  const archiveIncluded = getMonetizationConfig().premiumUnlocksArchive;

  const doBuy = async () => {
    setBusy("buy");
    setMsg(null);
    const ok = await purchase();
    setBusy(null);
    if (ok) onClose();
    else setMsg(billingAvailable ? "Purchase didn't complete — try again." : "Premium unlocks in the BrainTap iOS / Android app.");
  };

  const doRestore = async () => {
    setBusy("restore");
    setMsg(null);
    const ok = await restore();
    setBusy(null);
    setMsg(
      ok
        ? "Purchases restored."
        : billingAvailable
          ? "No previous purchase found."
          : "Restore is available in the app.",
    );
  };

  const benefits = [
    "No ads — no interstitials, and hints never need a video",
    ...(archiveIncluded ? ["The full puzzle archive, unlocked"] : []),
    "Support a tiny indie brain-games studio",
  ];

  return (
    <Modal open={open} onClose={onClose} labelledBy="paywall-title" className="text-center">
      <div className="font-mono text-[11px] tracking-[0.2em] text-amber">BRAINTAP PREMIUM</div>
      <h2 id="paywall-title" className="mt-2 font-display text-3xl font-semibold text-ink">
        {isPremium ? "You're Premium ✨" : "Play ad-free"}
      </h2>

      {isPremium ? (
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          Thanks for supporting BrainTap — every feature is unlocked.
        </p>
      ) : (
        <ul className="mx-auto mt-5 flex max-w-[320px] flex-col gap-2.5 text-left">
          {benefits.map((b) => (
            <li key={b} className="flex items-start gap-2.5 text-sm leading-snug text-[rgba(226,234,255,0.86)]">
              <span aria-hidden className="mt-0.5 text-mint">✓</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      )}

      {!isPremium && (
        <button
          type="button"
          onClick={doBuy}
          disabled={busy !== null}
          className="mt-6 w-full rounded-xl py-3.5 font-display text-[15px] font-semibold text-[#04060f] disabled:opacity-60"
          style={{ backgroundImage: "linear-gradient(118deg, #00e5ff, #ff2bd6)" }}
        >
          {busy === "buy" ? "Opening…" : "Go Premium"}
        </button>
      )}

      <button
        type="button"
        onClick={doRestore}
        disabled={busy !== null}
        className="mt-2.5 w-full rounded-xl border border-line-strong bg-white/[0.04] py-3 font-display text-sm text-[#eaf1ff] disabled:opacity-60"
      >
        {busy === "restore" ? "Restoring…" : "Restore purchases"}
      </button>

      {msg && (
        <p className="mt-3 font-mono text-[11px] text-ink-mute" role="status" aria-live="polite">
          {msg}
        </p>
      )}

      {!billingAvailable && !isPremium && (
        <p className="mt-3 font-mono text-[10.5px] tracking-[0.06em] text-ink-faint">
          Purchasing opens in the iOS / Android app.
        </p>
      )}

      <div className="mt-4 font-mono text-[10.5px] text-ink-mute">
        <Link href="/terms" className="hover:text-ink">Terms</Link>
        {" · "}
        <Link href="/privacy" className="hover:text-ink">Privacy</Link>
      </div>

      <button
        type="button"
        onClick={onClose}
        className="mt-3 block w-full font-mono text-xs text-ink-mute hover:text-ink"
      >
        {isPremium ? "Done" : "Maybe later"}
      </button>
    </Modal>
  );
}

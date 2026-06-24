"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Modal } from "@/components/ui/Modal";
import type { Accent, Difficulty } from "@/lib/types";
import { shareText as doShare } from "@/lib/share";
import { Confetti } from "@/components/play/Confetti";
import { shareResultImage } from "@/lib/shareImage";
import { useTierNav } from "@/components/play/DifficultyContext";
import { DIFFICULTY_META } from "@/lib/difficulty";
import { rankForScore } from "@/lib/rank";
import { maybeInterstitial } from "@/lib/ads";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";

/**
 * Fold the active tier into a share string by tagging the leading
 * `BrainTap · <Game>` header line (e.g. `… · Medium`). No-op when there is no
 * tier or the text doesn't use the standard header, so it stays safe for every
 * game's format.
 */
function withTier(text: string | undefined, tier: Difficulty | undefined): string | undefined {
  if (!text || !tier) return text;
  const label = DIFFICULTY_META[tier].label;
  const nl = text.indexOf("\n");
  const head = nl === -1 ? text : text.slice(0, nl);
  if (!head.startsWith("BrainTap · ") || head.includes(` · ${label}`)) return text;
  const rest = nl === -1 ? "" : text.slice(nl);
  return `${head} · ${label}${rest}`;
}

/** Large coloured square emojis used by the games' share grids. */
const SQUARE = /[\u{1F7E5}-\u{1F7EB}⬛⬜]/u;

/**
 * Pull the emoji-grid lines out of a BrainTap share string so the result is
 * tangible in the modal (and the Share buttons obviously meaningful) without
 * revealing the answer. Used only when a game doesn't already render its own
 * grid via `extra`. The `!/[A-Za-z0-9]/` filter drops label rows (e.g. a share
 * header or "🟪 6×6 deduction"); requiring ≥2 grid lines avoids surfacing a
 * single-row score "bar" (sprint/mathsprint) as if it were a grid. Returns null
 * when the share has no real grid (e.g. word games).
 */
function extractGrid(text: string | undefined): string | null {
  if (!text) return null;
  const lines = text.split("\n").filter((l) => {
    const t = l.trim();
    return t.length > 0 && !/[A-Za-z0-9]/.test(t) && SQUARE.test(t);
  });
  return lines.length >= 2 ? lines.join("\n") : null;
}

export function CompletionModal({
  open,
  onClose,
  accent,
  eyebrow = "PUZZLE COMPLETE",
  title,
  statValue,
  statLabel,
  insight,
  share,
  extra,
  won = true,
  onReplay,
  replayLabel = "Play again",
}: {
  open: boolean;
  onClose: () => void;
  accent: Accent;
  eyebrow?: string;
  title: string;
  statValue?: string;
  statLabel?: string;
  insight?: string;
  share?: string;
  extra?: ReactNode;
  won?: boolean;
  /** When provided, renders a "Play again" action that replays the same tier. */
  onReplay?: () => void;
  replayLabel?: string;
}) {
  const [shareLabel, setShareLabel] = useState("Share result");
  const [imageLabel, setImageLabel] = useState("Share image");
  const toast = useToast();
  const nav = useTierNav();
  const tier = nav?.difficulty;
  // Performance rank revealed on a win, from the normalised score (VIS-3).
  const rank = won && nav?.lastScore != null ? rankForScore(nav.lastScore) : null;
  const tierShare = withTier(share, tier);
  // Spoiler-free emoji grid, shown only on a WIN and only when the game didn't
  // supply its own result content via `extra` (avoids duplicating
  // brainle/connections grids and never shows a "positive" bar under a loss).
  const gridPreview = won && !extra ? extractGrid(tierShare) : null;
  // Offer the next tier from inside the modal on a win — it's where attention is.
  const showProgress = won && Boolean(tier);

  return (
    <>
    <Confetti active={open && won} accent={accent} />
    <Modal
      open={open}
      onClose={onClose}
      labelledBy="complete-title"
      className="text-center"
      showClose
      closeLabel="Close — review the board"
    >
      <div className="flex items-center justify-center gap-2">
        <span className="font-mono text-[11px] tracking-[0.2em]" style={{ color: accent.solid }}>
          {won ? eyebrow : "NICE TRY"}
        </span>
        {tier && (
          <span
            className="rounded-pill px-2 py-0.5 font-mono text-[9.5px] font-semibold uppercase tracking-[0.14em] text-[#04060f]"
            style={{ backgroundColor: DIFFICULTY_META[tier].color }}
          >
            {DIFFICULTY_META[tier].label}
          </span>
        )}
      </div>
      <h2 id="complete-title" className="mt-2 font-display text-3xl font-semibold text-ink">
        {title}
      </h2>

      {rank && (
        <div
          className="mt-3 flex items-center justify-center gap-2.5"
          aria-label={`Rank: ${rank.label}, tier ${rank.index + 1} of ${rank.total}`}
        >
          <span
            className="rounded-pill px-2.5 py-1 font-mono text-[11px] font-semibold tracking-[0.08em] text-[#04060f]"
            style={{ backgroundImage: `linear-gradient(118deg, ${accent.from}, ${accent.to})` }}
          >
            {rank.label.toUpperCase()}
          </span>
          <span className="flex items-center gap-1" aria-hidden>
            {Array.from({ length: rank.total }, (_, i) => (
              <span
                key={i}
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: i <= rank.index ? accent.solid : "rgba(255,255,255,0.18)" }}
              />
            ))}
          </span>
        </div>
      )}

      {statValue && (
        <>
          <div
            className="mt-5 font-display text-[44px] font-semibold tracking-[0.04em]"
            style={{ color: accent.solid }}
          >
            {statValue}
          </div>
          {statLabel && (
            <div className="font-mono text-[11px] tracking-[0.1em] text-ink-mute">
              {statLabel}
            </div>
          )}
        </>
      )}

      {extra ? (
        <div className="mt-4">{extra}</div>
      ) : gridPreview ? (
        <div className="mt-4 flex justify-center">
          <div className="rounded-2xl border border-line bg-white/[0.02] px-5 py-3 text-center">
            <pre className="font-mono text-[19px] leading-[1.15]" aria-hidden>
              {gridPreview}
            </pre>
            <div className="mt-1.5 font-mono text-[9px] tracking-[0.16em] text-ink-mute">
              SPOILER-FREE RESULT
            </div>
          </div>
        </div>
      ) : null}

      {insight && (
        <div
          className="mt-5 rounded-2xl border p-4 text-left"
          style={{ background: `${accent.solid}14`, borderColor: `${accent.solid}33` }}
        >
          <div className="font-mono text-[10px] tracking-[0.16em]" style={{ color: accent.soft }}>
            🧠 BRAIN INSIGHT
          </div>
          <p className="mt-2 text-sm leading-relaxed text-[rgba(226,234,255,0.82)]">{insight}</p>
        </div>
      )}

      {showProgress &&
        (nav!.next ? (
          <button
            type="button"
            onClick={() => {
              nav!.goNext();
              onClose();
            }}
            className="mt-5 w-full rounded-xl py-3.5 font-display text-[15px] font-semibold text-[#04060f]"
            style={{ backgroundColor: DIFFICULTY_META[nav!.next].color }}
          >
            Next up: {DIFFICULTY_META[nav!.next].label} →
          </button>
        ) : (
          <div className="mt-5 rounded-xl border border-amber/30 bg-amber/[0.06] py-3 font-mono text-[11px] tracking-[0.14em] text-amber-soft">
            ALL TIERS CLEARED 🎉
          </div>
        ))}

      {share && (
        <button
          type="button"
          onClick={async () => {
            const r = await doShare(tierShare!);
            setShareLabel(r === "copied" ? "Copied!" : r === "shared" ? "Shared!" : "Try again");
            setTimeout(() => setShareLabel("Share result"), 1800);
            // Skip a toast on "failed": that path includes a deliberate cancel
            // of the native share sheet, where an error would only annoy.
            if (r === "copied") toast.show("Result copied to clipboard");
            else if (r === "shared") toast.show("Shared!");
          }}
          className={cn(
            "w-full rounded-xl py-3.5 font-display text-[15px] font-semibold text-[#04060f]",
            showProgress ? "mt-2.5" : "mt-5",
          )}
          style={{ backgroundImage: `linear-gradient(118deg, ${accent.from}, ${accent.to})` }}
        >
          {shareLabel}
        </button>
      )}

      <button
        type="button"
        onClick={async () => {
          const r = await shareResultImage({
            gameName: tier ? `${eyebrow} · ${DIFFICULTY_META[tier].label}` : eyebrow,
            title,
            statValue,
            statLabel,
            accent,
            shareText: tierShare,
          });
          setImageLabel(r === "shared" ? "Shared!" : r === "downloaded" ? "Saved!" : "Try again");
          setTimeout(() => setImageLabel("Share image"), 1800);
          if (r === "shared") toast.show("Image shared");
          else if (r === "downloaded") toast.show("Image saved to your device");
          else toast.show("Couldn't create image", { variant: "error" });
        }}
        className="mt-2.5 w-full rounded-xl border py-3 font-display text-sm font-semibold"
        style={{
          borderColor: `${accent.solid}55`,
          background: `${accent.solid}14`,
          color: accent.soft,
        }}
      >
        {imageLabel}
      </button>

      {onReplay && (
        <button
          type="button"
          onClick={onReplay}
          className="mt-2.5 w-full rounded-xl border border-line-strong bg-white/[0.04] py-3 font-display text-sm font-semibold text-[#eaf1ff]"
        >
          ↻ {replayLabel}
        </button>
      )}

      <Link
        href="/"
        onClick={() => void maybeInterstitial("return-home")}
        className="mt-2.5 block w-full rounded-xl border border-line-strong bg-white/[0.04] py-3 font-display text-sm text-[#eaf1ff]"
      >
        Back to today
      </Link>
    </Modal>
    </>
  );
}

import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { GameId } from "@/lib/types";
import { GAME_ORDER, GAME_METAS } from "@/games/_meta";
import { PlaySkeleton } from "@/components/play/PlaySkeleton";
import { PlayClient } from "./PlayClient";

const VALID = new Set<string>(GAME_ORDER);

// Only the 15 known games are valid routes; anything else is a real 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return GAME_ORDER.map((game) => ({ game }));
}

export function generateMetadata({ params }: { params: { game: string } }) {
  const meta = VALID.has(params.game) ? GAME_METAS[params.game as GameId] : null;
  return {
    title: meta ? `${meta.name} — BrainTap Games` : "BrainTap Games",
    description: meta?.tagline,
  };
}

export default function PlayPage({ params }: { params: { game: string } }) {
  if (!VALID.has(params.game)) notFound();
  // The archive ?date= param is read CLIENT-side (PlayClient) so this route is
  // static-export compatible (output: "export" forbids server-side searchParams).
  // The Suspense boundary is required for useSearchParams in a prerendered page;
  // the skeleton fallback fills the client-side bailout so there's no blank flash.
  return (
    <Suspense fallback={<PlaySkeleton />}>
      <PlayClient game={params.game as GameId} />
    </Suspense>
  );
}

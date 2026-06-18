import { notFound } from "next/navigation";
import type { GameId } from "@/lib/types";
import { GAME_ORDER, GAME_METAS } from "@/games/_meta";
import { GameHost } from "@/components/play/GameHost";

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

export default function PlayPage({
  params,
  searchParams,
}: {
  params: { game: string };
  searchParams: { date?: string };
}) {
  if (!VALID.has(params.game)) notFound();
  return <GameHost gameId={params.game as GameId} dateParam={searchParams.date} />;
}

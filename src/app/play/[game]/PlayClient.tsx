"use client";

import { useSearchParams } from "next/navigation";
import type { GameId } from "@/lib/types";
import { GameHost } from "@/components/play/GameHost";

/**
 * Reads the archive `?date=` param CLIENT-side so `/play/[game]` stays
 * static-export compatible (output: "export" forbids server-side searchParams).
 * Keying GameHost by game+date here preserves the remount-on-date-change the
 * server `key` used to do (archive browsing resets tier selection + timer).
 */
export function PlayClient({ game }: { game: GameId }) {
  const date = useSearchParams().get("date") ?? undefined;
  return <GameHost key={`${game}:${date ?? "today"}`} gameId={game} dateParam={date} />;
}

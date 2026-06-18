"use client";

import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { syncProgress } from "@/lib/sync";

/**
 * Render-null sync driver. Whenever auth resolves to a signed-in user, it
 * pushes local progress to Supabase and pulls remote results into the store.
 * No-op offline (Supabase not configured / no user).
 */
export function ProfileSync() {
  const { user, enabled } = useAuth();
  const userId = user?.id ?? null;

  useEffect(() => {
    if (!enabled || !userId) return;
    void syncProgress();
  }, [enabled, userId]);

  return null;
}

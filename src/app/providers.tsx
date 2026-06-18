"use client";

import { useEffect, type ReactNode } from "react";
import { AuthProvider } from "@/lib/auth";
import { useProgress } from "@/lib/progress";
import { ProfileSync } from "@/components/ProfileSync";
import { Onboarding } from "@/components/Onboarding";
import { CleanSweep } from "@/components/CleanSweep";

/** Applies the zen-mode data attribute to the root element. */
function ZenController() {
  const zen = useProgress((s) => s.settings.zen);
  useEffect(() => {
    const root = document.documentElement;
    if (zen) root.setAttribute("data-zen", "");
    else root.removeAttribute("data-zen");
  }, [zen]);
  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ZenController />
      <ProfileSync />
      {children}
      <Onboarding />
      <CleanSweep />
    </AuthProvider>
  );
}

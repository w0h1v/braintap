"use client";

import { useEffect, type ReactNode } from "react";
import { AuthProvider } from "@/lib/auth";
import { useProgress } from "@/lib/progress";
import { ProfileSync } from "@/components/ProfileSync";
import { Onboarding } from "@/components/Onboarding";
import { CleanSweep } from "@/components/CleanSweep";
import { ToastProvider } from "@/components/ui/Toast";
import { EntitlementProvider } from "@/lib/entitlement";

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
      <EntitlementProvider>
        <ToastProvider>
          <ZenController />
          <ProfileSync />
          {children}
          <Onboarding />
          <CleanSweep />
        </ToastProvider>
      </EntitlementProvider>
    </AuthProvider>
  );
}

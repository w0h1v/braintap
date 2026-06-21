"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

/**
 * Premium entitlement (MON-3). On the WEB build there is no native billing, so
 * this is always the inert value below: `billingAvailable` is false, `isPremium`
 * is false, and purchase/restore are no-ops. The website therefore behaves
 * exactly as before — no paywalls, no gates engage: each gate checks
 * `adsAvailable()` (rewarded / interstitial) or `billingAvailable` (premium /
 * archive) before doing anything.
 *
 * A native (Capacitor) build swaps in a RevenueCat-backed provider that
 * populates these from StoreKit / Play Billing — see docs/mobile-runbook.md.
 */
export interface Entitlement {
  /** True when the `premium` entitlement is active. Always false on web. */
  isPremium: boolean;
  /** True while the entitlement is still resolving at launch. */
  loading: boolean;
  /** True only on a native build with billing wired in. Gates key off this. */
  billingAvailable: boolean;
  /** Start a purchase. Resolves true on success. No-op (false) on web. */
  purchase: () => Promise<boolean>;
  /** Restore prior purchases (required on both stores). No-op (false) on web. */
  restore: () => Promise<boolean>;
}

const WEB_ENTITLEMENT: Entitlement = {
  isPremium: false,
  loading: false,
  billingAvailable: false,
  purchase: async () => false,
  restore: async () => false,
};

const EntitlementContext = createContext<Entitlement>(WEB_ENTITLEMENT);

export function useEntitlement(): Entitlement {
  return useContext(EntitlementContext);
}

export function EntitlementProvider({ children }: { children: ReactNode }) {
  // Web: always inert. The native build replaces this body with a RevenueCat
  // integration (configure SDK, read CustomerInfo, expose purchase/restore).
  const value = useMemo(() => WEB_ENTITLEMENT, []);
  return <EntitlementContext.Provider value={value}>{children}</EntitlementContext.Provider>;
}

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Capacitor } from "@capacitor/core";
import {
  Purchases,
  LOG_LEVEL,
  type CustomerInfo,
  type PurchasesPackage,
} from "@revenuecat/purchases-capacitor";
import { useAuth } from "@/lib/auth";

/**
 * Premium entitlement (MON-3). On the WEB build this stays inert — every method
 * is guarded by `Capacitor.isNativePlatform()`, so the website behaves exactly
 * as before (`billingAvailable:false`, `isPremium:false`, no paywalls engage).
 * Inside a native Capacitor shell it talks to RevenueCat.
 *
 * RevenueCat project "Braintap" (proj32ced423): the entitlement the app checks
 * is `Braintap Pro`; `purchase()` buys the current offering's lifetime package
 * (`default` → `$rc_lifetime` → one-time `lifetime` product).
 */
export interface Entitlement {
  /** True when the `Braintap Pro` entitlement is active. Always false on web. */
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

/** The entitlement identifier configured in RevenueCat. */
const ENTITLEMENT_ID = "Braintap Pro";

/** Public, ship-safe SDK keys (per platform); set in env (NEXT_PUBLIC_ = bundled). */
const IOS_KEY = process.env.NEXT_PUBLIC_REVENUECAT_IOS_KEY ?? "";
const ANDROID_KEY = process.env.NEXT_PUBLIC_REVENUECAT_ANDROID_KEY ?? "";

const INERT: Entitlement = {
  isPremium: false,
  loading: false,
  billingAvailable: false,
  purchase: async () => false,
  restore: async () => false,
};

const EntitlementContext = createContext<Entitlement>(INERT);

export function useEntitlement(): Entitlement {
  return useContext(EntitlementContext);
}

function hasPremium(info: CustomerInfo): boolean {
  return typeof info.entitlements.active[ENTITLEMENT_ID] !== "undefined";
}

export function EntitlementProvider({ children }: { children: ReactNode }) {
  const native = Capacitor.isNativePlatform();
  const configured = Boolean(
    native && (Capacitor.getPlatform() === "ios" ? IOS_KEY : ANDROID_KEY),
  );
  const { user } = useAuth(); // Supabase user → RevenueCat app-user-id (cross-device)
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(configured);

  useEffect(() => {
    if (!native) return;
    const apiKey = Capacitor.getPlatform() === "ios" ? IOS_KEY : ANDROID_KEY;
    // No key configured for this platform → billing stays off. Never call
    // configure with an empty key: the Android SDK throws on a native plugin
    // thread and CRASHES the app (the JS catch below can't intercept it).
    if (!apiKey) {
      setLoading(false);
      return;
    }
    let alive = true;

    (async () => {
      try {
        await Purchases.setLogLevel({ level: LOG_LEVEL.WARN });
        await Purchases.configure({ apiKey, appUserID: user?.id ?? undefined });
        const { customerInfo } = await Purchases.getCustomerInfo();
        if (alive) setIsPremium(hasPremium(customerInfo));
      } catch (e) {
        console.warn("[entitlement] RevenueCat configure failed", e);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    // Live updates: renewals, restores on another device, sandbox changes.
    Purchases.addCustomerInfoUpdateListener((info) => {
      if (alive) setIsPremium(hasPremium(info));
    });

    return () => {
      alive = false;
    };
  }, [native, user?.id]);

  const purchase = useCallback(async (): Promise<boolean> => {
    if (!native) return false;
    try {
      const offerings = await Purchases.getOfferings();
      // One-time lifetime package; fall back to the first available package.
      const pkg: PurchasesPackage | undefined =
        offerings.current?.lifetime ?? offerings.current?.availablePackages?.[0];
      if (!pkg) return false;
      const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg });
      const ok = hasPremium(customerInfo);
      setIsPremium(ok);
      return ok;
    } catch (e) {
      // Backing out of the native sheet is not an error.
      if ((e as { userCancelled?: boolean })?.userCancelled) return false;
      console.warn("[entitlement] purchase failed", e);
      return false;
    }
  }, [native]);

  const restore = useCallback(async (): Promise<boolean> => {
    if (!native) return false;
    try {
      const { customerInfo } = await Purchases.restorePurchases();
      const ok = hasPremium(customerInfo);
      setIsPremium(ok);
      return ok;
    } catch (e) {
      console.warn("[entitlement] restore failed", e);
      return false;
    }
  }, [native]);

  // billingAvailable requires a platform SDK key: without one the store can't
  // sell (and the archive must stay free rather than gate behind a dead paywall).
  const value = useMemo<Entitlement>(
    () =>
      native
        ? { isPremium, loading, billingAvailable: configured, purchase, restore }
        : INERT,
    [native, configured, isPremium, loading, purchase, restore],
  );

  return (
    <EntitlementContext.Provider value={value}>{children}</EntitlementContext.Provider>
  );
}

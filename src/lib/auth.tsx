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
import type { User } from "@supabase/supabase-js";
import { Capacitor } from "@capacitor/core";
import { getSupabaseBrowser, isSupabaseConfigured } from "./supabase/client";

export interface AuthState {
  user: User | null;
  loading: boolean;
  /** Whether accounts are available at all (Supabase configured). */
  enabled: boolean;
  displayName: string;
  avatarLetter: string;
  signInWithPassword: (email: string, password: string) => Promise<{ error?: string }>;
  signUpWithPassword: (
    email: string,
    password: string,
    username?: string,
  ) => Promise<{ error?: string; needsConfirmation?: boolean }>;
  signInWithGoogle: () => Promise<{ error?: string }>;
  signInWithApple: () => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  /** Permanently deletes the signed-in user's account and synced data. */
  deleteAccount: () => Promise<{ error?: string }>;
}

const AuthContext = createContext<AuthState | null>(null);

function nameFromUser(user: User | null): string {
  if (!user) return "Guest";
  const meta = user.user_metadata ?? {};
  return (
    (meta.username as string) ||
    (meta.full_name as string) ||
    (meta.name as string) ||
    user.email?.split("@")[0] ||
    "Player"
  );
}

function siteUrl(): string {
  if (typeof window !== "undefined") return window.location.origin;
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = getSupabaseBrowser();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(isSupabaseConfigured);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (active) {
        setUser(data.user ?? null);
        setLoading(false);
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  const signInWithPassword = useCallback<AuthState["signInWithPassword"]>(
    async (email, password) => {
      if (!supabase) return { error: "Accounts are not configured." };
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return error ? { error: error.message } : {};
    },
    [supabase],
  );

  const signUpWithPassword = useCallback<AuthState["signUpWithPassword"]>(
    async (email, password, username) => {
      if (!supabase) return { error: "Accounts are not configured." };
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: username ? { username } : undefined,
          emailRedirectTo: `${siteUrl()}/auth/callback`,
        },
      });
      if (error) return { error: error.message };
      const needsConfirmation = !data.session;
      return { needsConfirmation };
    },
    [supabase],
  );

  const signInWithGoogle = useCallback<AuthState["signInWithGoogle"]>(async () => {
    if (!supabase) return { error: "Accounts are not configured." };
    // Native: the web OAuth redirect (and /auth/callback) don't exist in the
    // Capacitor build, so use the native id-token flow. Web: unchanged redirect.
    if (Capacitor.isNativePlatform()) {
      const { signInGoogleNative } = await import("./native/exchange");
      return signInGoogleNative(supabase);
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${siteUrl()}/auth/callback` },
    });
    return error ? { error: error.message } : {};
  }, [supabase]);

  const signInWithApple = useCallback<AuthState["signInWithApple"]>(async () => {
    if (!supabase) return { error: "Accounts are not configured." };
    if (Capacitor.isNativePlatform()) {
      const { signInAppleNative } = await import("./native/exchange");
      return signInAppleNative(supabase);
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "apple",
      options: { redirectTo: `${siteUrl()}/auth/callback` },
    });
    return error ? { error: error.message } : {};
  }, [supabase]);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
  }, [supabase]);

  const deleteAccount = useCallback<AuthState["deleteAccount"]>(async () => {
    if (!supabase) return { error: "Accounts are not configured." };
    // The edge function verifies the caller's JWT and deletes their auth user;
    // profiles + game_results cascade away in the database.
    const { error } = await supabase.functions.invoke("delete-account", { method: "POST" });
    if (error) {
      return { error: "Could not delete your account. Please try again in a moment." };
    }
    // The server-side user is gone; drop the now-orphaned local session.
    await supabase.auth.signOut();
    setUser(null);
    return {};
  }, [supabase]);

  const value = useMemo<AuthState>(() => {
    const displayName = nameFromUser(user);
    return {
      user,
      loading,
      enabled: isSupabaseConfigured,
      displayName,
      avatarLetter: displayName.charAt(0).toUpperCase() || "A",
      signInWithPassword,
      signUpWithPassword,
      signInWithGoogle,
      signInWithApple,
      signOut,
      deleteAccount,
    };
  }, [user, loading, signInWithPassword, signUpWithPassword, signInWithGoogle, signInWithApple, signOut, deleteAccount]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}

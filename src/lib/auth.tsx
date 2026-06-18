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
  signOut: () => Promise<void>;
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
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${siteUrl()}/auth/callback` },
    });
    return error ? { error: error.message } : {};
  }, [supabase]);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
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
      signOut,
    };
  }, [user, loading, signInWithPassword, signUpWithPassword, signInWithGoogle, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, GhostButton } from "@/components/ui/Button";
import { useAuth } from "@/lib/auth";
import {
  AppleMark,
  AuthShell,
  ContinueAsGuest,
  Divider,
  EMAIL_RE,
  ErrorBanner,
  Field,
  GoogleMark,
  GuestNotice,
} from "@/components/auth/AuthUI";

export default function LoginPage() {
  const router = useRouter();
  const { enabled, loading, signInWithPassword, signInWithGoogle, signInWithApple } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [appleBusy, setAppleBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!EMAIL_RE.test(email)) {
      setError("Enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setSubmitting(true);
    const { error: err } = await signInWithPassword(email, password);
    setSubmitting(false);
    if (err) {
      setError(err);
      return;
    }
    router.push("/");
    router.refresh();
  }

  async function onGoogle() {
    setError(null);
    setGoogleBusy(true);
    const { error: err } = await signInWithGoogle();
    if (err) {
      setError(err);
      setGoogleBusy(false);
    }
  }

  async function onApple() {
    setError(null);
    setAppleBusy(true);
    const { error: err } = await signInWithApple();
    if (err) {
      setError(err);
      setAppleBusy(false);
    }
  }

  return (
    <AuthShell
      eyebrow="WELCOME BACK"
      title="Sign in to BrainTap"
      subtitle="Pick up your streak right where you left off."
    >
      {!enabled ? (
        <GuestNotice />
      ) : (
        <>
          {error ? <ErrorBanner message={error} /> : null}

          <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
            <Field
              id="email"
              label="Email"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="you@example.com"
              autoComplete="email"
            />
            <Field
              id="password"
              label="Password"
              type="password"
              value={password}
              onChange={setPassword}
              placeholder="••••••••"
              autoComplete="current-password"
            />

            <Button type="submit" disabled={submitting || loading} className="mt-1 w-full">
              {submitting ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <Divider />

          <GhostButton type="button" onClick={onGoogle} disabled={googleBusy} className="w-full">
            <GoogleMark />
            {googleBusy ? "Redirecting…" : "Continue with Google"}
          </GhostButton>

          <GhostButton
            type="button"
            onClick={onApple}
            disabled={appleBusy}
            className="mt-3 w-full"
          >
            <AppleMark />
            {appleBusy ? "Signing in…" : "Continue with Apple"}
          </GhostButton>

          <p className="mt-6 text-center text-sm text-ink-mute">
            New to BrainTap?{" "}
            <Link href="/auth/signup" className="text-cyan hover:text-cyan-soft">
              Create an account
            </Link>
          </p>

          <ContinueAsGuest />
        </>
      )}
    </AuthShell>
  );
}

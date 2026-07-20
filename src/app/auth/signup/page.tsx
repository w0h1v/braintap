"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Logo } from "@/components/GameIcon";
import { Card } from "@/components/ui/Card";
import { Button, GhostButton } from "@/components/ui/Button";
import { useAuth } from "@/lib/auth";
import { validateUsername } from "@/lib/username";
import { cn } from "@/lib/cn";
import {
  AppleMark,
  Field,
  ErrorBanner,
  Divider,
  GoogleMark,
  GuestNotice,
  ContinueAsGuest,
} from "@/components/auth/AuthUI";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignupPage() {
  const router = useRouter();
  const { enabled, loading, signUpWithPassword, signInWithGoogle, signInWithApple } = useAuth();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [appleBusy, setAppleBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const usernameError = validateUsername(username.trim());
    if (usernameError) {
      setError(usernameError);
      return;
    }
    if (!EMAIL_RE.test(email)) {
      setError("Enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setSubmitting(true);
    const { error: err, needsConfirmation } = await signUpWithPassword(
      email,
      password,
      username.trim(),
    );
    setSubmitting(false);
    if (err) {
      setError(err);
      return;
    }
    if (needsConfirmation) {
      setConfirmation(true);
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
    <section className="mx-auto flex min-h-[calc(100vh-80px)] max-w-shell items-center justify-center px-6 pb-16 pt-28 sm:px-8">
      <div className="w-full max-w-[420px] animate-rise">
        <div className="mb-7 flex flex-col items-center text-center">
          <Link href="/" className="flex items-center gap-2.5">
            <Logo />
            <span className="font-mono text-[13px] font-semibold tracking-[0.2em] text-ink">
              BRAINTAP <span className="text-cyan">GAMES</span>
            </span>
          </Link>
          <div className="mt-6 font-mono text-[11px] tracking-[0.22em] text-cyan-soft">
            GET STARTED
          </div>
          <h1 className="mt-3 font-display text-[clamp(26px,4vw,34px)] font-semibold tracking-[-0.02em] text-ink">
            Create your account
          </h1>
          <p className="mt-2 text-sm text-ink-soft">
            Sync your streak across devices and climb the leaderboard.
          </p>
        </div>

        <Card className="p-7 sm:p-8">
          {!enabled ? (
            <GuestNotice />
          ) : confirmation ? (
            <ConfirmationNotice email={email} />
          ) : (
            <>
              {error ? <ErrorBanner message={error} /> : null}

              <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
                <Field
                  id="username"
                  label="Display name"
                  type="text"
                  value={username}
                  onChange={setUsername}
                  placeholder="brainiac"
                  autoComplete="nickname"
                />
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
                  autoComplete="new-password"
                  hint="At least 6 characters."
                />

                <Button type="submit" disabled={submitting || loading} className="mt-1 w-full">
                  {submitting ? "Creating account…" : "Create account"}
                </Button>
              </form>

              <Divider />

              <GhostButton
                type="button"
                onClick={onGoogle}
                disabled={googleBusy}
                className="w-full"
              >
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
                Already have an account?{" "}
                <Link href="/auth/login" className="text-cyan hover:text-cyan-soft">
                  Sign in
                </Link>
              </p>

              <ContinueAsGuest />
            </>
          )}
        </Card>
      </div>
    </section>
  );
}

function ConfirmationNotice({ email }: { email: string }) {
  return (
    <div className="flex flex-col items-center gap-4 py-2 text-center">
      <div
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-full",
          "border border-mint/40 bg-mint/[0.1] text-mint",
        )}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="m4 6 8 5 8-5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <rect
            x="3"
            y="5"
            width="18"
            height="14"
            rx="2.5"
            stroke="currentColor"
            strokeWidth="1.6"
          />
        </svg>
      </div>
      <div className="font-display text-lg font-semibold text-ink">Check your inbox</div>
      <p className="text-sm leading-relaxed text-ink-soft">
        We sent a confirmation link to{" "}
        <span className="font-mono text-ink">{email}</span>. Click it to activate your account,
        then come back and sign in.
      </p>
      <Link href="/auth/login" className="mt-2 w-full">
        <Button className="w-full">Back to sign in</Button>
      </Link>
    </div>
  );
}

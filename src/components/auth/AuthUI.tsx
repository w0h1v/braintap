"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/GameIcon";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AuthShell({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
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
            {eyebrow}
          </div>
          <h1 className="mt-3 font-display text-[clamp(26px,4vw,34px)] font-semibold tracking-[-0.02em] text-ink">
            {title}
          </h1>
          <p className="mt-2 text-sm text-ink-soft">{subtitle}</p>
        </div>

        <Card className="p-7 sm:p-8">{children}</Card>
      </div>
    </section>
  );
}

export function Field({
  id,
  label,
  type,
  value,
  onChange,
  placeholder,
  autoComplete,
  hint,
}: {
  id: string;
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  hint?: string;
}) {
  return (
    <label htmlFor={id} className="flex flex-col gap-1.5">
      <span className="font-mono text-[10.5px] tracking-[0.14em] text-ink-mute">
        {label.toUpperCase()}
      </span>
      <input
        id={id}
        name={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={cn(
          "w-full rounded-2xl border border-line-strong bg-white/[0.03] px-4 py-3",
          "font-display text-[15px] text-ink placeholder:text-ink-faint",
          "outline-none transition-colors duration-200",
          "focus:border-cyan/55 focus:bg-cyan/[0.04]",
        )}
      />
      {hint ? <span className="text-xs text-ink-faint">{hint}</span> : null}
    </label>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="mb-5 rounded-2xl border border-magenta/40 bg-magenta/[0.08] px-4 py-3 text-sm text-[#ffb3ec]"
    >
      {message}
    </div>
  );
}

export function Divider() {
  return (
    <div className="my-5 flex items-center gap-3 font-mono text-[10px] tracking-[0.18em] text-ink-faint">
      <span className="h-px flex-1 bg-line" />
      OR
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

export function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}

export function GuestNotice() {
  return (
    <div className="flex flex-col items-center gap-4 py-2 text-center">
      <div className="font-display text-lg font-semibold text-ink">
        Accounts aren&apos;t configured
      </div>
      <p className="text-sm leading-relaxed text-ink-soft">
        You can still play as a guest — your progress and streak save right here on this device.
      </p>
      <Link href="/" className="mt-2 w-full">
        <Button className="w-full">Play as guest →</Button>
      </Link>
    </div>
  );
}

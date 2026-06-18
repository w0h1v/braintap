"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import type { Accent } from "@/lib/types";

type BaseProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  accent?: Accent;
};

/** Primary, gradient, glowing CTA button (`.bt-primary`). */
export const Button = forwardRef<HTMLButtonElement, BaseProps>(function Button(
  { className, accent, style, children, ...rest },
  ref,
) {
  const gradient = accent
    ? { backgroundImage: `linear-gradient(118deg, ${accent.from}, ${accent.to})` }
    : undefined;
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 font-display text-sm font-semibold text-[#04060f]",
        "transition-[transform,box-shadow,filter] duration-200 active:translate-y-px",
        "hover:-translate-y-0.5 hover:shadow-btn hover:brightness-105 hover:saturate-[1.06]",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none",
        !accent && "bg-gradient-to-r from-cyan to-peri",
        className,
      )}
      style={{ ...gradient, ...style }}
      {...rest}
    >
      {children}
    </button>
  );
});

/** Outlined / subtle button (`.bt-ghost`). */
export const GhostButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(
  function GhostButton({ className, children, ...rest }, ref) {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-xl border border-line-strong bg-white/[0.03] px-5 py-3",
          "font-display text-sm font-medium text-ink-soft transition-colors duration-300",
          "hover:border-cyan/55 hover:bg-cyan/[0.06] hover:text-[#eaf6ff]",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...rest}
      >
        {children}
      </button>
    );
  },
);

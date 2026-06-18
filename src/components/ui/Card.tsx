import { type HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/** Glass surface card (`.bt-card`). */
export function Card({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-line bg-gradient-to-b from-[rgba(13,21,42,0.6)] to-[rgba(8,12,26,0.55)]",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

/** Small monospace pill / badge. */
export function Pill({
  className,
  children,
  color,
  ...rest
}: HTMLAttributes<HTMLSpanElement> & { color?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill border px-3 py-1 font-mono text-[10px] tracking-[0.12em]",
        className,
      )}
      style={
        color
          ? { color, borderColor: `${color}4d`, background: `${color}12` }
          : undefined
      }
      {...rest}
    >
      {children}
    </span>
  );
}

/** A labelled stat box used on the hub strip. */
export function StatBox({
  value,
  label,
  color,
  sub,
}: {
  value: string;
  label: string;
  color: string;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-gradient-to-b from-[rgba(15,23,46,0.55)] to-[rgba(8,12,26,0.5)] p-4 text-center sm:p-5">
      <div className="font-display text-2xl font-semibold sm:text-3xl" style={{ color }}>
        {value}
        {sub ? <span className="text-base text-ink-faint">{sub}</span> : null}
      </div>
      <div className="mt-1 font-mono text-[10px] tracking-[0.12em] text-ink-mute sm:text-[10.5px]">
        {label}
      </div>
    </div>
  );
}

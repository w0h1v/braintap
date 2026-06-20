"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/cn";

export type ToastVariant = "success" | "error" | "info";

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

export interface ToastApi {
  /** Show a transient confirmation. Auto-dismisses; tap to dismiss early. */
  show: (message: string, opts?: { variant?: ToastVariant; durationMs?: number }) => void;
}

/** No-op fallback so callers never crash when no provider is mounted (tests, etc.). */
const NOOP: ToastApi = { show: () => {} };
const ToastContext = createContext<ToastApi>(NOOP);

/** Access the app-wide toast surface (e.g. "Result copied to clipboard"). */
export function useToast(): ToastApi {
  return useContext(ToastContext);
}

const DEFAULT_MS = 2400;
const MAX_VISIBLE = 3;

/** Per-variant accent (mint / orange / cyan), drawn from the brand palette. */
const VARIANT_ACCENT: Record<ToastVariant, string> = {
  success: "#7CF5C4",
  error: "#ff9e3d",
  info: "#9fe9ff",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    setToasts((cur) => cur.filter((t) => t.id !== id));
    const tm = timers.current.get(id);
    if (tm) {
      clearTimeout(tm);
      timers.current.delete(id);
    }
  }, []);

  const show = useCallback<ToastApi["show"]>(
    (message, opts) => {
      const id = (idRef.current += 1);
      const item: ToastItem = { id, message, variant: opts?.variant ?? "success" };
      // Keep only the most recent few so a burst can't fill the screen.
      setToasts((cur) => [...cur, item].slice(-MAX_VISIBLE));
      const tm = setTimeout(() => dismiss(id), opts?.durationMs ?? DEFAULT_MS);
      timers.current.set(id, tm);
    },
    [dismiss],
  );

  // Clear any pending timers on unmount.
  useEffect(() => {
    const map = timers.current;
    return () => {
      for (const tm of map.values()) clearTimeout(tm);
      map.clear();
    };
  }, []);

  // Stable identity so consumers don't re-render when the toast list changes.
  const api = useMemo<ToastApi>(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-6 z-[200] flex flex-col items-center gap-2 px-4"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        role="status"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
  const accent = VARIANT_ACCENT[toast.variant];
  // Cards only mount client-side (after a show() call), so reading matchMedia
  // here is hydration-safe — the viewport is empty on the server render.
  const reduce =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  return (
    <button
      type="button"
      onClick={() => onDismiss(toast.id)}
      className={cn(
        "pointer-events-auto flex max-w-[440px] items-center gap-2.5 rounded-xl border border-line-strong px-4 py-2.5 text-left font-display text-[13.5px] text-ink",
        !reduce && "animate-rise",
      )}
      style={{
        background: "linear-gradient(180deg, rgba(16,24,48,0.97), rgba(8,12,26,0.97))",
        boxShadow: `0 12px 40px -12px rgba(0,0,0,0.7), inset 0 0 0 1px ${accent}26`,
        backdropFilter: "blur(8px)",
      }}
    >
      <span
        className="grid h-5 w-5 shrink-0 place-items-center rounded-full"
        style={{ background: `${accent}22` }}
        aria-hidden
      >
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: accent }} />
      </span>
      <span>{toast.message}</span>
    </button>
  );
}

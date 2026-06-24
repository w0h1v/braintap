"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
  "[contenteditable='true']",
].join(",");

export function Modal({
  open,
  onClose,
  children,
  labelledBy,
  className,
  showClose = false,
  closeLabel = "Close",
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  labelledBy?: string;
  className?: string;
  /** Render a visible ✕ in the top-right corner (in addition to backdrop/Esc). */
  showClose?: boolean;
  /** Accessible label / tooltip for the close button. */
  closeLabel?: string;
}) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    if (typeof document === "undefined") return;

    // Remember what had focus so we can restore it on close.
    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const getFocusable = (): HTMLElement[] => {
      const card = cardRef.current;
      if (!card) return [];
      return Array.from(
        card.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter(
        (el) =>
          el.offsetWidth > 0 ||
          el.offsetHeight > 0 ||
          el === document.activeElement,
      );
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;

      const card = cardRef.current;
      if (!card) return;

      const focusable = getFocusable();
      const active = document.activeElement as HTMLElement | null;

      // No focusable children: keep focus on the dialog itself.
      if (focusable.length === 0) {
        e.preventDefault();
        card.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (active === first || active === card || !card.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last || active === card || !card.contains(active)) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Move focus into the dialog: first focusable child, else the card.
    const initial = getFocusable()[0] ?? cardRef.current;
    initial?.focus();

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      // Restore focus to the element that opened the modal.
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  // Portal to <body> so the overlay always sits above page chrome (footer, nav)
  // regardless of any transformed/positioned ancestor stacking context. The
  // backdrop is the scroll container, so a card taller than the viewport scrolls
  // cleanly instead of overflowing onto the page behind it.
  return createPortal(
    <div
      className="fixed inset-0 z-[100] overflow-y-auto overscroll-contain"
      style={{ background: "rgba(2,3,9,0.7)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
      role="presentation"
    >
      <div className="flex min-h-full items-center justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div
          ref={cardRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={labelledBy}
          tabIndex={-1}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "relative w-full max-w-[420px] animate-pop rounded-3xl border p-7 outline-none sm:p-8",
            "border-cyan/20",
            className,
          )}
          style={{
            background:
              "linear-gradient(180deg, rgba(16,24,48,0.96), rgba(8,12,26,0.96))",
          }}
        >
          {showClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label={closeLabel}
              title={closeLabel}
              className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full text-lg leading-none text-ink-soft outline-none transition-colors hover:bg-white/10 hover:text-ink focus-visible:ring-2 focus-visible:ring-white/40"
            >
              ✕
            </button>
          )}
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}

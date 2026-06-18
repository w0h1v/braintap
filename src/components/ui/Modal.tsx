"use client";

import { useEffect, useRef, type ReactNode } from "react";
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
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  labelledBy?: string;
  className?: string;
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

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: "rgba(2,3,9,0.7)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "w-full max-w-[420px] animate-pop rounded-3xl border p-7 outline-none sm:p-8",
          "border-cyan/20",
          className,
        )}
        style={{
          background:
            "linear-gradient(180deg, rgba(16,24,48,0.96), rgba(8,12,26,0.96))",
        }}
      >
        {children}
      </div>
    </div>
  );
}

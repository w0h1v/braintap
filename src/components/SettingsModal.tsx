"use client";

import { Modal } from "./ui/Modal";
import { useProgress } from "@/lib/progress";
import { todayISO } from "@/lib/daily";
import { cn } from "@/lib/cn";

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full border transition-colors",
        checked ? "border-cyan/50 bg-cyan/30" : "border-line-strong bg-white/5",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-4 w-4 rounded-full bg-ink transition-transform",
          checked ? "translate-x-[22px]" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

export function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const settings = useProgress((s) => s.settings);
  const setSetting = useProgress((s) => s.setSetting);
  const resetDay = useProgress((s) => s.resetDay);

  return (
    <Modal open={open} onClose={onClose} labelledBy="settings-title">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-mono text-[11px] tracking-[0.2em] text-cyan-soft">
            BRAINTAP GAMES
          </div>
          <h2 id="settings-title" className="mt-1 font-display text-xl font-semibold text-ink">
            Settings
          </h2>
        </div>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-line-strong text-ink-soft"
        >
          ✕
        </button>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-ink-soft">
        Fifteen science-backed brain games, refreshed daily. Train memory, logic, language,
        numbers and focus — and build a streak.
      </p>
      <p className="mt-3 text-sm text-amber">
        🔥 Solve at least one game a day to grow your streak.
      </p>

      <div className="mt-6 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="font-display text-sm font-medium text-ink">Zen mode</div>
            <div className="text-xs text-ink-mute">Reduce motion and ambient effects</div>
          </div>
          <Toggle
            checked={settings.zen}
            onChange={(v) => setSetting("zen", v)}
            label="Zen mode"
          />
        </div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="font-display text-sm font-medium text-ink">Sound effects</div>
            <div className="text-xs text-ink-mute">Audio feedback during gameplay</div>
          </div>
          <Toggle
            checked={settings.sound}
            onChange={(v) => setSetting("sound", v)}
            label="Sound effects"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={() => {
          resetDay(todayISO());
          onClose();
        }}
        className="mt-6 w-full rounded-xl border border-magenta/30 bg-magenta/[0.08] py-2.5 font-display text-sm text-magenta-soft transition-colors hover:bg-magenta/[0.14]"
      >
        Reset today&apos;s progress
      </button>
    </Modal>
  );
}

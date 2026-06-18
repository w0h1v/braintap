import Link from "next/link";
import { Logo } from "./GameIcon";

export function Footer() {
  return (
    <footer className="relative z-[2] mt-16 border-t border-white/[0.06] px-6 pb-10 pt-12">
      <div className="mx-auto flex max-w-shell flex-col items-center justify-between gap-6 sm:flex-row">
        <div className="flex items-center gap-2.5">
          <Logo size={18} />
          <span className="font-mono text-xs font-semibold tracking-[0.2em] text-ink-soft">
            BRAINTAP GAMES
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-5 font-mono text-xs text-ink-mute">
          <Link href="/how-to-play" className="transition-colors hover:text-cyan-soft">
            How to play
          </Link>
          <Link href="/science" className="transition-colors hover:text-cyan-soft">
            The science
          </Link>
          <Link href="/privacy" className="transition-colors hover:text-cyan-soft">
            Privacy
          </Link>
          <Link href="/terms" className="transition-colors hover:text-cyan-soft">
            Terms
          </Link>
        </div>
        <div className="font-mono text-xs text-ink-mute">© 2026 BrainTap Labs</div>
      </div>
    </footer>
  );
}

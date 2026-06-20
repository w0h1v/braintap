import type { Accent } from "@/lib/types";

/** How the image was delivered, so callers can confirm accurately. */
export type ShareImageOutcome = "shared" | "downloaded" | "failed";

const SIZE = 1080;

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/**
 * Render a branded square result card to a PNG and share/download it.
 * Designed to never throw — failures are swallowed (best-effort sharing).
 */
export async function shareResultImage(opts: {
  gameName: string;
  title: string;
  statValue?: string;
  statLabel?: string;
  accent: Accent;
  shareText?: string;
}): Promise<ShareImageOutcome> {
  try {
    if (typeof document === "undefined") return "failed";

    const canvas = document.createElement("canvas");
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "failed";

    const { accent } = opts;

    // Background
    ctx.fillStyle = "#03040b";
    ctx.fillRect(0, 0, SIZE, SIZE);

    // Soft accent radial glow top-left → magenta-ish bottom-right
    const glow = ctx.createRadialGradient(
      SIZE * 0.28,
      SIZE * 0.22,
      40,
      SIZE * 0.28,
      SIZE * 0.22,
      SIZE * 0.95,
    );
    glow.addColorStop(0, hexA(accent.from, 0.32));
    glow.addColorStop(1, "rgba(3,4,11,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, SIZE, SIZE);

    const glow2 = ctx.createRadialGradient(
      SIZE * 0.82,
      SIZE * 0.86,
      40,
      SIZE * 0.82,
      SIZE * 0.86,
      SIZE * 0.8,
    );
    glow2.addColorStop(0, hexA(accent.to, 0.24));
    glow2.addColorStop(1, "rgba(3,4,11,0)");
    ctx.fillStyle = glow2;
    ctx.fillRect(0, 0, SIZE, SIZE);

    // Inner card frame
    const pad = 70;
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 2;
    roundRect(ctx, pad, pad, SIZE - pad * 2, SIZE - pad * 2, 44);
    ctx.stroke();

    const cx = SIZE / 2;

    // Wordmark dot + BRAINTAP
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";

    const wm = "BRAINTAP";
    ctx.font = "700 46px 'Space Grotesk', system-ui, sans-serif";
    const wmWidth = ctx.measureText(wm).width;
    const dotR = 13;
    const gap = 26;
    const totalW = dotR * 2 + gap + wmWidth;
    const wmStartX = cx - totalW / 2;

    const grad = ctx.createLinearGradient(wmStartX, 0, wmStartX + totalW, 0);
    grad.addColorStop(0, accent.from);
    grad.addColorStop(1, accent.to);

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(wmStartX + dotR, 196, dotR, 0, Math.PI * 2);
    ctx.fill();

    ctx.textAlign = "left";
    ctx.fillStyle = "#f3f7ff";
    ctx.fillText(wm, wmStartX + dotR * 2 + gap, 211);
    ctx.textAlign = "center";

    // Game name (eyebrow)
    ctx.font = "600 30px 'JetBrains Mono', ui-monospace, monospace";
    ctx.fillStyle = accent.solid;
    drawTracked(ctx, opts.gameName.toUpperCase(), cx, 320, 6);

    // Title
    ctx.font = "600 64px 'Space Grotesk', system-ui, sans-serif";
    ctx.fillStyle = "#f3f7ff";
    wrapText(ctx, opts.title, cx, 420, SIZE - pad * 2 - 80, 74);

    // Big stat
    if (opts.statValue) {
      ctx.font = "700 168px 'Space Grotesk', system-ui, sans-serif";
      const statGrad = ctx.createLinearGradient(0, 540, 0, 720);
      statGrad.addColorStop(0, accent.from);
      statGrad.addColorStop(1, accent.to);
      ctx.fillStyle = statGrad;
      ctx.fillText(opts.statValue, cx, 700);

      if (opts.statLabel) {
        ctx.font = "500 28px 'JetBrains Mono', ui-monospace, monospace";
        ctx.fillStyle = "rgba(226,234,255,0.55)";
        drawTracked(ctx, opts.statLabel.toUpperCase(), cx, 758, 3);
      }
    }

    // Footer divider
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pad + 60, SIZE - 150);
    ctx.lineTo(SIZE - pad - 60, SIZE - 150);
    ctx.stroke();

    // Footer URL
    ctx.font = "500 32px 'JetBrains Mono', ui-monospace, monospace";
    ctx.fillStyle = "rgba(226,234,255,0.7)";
    drawTracked(ctx, "braintap.app", cx, SIZE - 96, 4);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/png"),
    );
    if (!blob) return "failed";

    const fileName = `braintap-${slug(opts.gameName)}.png`;
    const file = new File([blob], fileName, { type: "image/png" });

    const nav = navigator as Navigator & {
      canShare?: (data?: ShareData) => boolean;
    };
    const shareData: ShareData = { files: [file] };
    if (opts.shareText) shareData.text = opts.shareText;

    if (
      typeof nav.share === "function" &&
      typeof nav.canShare === "function" &&
      nav.canShare({ files: [file] })
    ) {
      try {
        await nav.share(shareData);
        return "shared";
      } catch {
        // user cancelled or share failed — fall through to download
      }
    }

    // Fallback: trigger a download.
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return "downloaded";
  } catch {
    // Never throw — sharing is best-effort.
    return "failed";
  }
}

function hexA(hex: string, alpha: number): string {
  // Accept hex (#rgb/#rrggbb) or pass-through rgba/named with separate alpha.
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "result";
}

/** Draws centered text with manual letter-spacing (broad canvas support). */
function drawTracked(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  y: number,
  tracking: number,
) {
  const widths = [...text].map((ch) => ctx.measureText(ch).width + tracking);
  const total = widths.reduce((a, b) => a + b, 0) - tracking;
  let x = cx - total / 2;
  const prevAlign = ctx.textAlign;
  ctx.textAlign = "left";
  for (let i = 0; i < text.length; i++) {
    ctx.fillText(text[i], x, y);
    x += widths[i];
  }
  ctx.textAlign = prevAlign;
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  const startY = y - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((ln, i) => ctx.fillText(ln, cx, startY + i * lineHeight));
}

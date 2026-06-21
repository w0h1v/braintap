/** @type {import('next').NextConfig} */

// Capacitor (mobile) needs a static export it can serve from the device. The
// WEB build is left exactly as before (server mode), so the website keeps its
// dynamic routes (OG/Twitter images, auth callback). Only `npm run build:mobile`
// (BUILD_TARGET=mobile) switches on static export. See docs/mobile-runbook.md —
// the mobile export additionally requires the dynamic image routes to be
// export-guarded before it will complete.
const isMobile = process.env.BUILD_TARGET === "mobile";

const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // Lint is run explicitly in CI; don't fail production builds on lint.
    ignoreDuringBuilds: true,
  },
  ...(isMobile ? { output: "export", images: { unoptimized: true } } : {}),
};

export default nextConfig;

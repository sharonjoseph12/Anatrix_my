import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@antarix/types", "@antarix/utils"],
  experimental: {
    typedRoutes: true,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

type Plugin = (cfg: NextConfig) => NextConfig;

// PWA install is gated by the PWA_ENABLED env var so that:
//   - default `next dev` / `next build` keeps working without serwist being
//     installed (the import is dynamic + try/caught)
//   - the cohort rollout can flip the flag on a per-environment basis
//   - CI type-check / lint does not fail when @serwist/next is missing
const PWA_ENABLED = process.env.PWA_ENABLED === "true";

const intlWrapped: Plugin = withNextIntl;

function buildPwaPlugin(intl: Plugin): Plugin {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const serwistMod = require("@serwist/next") as Plugin | { default?: Plugin };
    const withSerwist: Plugin | undefined =
      typeof serwistMod === "function" ? serwistMod : serwistMod.default;
    if (typeof withSerwist !== "function") return intl;
    const withPwa = withSerwist({
      // The serwist plugin walks the `sw` directory by default.
      swSrc: "src/sw/service-worker.ts",
      swDest: "public/sw.js",
      reloadOnOnline: false,
      disable: false,
    });
    // Compose: serwist wraps the intl-wrapped config.
    return (cfg) => withPwa(intl(cfg));
  } catch {
    // @serwist/next not installed (e.g. before `pnpm install` runs the new
    // deps). Fall through to the intl-only config. The manifest is still
    // served from app/manifest.ts, so basic PWA install will work; only
    // the service-worker is missing.
    return intl;
  }
}

const finalPlugin: Plugin = PWA_ENABLED
  ? buildPwaPlugin(intlWrapped)
  : intlWrapped;

export default finalPlugin(nextConfig);

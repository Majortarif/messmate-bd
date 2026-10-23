import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Supabase project host, so avatars / listing photos from Storage can be optimised.
const supabaseHost = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname;
  } catch {
    return undefined;
  }
})();

const isProd = process.env.NODE_ENV === "production";
const supabaseOrigins = supabaseHost ? [`https://${supabaseHost}`] : [];

/**
 * Content Security Policy (production only; the dev server needs eval for HMR).
 * Inline scripts stay allowed because Next streams its payload in inline tags and the
 * theme script runs before paint; the policy still blocks scripts, frames and data
 * requests to any host that is not ours, Supabase, Google avatars or map tiles.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  ["img-src 'self' data: blob:", ...supabaseOrigins, "https://lh3.googleusercontent.com", "https://tile.openstreetmap.org"].join(" "),
  "font-src 'self'",
  ["connect-src 'self'", ...supabaseOrigins, ...(supabaseHost ? [`wss://${supabaseHost}`] : [])].join(" "),
  "worker-src 'self'",
  "manifest-src 'self'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
  ...(isProd
    ? [
        { key: "Content-Security-Policy", value: contentSecurityPolicy },
        { key: "Strict-Transport-Security", value: "max-age=63072000" },
      ]
    : []),
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  images: {
    remotePatterns: [
      ...(supabaseHost ? [{ protocol: "https" as const, hostname: supabaseHost, pathname: "/storage/v1/object/public/**" }] : []),
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
    ];
  },
};

const withNextIntl = createNextIntlPlugin();
export default withNextIntl(nextConfig);

import type { NextConfig } from "next";

const baselineSecurityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  // Never forward a paid landing page's path or click-ID query in Referer,
  // including on same-origin navigation into authenticated customer routes.
  { key: "Referrer-Policy", value: "strict-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
];

const privateWorkspaceHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
  },
  { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
  { key: "Cache-Control", value: "private, no-store, max-age=0, must-revalidate" },
  { key: "Pragma", value: "no-cache" },
];

const publicDiscoveryHeaders = [
  { key: "Cache-Control", value: "public, max-age=3600, stale-while-revalidate=86400" },
  { key: "X-Content-Type-Options", value: "nosniff" },
];

const publicDiscoverySources = [
  "/robots.txt",
  "/sitemap.xml",
  "/feed.xml",
  "/llms.txt",
  "/53478ab4be7faddc91a14935b2b35013051e4dfc9bb31c4a.txt",
];

// These public URLs negotiate presentation language from a cookie or the
// Accept-Language header before a localized response/redirect is selected.
// Next can replace middleware's Vary header while rendering, so the route
// contract is also declared here at the final response layer.
const requestLocalizedPublicSources = [
  "/",
  "/about",
  "/contact",
  "/download/:path*",
  "/file-service",
  "/how-it-works",
  "/services",
  "/services/:path*",
  "/brands/:path*",
  "/ecu-platforms/:path*",
  "/tools/:path*",
  "/widget/:path*",
  "/workshop-guides/:path*",
];

const requestLocalizedPublicHeaders = [
  {
    key: "Vary",
    value:
      "RSC, Next-Router-State-Tree, Next-Router-Prefetch, Next-Router-Segment-Prefetch, Cookie, Accept-Language, Accept-Encoding",
  },
];

const protectedPageSources = [
  "/admin/:path*",
  "/dashboard/:path*",
  "/new-request",
  "/payment/:path*",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/desktop-auth/turnstile",
  "/auth/:path*",
  "/measurement/:path*",
];

const nextConfig: NextConfig = {
  output: "standalone",
  async redirects() {
    return [
      {
        source: "/en",
        destination: "/",
        permanent: true,
      },
      {
        source: "/en/:path*",
        destination: "/:path*",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: baselineSecurityHeaders,
      },
      ...publicDiscoverySources.map((source) => ({
        source,
        headers: publicDiscoveryHeaders,
      })),
      ...requestLocalizedPublicSources.map((source) => ({
        source,
        headers: requestLocalizedPublicHeaders,
      })),
      ...protectedPageSources.map((source) => ({
        source,
        headers: privateWorkspaceHeaders,
      })),
    ];
  },
};

export default nextConfig;

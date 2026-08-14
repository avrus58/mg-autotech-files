import type { NextConfig } from "next";

const baselineSecurityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
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

const protectedPageSources = [
  "/admin/:path*",
  "/dashboard/:path*",
  "/new-request",
  "/payment/:path*",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/auth/:path*",
];

const nextConfig: NextConfig = {
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
      ...protectedPageSources.map((source) => ({
        source,
        headers: privateWorkspaceHeaders,
      })),
    ];
  },
};

export default nextConfig;

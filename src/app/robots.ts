import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = "https://file.mgautotech.de";

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/agb", "/datenschutz", "/impressum", "/widerruf"],
        disallow: [
          "/admin",
          "/api",
          "/auth",
          "/dashboard",
          "/forgot-password",
          "/login",
          "/new-request",
          "/payment",
          "/register",
          "/reset-password",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}

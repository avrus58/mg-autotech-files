import type { Metadata } from "next";
import { siteUrl } from "@/lib/seo";

export const notFoundMetadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    absolute: "404 — MG AutoTech",
  },
  description: "MG AutoTech • 404",
  alternates: null,
  openGraph: null,
  twitter: null,
  robots: {
    index: false,
    follow: false,
  },
};

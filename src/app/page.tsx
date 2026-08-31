import type { Metadata } from "next";
import { renderRootHomepage } from "@/lib/renderRootHomepage";
import { buildHomepageMetadata } from "@/lib/homepageMetadata";
import { defaultLocale } from "@/lib/i18nConfig";

export const metadata: Metadata = buildHomepageMetadata(defaultLocale);

export default function HomePage() {
  return renderRootHomepage(defaultLocale);
}

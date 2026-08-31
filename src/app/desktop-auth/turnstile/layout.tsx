import type { Metadata } from "next";
import type { ReactNode } from "react";
import { RequestLocaleBoundary } from "@/components/RequestLocaleBoundary";
import { buildDesktopTurnstileMetadata } from "@/lib/privatePageMetadata";
import { getServerLocale } from "@/lib/serverLocale";

export async function generateMetadata(): Promise<Metadata> {
  return buildDesktopTurnstileMetadata(await getServerLocale());
}

export default function DesktopTurnstileLayout({ children }: { children: ReactNode }) {
  return <RequestLocaleBoundary>{children}</RequestLocaleBoundary>;
}

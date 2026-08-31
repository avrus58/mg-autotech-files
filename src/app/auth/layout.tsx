import type { Metadata } from "next";
import { RequestLocaleBoundary } from "@/components/RequestLocaleBoundary";
import { buildAuthMetadata } from "@/lib/privatePageMetadata";
import { getServerLocale } from "@/lib/serverLocale";

export async function generateMetadata(): Promise<Metadata> {
  return buildAuthMetadata(await getServerLocale());
}

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <RequestLocaleBoundary>{children}</RequestLocaleBoundary>;
}

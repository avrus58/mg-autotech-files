import type { Metadata } from "next";
import { RequestLocaleBoundary } from "@/components/RequestLocaleBoundary";
import { buildLoginMetadata } from "@/lib/privatePageMetadata";
import { getServerLocale } from "@/lib/serverLocale";

export async function generateMetadata(): Promise<Metadata> {
  return buildLoginMetadata(await getServerLocale());
}

export default function LoginLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <RequestLocaleBoundary>{children}</RequestLocaleBoundary>;
}

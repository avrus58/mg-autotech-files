import type { Metadata } from "next";
import { RequestLocaleBoundary } from "@/components/RequestLocaleBoundary";
import { buildRegisterMetadata } from "@/lib/privatePageMetadata";
import { getServerLocale } from "@/lib/serverLocale";

export async function generateMetadata(): Promise<Metadata> {
  return buildRegisterMetadata(await getServerLocale());
}

export default function RegisterLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <RequestLocaleBoundary>{children}</RequestLocaleBoundary>;
}

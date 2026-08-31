import type { Metadata } from "next";
import { RequestLocaleBoundary } from "@/components/RequestLocaleBoundary";
import { buildResetPasswordMetadata } from "@/lib/privatePageMetadata";
import { getServerLocale } from "@/lib/serverLocale";

export async function generateMetadata(): Promise<Metadata> {
  return buildResetPasswordMetadata(await getServerLocale());
}

export default function ResetPasswordLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <RequestLocaleBoundary>{children}</RequestLocaleBoundary>;
}

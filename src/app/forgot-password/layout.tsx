import type { Metadata } from "next";
import { RequestLocaleBoundary } from "@/components/RequestLocaleBoundary";
import { buildForgotPasswordMetadata } from "@/lib/privatePageMetadata";
import { getServerLocale } from "@/lib/serverLocale";

export async function generateMetadata(): Promise<Metadata> {
  return buildForgotPasswordMetadata(await getServerLocale());
}

export default function ForgotPasswordLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <RequestLocaleBoundary>{children}</RequestLocaleBoundary>;
}

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildMeasurementCompletionMetadata } from "@/lib/privatePageMetadata";
import { getServerLocale } from "@/lib/serverLocale";
import { RequestLocaleBoundary } from "@/components/RequestLocaleBoundary";

export async function generateMetadata(): Promise<Metadata> {
  return buildMeasurementCompletionMetadata(await getServerLocale());
}

export default function MeasurementCompletionLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return <RequestLocaleBoundary>{children}</RequestLocaleBoundary>;
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { NewRequestAccessBoundary } from "@/app/new-request/NewRequestAccessBoundary";
import { ServerLocaleBoundary } from "@/components/ServerLocaleBoundary";
import { NewRequestAccessFallback } from "@/components/auth/NewRequestAccessFallback";
import { buildNewRequestMetadata } from "@/lib/privatePageMetadata";
import { getServerLocale } from "@/lib/serverLocale";

export async function generateMetadata(): Promise<Metadata> {
  return buildNewRequestMetadata(await getServerLocale());
}

export default async function NewRequestLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getServerLocale();

  return (
    <ServerLocaleBoundary locale={locale}>
      <Suspense
        fallback={<NewRequestAccessFallback locale={locale} />}
      >
        <NewRequestAccessBoundary>{children}</NewRequestAccessBoundary>
      </Suspense>
    </ServerLocaleBoundary>
  );
}

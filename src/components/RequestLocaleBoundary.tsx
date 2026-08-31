import type { ReactNode } from "react";
import { ServerLocaleBoundary } from "@/components/ServerLocaleBoundary";
import { getServerLocale } from "@/lib/serverLocale";

/** Restrict request-time locale resolution to private/request-owned subtrees. */
export async function RequestLocaleBoundary({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <ServerLocaleBoundary locale={await getServerLocale()}>
      {children}
    </ServerLocaleBoundary>
  );
}

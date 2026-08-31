"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { getStableSession } from "@/lib/authGuards";
import { requiresRegistrationCountryCompletion } from "@/lib/registrationCompletion";
import { replacePrivateMeasurementDocument } from "@/lib/publicAnalytics";
import { customerPortalFirstPaintT } from "@/lib/i18n/customer-portal-first-paint";
import { useActiveLocale } from "@/lib/useActiveLocale";

export function RegistrationCountryBoundary({
  children,
  nextPath,
}: {
  children: ReactNode;
  nextPath?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const locale = useActiveLocale();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    void getStableSession().then(({ session }) => {
      if (!active || !session?.user) return;

      if (requiresRegistrationCountryCompletion(session.user)) {
        const next = nextPath ?? pathname ?? "/dashboard";
        const destination = `/auth/complete-profile?next=${encodeURIComponent(next)}`;
        if (!replacePrivateMeasurementDocument(destination)) {
          router.replace(destination);
        }
        return;
      }

      setReady(true);
    });

    return () => {
      active = false;
    };
  }, [nextPath, pathname, router]);

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050505] px-4 text-white">
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-3 text-sm font-bold text-zinc-400"
        >
          <Loader2 className="h-5 w-5 animate-spin text-red-500" />
          {customerPortalFirstPaintT(locale, "Checking customer profile...")}
        </div>
      </main>
    );
  }

  return children;
}

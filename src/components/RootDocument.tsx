"use client";

import type { ReactNode } from "react";
import { useParams, usePathname } from "next/navigation";
import { defaultLocale } from "@/lib/i18nConfig";
import { getFixedPresentationLocale } from "@/lib/fixedPresentationLocale";
import { hreflangByLocale, isSeoLocale } from "@/lib/seo";
import { ActiveLocaleProvider } from "@/lib/useActiveLocale";

/**
 * Next prerenders this component with the full router's params, including the
 * child [locale] segment that the server root layout cannot read. This emits
 * the language on the opening HTML tag itself, without a browser script or
 * request headers that would opt static public pages out of prerendering.
 *
 * Prefixless, request-localized pages still use their ServerLocaleBoundary;
 * their cookie preference is not available to this request-independent shell.
 */
export function RootDocument({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const params = useParams();
  const pathname = usePathname();
  const routeLocale = params?.locale;
  const locale =
    typeof routeLocale === "string" && isSeoLocale(routeLocale)
      ? routeLocale
      : (getFixedPresentationLocale(pathname ?? "/") ?? defaultLocale);

  return (
    <html
      lang={hreflangByLocale[locale]}
      suppressHydrationWarning
      className={className}
    >
      <body className="min-h-full flex flex-col">
        <ActiveLocaleProvider initialLocale={locale}>
          {children}
        </ActiveLocaleProvider>
      </body>
    </html>
  );
}

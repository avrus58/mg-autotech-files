import type { ReactNode } from "react";
import { ActiveLocaleProvider } from "@/lib/useActiveLocale";
import type { LocaleCode } from "@/lib/i18nConfig";
import { hreflangByLocale } from "@/lib/seo";

/**
 * Seed client locale consumers from an already-resolved server locale without
 * making the root layout request-bound. The parser executes the tiny language
 * assignment before rendering the localized subtree.
 */
export function ServerLocaleBoundary({
  children,
  locale,
}: {
  children: ReactNode;
  locale: LocaleCode;
}) {
  const documentLanguage = hreflangByLocale[locale];

  return (
    <ActiveLocaleProvider initialLocale={locale}>
      <script
        data-server-document-language={documentLanguage}
        dangerouslySetInnerHTML={{
          __html: `document.documentElement.lang=${JSON.stringify(documentLanguage)};`,
        }}
      />
      {children}
    </ActiveLocaleProvider>
  );
}

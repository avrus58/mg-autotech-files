import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import {
  hreflangByLocale,
  isSeoLocale,
  localizedSeoLocales,
} from "@/lib/seo";

export function generateStaticParams() {
  return localizedSeoLocales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!isSeoLocale(locale)) notFound();

  const documentLanguage = hreflangByLocale[locale];

  return (
    <>
      <script
        data-locale-document-language
        dangerouslySetInnerHTML={{
          __html: `document.documentElement.lang=${JSON.stringify(documentLanguage)};`,
        }}
      />
      <div lang={documentLanguage}>{children}</div>
    </>
  );
}

import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { hreflangByLocale, isSeoLocale, seoLocales } from "@/lib/seo";

export function generateStaticParams() {
  return seoLocales.map((locale) => ({ locale }));
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

  return <div lang={hreflangByLocale[locale]}>{children}</div>;
}

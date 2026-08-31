import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { ServerLocaleBoundary } from "@/components/ServerLocaleBoundary";
import {
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

  return (
    <ServerLocaleBoundary locale={locale}>{children}</ServerLocaleBoundary>
  );
}

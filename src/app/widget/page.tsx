import type { Metadata } from "next";
import { WidgetSalesPageClient } from "@/components/widget/WidgetSalesPageClient";
import { getWidgetSettings } from "@/lib/widget/settings";
import { normalizeWidgetLanguage } from "@/lib/i18n/widget-translations";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Vehicle Selector Widget for Automotive Websites",
  description: "Embed a hosted, multilingual vehicle selector on your tuning or workshop website for EUR 4.99 per month.",
  alternates: { canonical: "/widget" },
};

export default async function WidgetSalesPage({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const params = await searchParams;
  const result = await getWidgetSettings();
  return <WidgetSalesPageClient initialSettings={result.settings} databaseReady={result.databaseReady} initialLanguage={normalizeWidgetLanguage(params.lang, "en")} />;
}

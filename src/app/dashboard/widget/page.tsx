import type { Metadata } from "next";
import { WidgetDashboardClient } from "@/components/dashboard/WidgetDashboardClient";
import { buildWidgetDashboardMetadata } from "@/lib/privatePageMetadata";
import { getServerLocale } from "@/lib/serverLocale";

export async function generateMetadata(): Promise<Metadata> {
  return buildWidgetDashboardMetadata(await getServerLocale());
}

export default function WidgetDashboardPage() {
  return <WidgetDashboardClient />;
}

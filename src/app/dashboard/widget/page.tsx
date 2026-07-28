import type { Metadata } from "next";
import { WidgetDashboardClient } from "@/components/dashboard/WidgetDashboardClient";

export const metadata: Metadata = {
  title: "Vehicle Widget Dashboard",
  description: "Manage your MG AutoTech Vehicle Selector Widget subscription and installation.",
  robots: { index: false, follow: false },
};

export default function WidgetDashboardPage() {
  return <WidgetDashboardClient />;
}

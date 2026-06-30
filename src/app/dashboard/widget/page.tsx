import type { Metadata } from "next";
import { BrowserAuthBoundary } from "@/components/auth/BrowserAuthBoundary";
import { WidgetDashboardClient } from "@/components/dashboard/WidgetDashboardClient";

export const metadata: Metadata = {
  title: "Vehicle Widget Dashboard",
  description: "Manage your MG AutoTech Vehicle Selector Widget subscription and installation.",
  robots: { index: false, follow: false },
};

export default function WidgetDashboardPage() {
  return (
    <BrowserAuthBoundary
      title="Please log in to manage your Vehicle Selector Widget"
      description="Widget settings, installation code, billing and domain controls are available only inside your customer account."
      nextPath="/dashboard/widget"
    >
      <WidgetDashboardClient />
    </BrowserAuthBoundary>
  );
}

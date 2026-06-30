import type { Metadata } from "next";
import { AuthRequired } from "@/components/auth/AuthRequired";
import { WidgetDashboardClient } from "@/components/dashboard/WidgetDashboardClient";
import { getSupabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Vehicle Widget Dashboard",
  description: "Manage your MG AutoTech Vehicle Selector Widget subscription and installation.",
  robots: { index: false, follow: false },
};

export default async function WidgetDashboardPage() {
  const supabase = await getSupabaseServer();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    return (
      <AuthRequired
        title="Please log in to manage your Vehicle Selector Widget"
        description="Widget settings, installation code, billing and domain controls are available only inside your customer account."
        nextPath="/dashboard/widget"
      />
    );
  }

  return <WidgetDashboardClient />;
}

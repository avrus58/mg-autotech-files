import type { Metadata } from "next";
import { AuthRequired } from "@/components/auth/AuthRequired";
import { DashboardClient } from "@/components/dashboard/DashboardClient";
import { getSupabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Customer Dashboard",
  description: "Secure MG AutoTech customer dashboard for file requests, credits and deliveries.",
  robots: { index: false, follow: false },
};

export default async function DashboardPage() {
  const supabase = await getSupabaseServer();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    return (
      <AuthRequired
        title="Please log in to access your customer dashboard"
        description="Your file requests, credits, messages and completed files are protected inside your MG AutoTech account."
        nextPath="/dashboard"
      />
    );
  }

  return <DashboardClient />;
}

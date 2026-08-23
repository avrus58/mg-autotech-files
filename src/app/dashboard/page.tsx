import type { Metadata } from "next";
import { EfferdDashboard2 } from "@/components/ui/efferd-dashboard-2";

export const metadata: Metadata = {
  title: "Customer Dashboard",
  description: "Secure MG AutoTech customer dashboard for file requests, credits and deliveries.",
  robots: { index: false, follow: false },
};

export default function DashboardPage() {
  return <EfferdDashboard2 />;
}

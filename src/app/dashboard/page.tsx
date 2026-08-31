import type { Metadata } from "next";
import { EfferdDashboard2 } from "@/components/ui/efferd-dashboard-2";
import { buildCustomerDashboardMetadata } from "@/lib/privatePageMetadata";
import { getServerLocale } from "@/lib/serverLocale";

export async function generateMetadata(): Promise<Metadata> {
  return buildCustomerDashboardMetadata(await getServerLocale());
}

export default function DashboardPage() {
  return <EfferdDashboard2 />;
}

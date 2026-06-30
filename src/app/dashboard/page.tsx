import type { Metadata } from "next";
import { BrowserAuthBoundary } from "@/components/auth/BrowserAuthBoundary";
import { DashboardClient } from "@/components/dashboard/DashboardClient";

export const metadata: Metadata = {
  title: "Customer Dashboard",
  description: "Secure MG AutoTech customer dashboard for file requests, credits and deliveries.",
  robots: { index: false, follow: false },
};

export default function DashboardPage() {
  return (
    <BrowserAuthBoundary
      title="Please log in to access your customer dashboard"
      description="Your file requests, credits, messages and completed files are protected inside your MG AutoTech account."
      nextPath="/dashboard"
    >
      <DashboardClient />
    </BrowserAuthBoundary>
  );
}

import type { Metadata } from "next";
import { BrowserAuthBoundary } from "@/components/auth/BrowserAuthBoundary";
import { RegistrationCountryBoundary } from "@/components/auth/RegistrationCountryBoundary";
import { CustomerPortalFrame } from "@/components/dashboard/CustomerPortalFrame";
import { RequestLocaleBoundary } from "@/components/RequestLocaleBoundary";
import { buildCustomerDashboardMetadata } from "@/lib/privatePageMetadata";
import { getServerLocale } from "@/lib/serverLocale";

export async function generateMetadata(): Promise<Metadata> {
  return buildCustomerDashboardMetadata(await getServerLocale());
}

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <RequestLocaleBoundary>
      <BrowserAuthBoundary
        title="Please log in to access your customer dashboard"
        description="Your file requests, credits, messages and completed files are protected inside your MG AutoTech account."
      >
        <RegistrationCountryBoundary>
          <CustomerPortalFrame>{children}</CustomerPortalFrame>
        </RegistrationCountryBoundary>
      </BrowserAuthBoundary>
    </RequestLocaleBoundary>
  );
}

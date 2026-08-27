import { BrowserAuthBoundary } from "@/components/auth/BrowserAuthBoundary";
import { RegistrationCountryBoundary } from "@/components/auth/RegistrationCountryBoundary";
import { CustomerPortalFrame } from "@/components/dashboard/CustomerPortalFrame";

export default function NewRequestLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <BrowserAuthBoundary
      title="Create an account or log in to submit a file request"
      description="Vehicle details, selected services and private uploads must stay connected to your verified MG AutoTech account."
      nextPath="/new-request"
      unauthenticatedPrimaryAction="register"
    >
      <RegistrationCountryBoundary nextPath="/new-request">
        <CustomerPortalFrame>{children}</CustomerPortalFrame>
      </RegistrationCountryBoundary>
    </BrowserAuthBoundary>
  );
}

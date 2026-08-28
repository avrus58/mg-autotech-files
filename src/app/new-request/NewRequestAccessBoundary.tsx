"use client";

import { ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { BrowserAuthBoundary } from "@/components/auth/BrowserAuthBoundary";
import { RegistrationCountryBoundary } from "@/components/auth/RegistrationCountryBoundary";
import { CustomerPortalFrame } from "@/components/dashboard/CustomerPortalFrame";
import { buildNewRequestPath, parseRequestIntent } from "@/lib/requestIntent";

export function NewRequestAccessBoundary({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const nextPath = buildNewRequestPath(parseRequestIntent(searchParams.get("intent")));

  return (
    <BrowserAuthBoundary
      title="Create an account or log in to submit a file request"
      description="Vehicle details, selected services and private uploads must stay connected to your verified MG AutoTech account."
      nextPath={nextPath}
      unauthenticatedPrimaryAction="register"
    >
      <RegistrationCountryBoundary nextPath={nextPath}>
        <CustomerPortalFrame>{children}</CustomerPortalFrame>
      </RegistrationCountryBoundary>
    </BrowserAuthBoundary>
  );
}

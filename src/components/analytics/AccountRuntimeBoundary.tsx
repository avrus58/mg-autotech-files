"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { isAccountRuntimePath } from "@/lib/accountRuntimeBoundary";

const GrowthIdentityLinkRuntime = dynamic(
  () =>
    import("@/components/analytics/GrowthIdentityLinkRuntime").then(
      (module) => module.GrowthIdentityLinkRuntime
    ),
  { ssr: false }
);
const RegistrationHandoffRecoveryRuntime = dynamic(
  () =>
    import("@/components/analytics/RegistrationHandoffRecoveryRuntime").then(
      (module) => module.RegistrationHandoffRecoveryRuntime
    ),
  { ssr: false }
);

export function AccountRuntimeBoundary() {
  const pathname = usePathname();
  if (!isAccountRuntimePath(pathname)) return null;

  return (
    <>
      <GrowthIdentityLinkRuntime />
      <RegistrationHandoffRecoveryRuntime />
    </>
  );
}

"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { isCustomerNotificationRuntimePath } from "@/lib/customerNotificationRuntime";

const CustomerNotifications = dynamic(
  () =>
    import("@/components/CustomerNotifications").then(
      (module) => module.CustomerNotifications
    ),
  { ssr: false }
);

export function CustomerNotificationsRuntime() {
  const pathname = usePathname();
  if (!isCustomerNotificationRuntimePath(pathname)) return null;

  return <CustomerNotifications />;
}

"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const CustomerNotifications = dynamic(
  () =>
    import("@/components/CustomerNotifications").then(
      (module) => module.CustomerNotifications
    ),
  { ssr: false }
);

function isCustomerWorkspace(pathname: string) {
  return (
    pathname === "/new-request" ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/payment/")
  );
}

export function CustomerNotificationsRuntime() {
  const pathname = usePathname();
  const customerWorkspace = isCustomerWorkspace(pathname);
  const [publicRuntimeReady, setPublicRuntimeReady] = useState(false);

  useEffect(() => {
    if (customerWorkspace || pathname.startsWith("/admin") || pathname.startsWith("/embed/")) {
      return;
    }

    const idleWindow = window as typeof window & {
      requestIdleCallback?: (
        callback: () => void,
        options?: { timeout: number }
      ) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

    if (idleWindow.requestIdleCallback) {
      const handle = idleWindow.requestIdleCallback(
        () => setPublicRuntimeReady(true),
        { timeout: 5000 }
      );
      return () => idleWindow.cancelIdleCallback?.(handle);
    }

    const timer = window.setTimeout(() => setPublicRuntimeReady(true), 3500);
    return () => window.clearTimeout(timer);
  }, [customerWorkspace, pathname]);

  if (pathname.startsWith("/admin") || pathname.startsWith("/embed/")) {
    return null;
  }

  if (!customerWorkspace && !publicRuntimeReady) return null;

  return <CustomerNotifications />;
}

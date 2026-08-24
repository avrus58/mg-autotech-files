import type { Metadata } from "next";
import { BrowserAuthBoundary } from "@/components/auth/BrowserAuthBoundary";
import { AdminNotificationDock } from "@/components/admin/AdminNotificationDock";
import { AdminWorkspaceRestoreGuard } from "@/components/admin/AdminWorkspaceRestoreGuard";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <AdminWorkspaceRestoreGuard />
      <BrowserAuthBoundary
        title="Please log in to access the admin workspace"
        description="MG AutoTech operations, customer records and internal controls require a verified staff session."
      >
        {children}
        <AdminNotificationDock />
      </BrowserAuthBoundary>
    </>
  );
}

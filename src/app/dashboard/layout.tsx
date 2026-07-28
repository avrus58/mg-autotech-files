import type { Metadata } from "next";
import { BrowserAuthBoundary } from "@/components/auth/BrowserAuthBoundary";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <BrowserAuthBoundary
      title="Please log in to access your customer dashboard"
      description="Your file requests, credits, messages and completed files are protected inside your MG AutoTech account."
    >
      {children}
    </BrowserAuthBoundary>
  );
}

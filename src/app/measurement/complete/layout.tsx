import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Secure measurement handoff",
  robots: {
    index: false,
    follow: false,
    noarchive: true,
  },
};

export default function MeasurementCompletionLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return children;
}

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "MG AutoTech · ECU · TCU" },
  description: "MG AutoTech · ECU · TCU",
  alternates: null,
  openGraph: null,
  twitter: null,
  robots: { index: false, follow: false },
};

export default function VehicleSelectorEmbedLayout({ children }: { children: React.ReactNode }) {
  return children;
}


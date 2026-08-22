import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Datalog Analysis Studio",
  description: "The detailed MG AutoTech datalog workspace is available inside the protected customer dashboard.",
  robots: { index: false, follow: false },
};

export default function LegacyAutotunerLogAnalyzerPage() {
  permanentRedirect("/dashboard/log-analysis");
}

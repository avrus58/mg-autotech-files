import type { Metadata } from "next";
import { LogAnalysisStudio } from "@/components/dashboard/LogAnalysisStudio";

export const metadata: Metadata = {
  title: "Log Analysis Studio",
  description: "Private browser-local multi-channel log review for MG AutoTech customers.",
  robots: { index: false, follow: false },
};

export default function LogAnalysisStudioPage() {
  return <LogAnalysisStudio />;
}

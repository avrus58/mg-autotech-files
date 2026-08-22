import type { Metadata } from "next";
import { LogAnalysisStudioLoader } from "@/components/dashboard/LogAnalysisStudioLoader";

export const metadata: Metadata = {
  title: "Datalog Analysis Studio",
  description: "Private browser-local multi-channel datalog review for MG AutoTech customers.",
  robots: { index: false, follow: false },
};

export default function LogAnalysisStudioPage() {
  return <LogAnalysisStudioLoader />;
}

import type { Metadata } from "next";
import { LogAnalysisStudioLoader } from "@/components/dashboard/LogAnalysisStudioLoader";
import { buildLogAnalysisStudioMetadata } from "@/lib/privatePageMetadata";
import { getServerLocale } from "@/lib/serverLocale";

export async function generateMetadata(): Promise<Metadata> {
  return buildLogAnalysisStudioMetadata(await getServerLocale());
}

export default function LogAnalysisStudioPage() {
  return <LogAnalysisStudioLoader />;
}

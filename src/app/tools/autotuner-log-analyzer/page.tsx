import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import { buildLogAnalysisStudioMetadata } from "@/lib/privatePageMetadata";
import { getServerLocale } from "@/lib/serverLocale";

export async function generateMetadata(): Promise<Metadata> {
  return buildLogAnalysisStudioMetadata(await getServerLocale());
}

export default function LegacyAutotunerLogAnalyzerPage() {
  permanentRedirect("/dashboard/log-analysis");
}

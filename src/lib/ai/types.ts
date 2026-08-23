import type { FileExpertAnalyzerResult } from "@/lib/fileExpert/types";
import type { PublicSimilarityEvidence } from "@/lib/ecuIntelligence/similarity";

export type AiProviderName = "rule_based" | "openai" | "ollama" | "vllm" | "local";

export type AiReportMetadata = {
  brand?: string | null;
  model?: string | null;
  engine?: string | null;
  ecuType?: string | null;
  readMethod?: string | null;
  customerNotes?: string | null;
};

export type AiReportRequest = {
  sourceType: "file_expert_job" | "training_sample" | "admin_query";
  sourceId?: string | null;
  result: FileExpertAnalyzerResult;
  metadata: AiReportMetadata;
  similarityEvidence?: PublicSimilarityEvidence | null;
};

export type AiReportResponse = {
  provider: AiProviderName;
  modelName: string | null;
  promptVersion: string;
  executiveSummary: string;
  report: string;
  outputJson?: Record<string, unknown> | null;
  generation?: AiReportGenerationMetadata;
};

export interface AiReportProvider {
  readonly name: AiProviderName;
  readonly modelName: string | null;
  generateReport(
    input: AiReportRequest,
    options?: { signal?: AbortSignal }
  ): Promise<AiReportResponse>;
}

export type AiReportGenerationState =
  | "provider_generated"
  | "deterministic_fallback"
  | "provider_error_fallback";

export type AiReportGenerationMetadata = {
  state: AiReportGenerationState;
  requestedProvider: {
    name: AiProviderName;
    modelName: string | null;
    status: "available" | "unavailable" | "failed";
  };
  executedProvider: {
    name: AiProviderName;
    modelName: string | null;
    promptVersion: string;
  };
  fallback: {
    used: boolean;
    reason: "no_configured_provider" | "provider_error" | null;
    message: string | null;
  };
  isAiGenerated: boolean;
};

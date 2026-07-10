import type { Stage1DraftEstimate } from "@/lib/vehicleEnrichment/types";

export function createStage1DraftEstimate(stockHp: number | null, stockNm: number | null): Stage1DraftEstimate {
  return {
    stage1HpEstimate: stockHp != null && stockHp > 0 ? Math.round(stockHp * 1.15) : null,
    stage1NmEstimate: stockNm != null && stockNm > 0 ? Math.round(stockNm * 1.15) : null,
    estimateSource: "auto_estimate_15_percent",
    estimateConfidence: "low",
    needsReview: true,
    verified: false,
  };
}

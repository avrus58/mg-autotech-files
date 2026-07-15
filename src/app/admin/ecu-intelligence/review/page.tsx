import EcuIntelligenceShell from "../EcuIntelligenceShell";

export default function EcuIntelligenceReviewPage() {
  return (
    <EcuIntelligenceShell
      mode="review"
      title="Unified Human Review Queue"
      subtitle="Prioritized learning files, pair candidates, identity conflicts, authorization gaps and unknown service labels with explainable priority."
      endpoint="/api/admin/ecu-intelligence/review"
    />
  );
}

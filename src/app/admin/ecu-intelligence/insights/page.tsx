import EcuIntelligenceShell from "../EcuIntelligenceShell";

export default function EcuIntelligenceInsightsPage() {
  return (
    <EcuIntelligenceShell
      mode="insights"
      title="Evidence-Backed Insights"
      subtitle="Deterministic admin insights generated from corpus metrics. They do not approve samples, create rules or change readiness."
      endpoint="/api/admin/ecu-intelligence/insights"
    />
  );
}

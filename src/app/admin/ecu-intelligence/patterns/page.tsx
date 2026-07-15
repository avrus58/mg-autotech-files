import EcuIntelligenceShell from "../EcuIntelligenceShell";

export default function EcuIntelligencePatternsPage() {
  return (
    <EcuIntelligenceShell
      mode="patterns"
      title="Pattern Evidence Explorer"
      subtitle="Read-only pattern signatures and clusters. This view supports evidence review, not automatic generation."
      endpoint="/api/admin/ecu-intelligence/patterns"
    />
  );
}

import EcuIntelligenceShell from "../EcuIntelligenceShell";

export default function EcuIntelligenceSimilarityPage() {
  return (
    <EcuIntelligenceShell
      mode="similarity"
      title="Similarity Explorer"
      subtitle="Nearest evidence lookup with explicit warnings: similarity is not exact SW compatibility and never authorizes file modification."
      endpoint="/api/admin/ecu-intelligence/similarity"
    />
  );
}

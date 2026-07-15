import EcuIntelligenceShell from "../EcuIntelligenceShell";

export default function EcuIntelligenceBackfillPage() {
  return (
    <EcuIntelligenceShell
      mode="backfill"
      title="Backfill Control"
      subtitle="Links the existing learning-flywheel historical backfill into the intelligence center. Backfill creates review-first candidates only."
      endpoint="/api/admin/ecu-intelligence/backfill"
    />
  );
}

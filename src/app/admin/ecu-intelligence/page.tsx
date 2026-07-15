import EcuIntelligenceShell from "./EcuIntelligenceShell";

export default function EcuIntelligencePage() {
  return (
    <EcuIntelligenceShell
      mode="overview"
      title="Unified ECU Intelligence Center"
      subtitle="One admin-only control tower for customer jobs, File Expert evidence, learning candidates, training samples, patterns, similarity, maps, readiness and review priority."
      endpoint="/api/admin/ecu-intelligence/overview"
    />
  );
}

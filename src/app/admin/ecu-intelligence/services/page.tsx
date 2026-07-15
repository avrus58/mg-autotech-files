import EcuIntelligenceShell from "../EcuIntelligenceShell";

export default function EcuIntelligenceServicesPage() {
  return (
    <EcuIntelligenceShell
      mode="services"
      title="Service Coverage Matrix"
      subtitle="Stage, DTC, aftertreatment, TCU and supporting service categories with candidate, approval and review coverage."
      endpoint="/api/admin/ecu-intelligence/services"
    />
  );
}

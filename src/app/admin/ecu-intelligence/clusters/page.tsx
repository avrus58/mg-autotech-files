import EcuIntelligenceShell from "../EcuIntelligenceShell";

export default function EcuIntelligenceClustersPage() {
  return (
    <EcuIntelligenceShell
      mode="clusters"
      title="Exact Cluster Explorer"
      subtitle="Search canonical ECU/HW/SW/calibration/file-role clusters. Synthetic evidence is excluded from real metrics by default."
      endpoint="/api/admin/ecu-intelligence/clusters"
    />
  );
}

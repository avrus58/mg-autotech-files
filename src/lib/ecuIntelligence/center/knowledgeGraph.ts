import type { EcuIntelligenceClusterSummary, EcuIntelligenceGraph } from "@/lib/ecuIntelligence/center/types";

function nodeId(type: string, label: string) {
  return `${type}:${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

export function buildClusterKnowledgeGraph(cluster: EcuIntelligenceClusterSummary): EcuIntelligenceGraph {
  const nodes = new Map<string, EcuIntelligenceGraph["nodes"][number]>();
  const edges: EcuIntelligenceGraph["edges"] = [];

  const addNode = (type: string, label: string, evidenceCount?: number) => {
    const id = nodeId(type, label || "unknown");
    if (!nodes.has(id)) nodes.set(id, { id, type, label: label || "unknown", evidenceCount });
    return id;
  };
  const addEdge = (source: string, target: string, type: string, label: string) => {
    const id = `${source}->${type}->${target}`;
    if (!edges.some((edge) => edge.id === id)) edges.push({ id, source, target, type, label });
  };

  const clusterNode = addNode("exact_cluster", cluster.identity.displayLabel, cluster.uniqueSourceCount);
  const supplier = addNode("supplier", cluster.identity.supplier);
  const family = addNode("ecu_family", cluster.identity.ecuFamily);
  const ecuType = addNode("ecu_type", cluster.identity.ecuType);
  const hw = addNode("hw", cluster.identity.hwNumber);
  const sw = addNode("sw", cluster.identity.swNumber);
  const readiness = addNode("readiness_state", cluster.readiness);

  addEdge(clusterNode, supplier, "belongs_to", "supplier");
  addEdge(clusterNode, family, "belongs_to", "family");
  addEdge(clusterNode, ecuType, "exact_variant_of", "ECU type");
  addEdge(clusterNode, hw, "observed_in", "HW");
  addEdge(clusterNode, sw, "observed_in", "SW");
  addEdge(clusterNode, readiness, "blocked_by", "readiness");

  for (const service of cluster.serviceCoverage.filter((cell) => cell.candidateCount || cell.approvedCount)) {
    const serviceNode = addNode("service_category", service.category, service.candidateCount);
    addEdge(clusterNode, serviceNode, service.approvedCount ? "supports" : "missing_evidence", service.readiness);
    for (const code of service.exactDtcCodes) {
      const codeNode = addNode("exact_dtc_code", code, 1);
      addEdge(serviceNode, codeNode, "observed_in", "exact code");
    }
  }

  if (cluster.patternClusterCount) {
    const patternNode = addNode("pattern_cluster", `${cluster.patternClusterCount} pattern clusters`, cluster.patternClusterCount);
    addEdge(clusterNode, patternNode, "member_of", "pattern evidence");
  }
  if (cluster.mapDefinitionSetCount) {
    const mapNode = addNode("map_definition_set", `${cluster.mapDefinitionSetCount} definition sets`, cluster.mapDefinitionSetCount);
    addEdge(clusterNode, mapNode, "attributed_to", "map context");
  }
  if (cluster.missingEvidenceCount) {
    const missingNode = addNode("missing_evidence", `${cluster.missingEvidenceCount} missing gates`, cluster.missingEvidenceCount);
    addEdge(clusterNode, missingNode, "missing_evidence", "missing gates");
  }

  return {
    clusterId: cluster.id,
    nodes: [...nodes.values()],
    edges,
    safety: {
      rawBytesIncluded: false,
      storagePathsIncluded: false,
      customerPiiIncluded: false,
    },
  };
}

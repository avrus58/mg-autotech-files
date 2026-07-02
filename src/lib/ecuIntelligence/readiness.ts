export const knowledgeLevelDefinitions = [
  {
    level: 0,
    key: "not_ready",
    label: "Level 0 Unknown",
    explanation: "Collecting data. System can analyze files but does not have enough examples for reliable detection.",
  },
  {
    level: 1,
    key: "detection_ready",
    label: "Level 1 Detection Ready",
    explanation: "Enough examples for basic detection.",
  },
  {
    level: 2,
    key: "pattern_ready",
    label: "Level 2 Pattern Ready",
    explanation: "Repeated feature patterns are becoming visible.",
  },
  {
    level: 3,
    key: "map_candidate_ready",
    label: "Level 3 Map Candidate Ready",
    explanation: "Map candidate suggestions may become useful.",
  },
  {
    level: 4,
    key: "suggestion_ready",
    label: "Level 4 Suggestion Ready",
    explanation: "Human calibration suggestions may be possible.",
  },
  {
    level: 5,
    key: "draft_ready",
    label: "Level 5 Draft Ready / future only",
    explanation: "Future only. Requires manual approval and high-quality verified data.",
  },
] as const;

export function getKnowledgeLevelDefinition(level: number) {
  return knowledgeLevelDefinitions.find((item) => item.level === level) ?? knowledgeLevelDefinitions[0];
}

export function calculateKnowledgeReadiness(total: number, verified: number) {
  if (total < 10) return { level: 0, value: "not_ready" as const };
  if (total < 100) return { level: 1, value: "detection_ready" as const };
  if (total < 500) {
    return verified >= 10
      ? { level: 2, value: "pattern_ready" as const }
      : { level: 1, value: "detection_ready" as const };
  }
  if (total < 2000) {
    return verified >= 50
      ? { level: 3, value: "map_candidate_ready" as const }
      : { level: 2, value: "pattern_ready" as const };
  }
  return verified >= 200
    ? { level: 4, value: "suggestion_ready" as const }
    : { level: 3, value: "map_candidate_ready" as const };
}

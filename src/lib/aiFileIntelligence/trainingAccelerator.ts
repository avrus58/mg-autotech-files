import { createLockedAIChangePlan } from "@/lib/aiFileIntelligence/changePlan";
import { evaluateEvidenceTrust, evaluateLearningUsefulness } from "@/lib/aiFileIntelligence/evidenceReadiness";
import { evaluateGenerationReadiness } from "@/lib/aiFileIntelligence/generationReadiness";
import { attributeChangedRegionsToDefinitions } from "@/lib/aiFileIntelligence/mapAttribution";
import { buildSyntheticFixture, buildSyntheticFixtureCatalog, type SyntheticFixtureType } from "@/lib/aiFileIntelligence/syntheticFixtures";
import type { GenerationReadinessStatus, MapCategory } from "@/lib/aiFileIntelligence/types";
import { emptyTrainingServiceLabels, type TrainingFeature } from "@/lib/ecuIntelligence/types";

export type SyntheticTrainingCase = {
  fixture_id: string;
  fixture_type: SyntheticFixtureType;
  safe_fake_binary: true;
  not_flashable: true;
  ecu_family: string;
  ecu_type: string;
  sw_number: string;
  hw_number: string;
  service_labels: TrainingFeature[];
  ori_size: number;
  mod_size: number;
  changed_region_count: number;
  expected_categories: MapCategory[];
  attribution_status: string;
  attributed_region_count: number;
  unknown_region_count: number;
  average_attribution_confidence: number;
  evidence_trust_level: string;
  evidence_score: number;
  learning_usable: boolean;
  learning_recommended_action: string;
  generation_readiness_status: GenerationReadinessStatus;
  generation_export_allowed: false;
  generation_blocked_reasons: string[];
  safe_change_plan_status: string;
};

export type SyntheticTrainingBenchmark = {
  mode: "synthetic_fixture_lab";
  safe_fake_binary: true;
  not_flashable: true;
  total_cases: number;
  attribution_ready_cases: number;
  learning_usable_cases: number;
  export_allowed_cases: 0;
  cases: SyntheticTrainingCase[];
  warnings: string[];
};

function serviceLabelRecord(features: TrainingFeature[]) {
  const output = emptyTrainingServiceLabels();
  for (const feature of features) output[feature] = true;
  return output;
}

export function buildSyntheticTrainingCase(type: SyntheticFixtureType): SyntheticTrainingCase {
  const fixture = buildSyntheticFixture(type);
  const attribution = attributeChangedRegionsToDefinitions({
    changedRegions: fixture.changed_regions,
    definitionSets: [fixture.definition_set],
    definitions: fixture.map_definitions,
    ecuFamily: fixture.ecu_family,
    ecuType: fixture.ecu_type,
    swNumber: fixture.sw_number,
    hwNumber: fixture.hw_number,
  });
  const sample = {
    learning_use_status: "approved_for_learning" as const,
    human_verification_status: "confirmed" as const,
    data_quality_score: 95,
    requested_service_labels: serviceLabelRecord(fixture.service_labels),
    performed_service_labels: serviceLabelRecord(fixture.service_labels),
    pattern_signature: { main_regions: fixture.changed_regions.map((region) => ({ start_offset_hex: String(region.offset_start), end_offset_hex: String(region.offset_end) })) } as never,
    diff_json: { mode: "ori_mod_compare", synthetic: true } as never,
    source_type: "demo_fixture" as const,
    source_metadata: { synthetic: true, safe_fake_binary: true, not_flashable: true },
  };
  const evidence = evaluateEvidenceTrust({
    sample,
    similarityBestScore: 100,
    clusterStatus: "strong",
    mapAttribution: attribution,
    allowSyntheticEvidence: true,
  });
  const learning = evaluateLearningUsefulness({
    sample,
    clusterStatus: "strong",
    mapDefinitionStatus: attribution.status === "attributed" ? "available" : "partial",
    privacySafe: true,
  });
  const generation = evaluateGenerationReadiness({
    evidence,
    mapAttribution: attribution,
    ecuIdentified: true,
    swOrHwIdentified: true,
    actualLabelsConfirmed: true,
    clusterStatus: "strong",
    humanReviewWorkflowReady: true,
    checksumWorkflowAvailable: false,
  });
  const plan = createLockedAIChangePlan({
    serviceLabels: fixture.service_labels,
    evidence,
    readiness: generation,
    mapAttribution: attribution,
  });

  return {
    fixture_id: fixture.fixture_id,
    fixture_type: fixture.fixture_type,
    safe_fake_binary: true,
    not_flashable: true,
    ecu_family: fixture.ecu_family,
    ecu_type: fixture.ecu_type,
    sw_number: fixture.sw_number,
    hw_number: fixture.hw_number,
    service_labels: fixture.service_labels,
    ori_size: fixture.ori.length,
    mod_size: fixture.mod.length,
    changed_region_count: fixture.changed_regions.length,
    expected_categories: [...new Set(fixture.expected_attributions.map((item) => item.category as MapCategory))],
    attribution_status: attribution.status,
    attributed_region_count: attribution.attributed_regions.length - attribution.unknown_region_count,
    unknown_region_count: attribution.unknown_region_count,
    average_attribution_confidence: attribution.average_confidence,
    evidence_trust_level: evidence.trust_level,
    evidence_score: evidence.score,
    learning_usable: learning.usable_for_learning,
    learning_recommended_action: learning.recommended_admin_action,
    generation_readiness_status: generation.readiness_status,
    generation_export_allowed: false,
    generation_blocked_reasons: generation.blocked_reasons,
    safe_change_plan_status: plan.status,
  };
}

export function buildSyntheticTrainingBenchmark(): SyntheticTrainingBenchmark {
  const cases = buildSyntheticFixtureCatalog().map((fixture) => buildSyntheticTrainingCase(fixture.fixture_type));
  return {
    mode: "synthetic_fixture_lab",
    safe_fake_binary: true,
    not_flashable: true,
    total_cases: cases.length,
    attribution_ready_cases: cases.filter((item) => item.attribution_status === "attributed").length,
    learning_usable_cases: cases.filter((item) => item.learning_usable).length,
    export_allowed_cases: 0,
    cases,
    warnings: [
      "Synthetic fixtures are fake and not flashable.",
      "Generation export remains locked.",
      "Synthetic fixtures must not become real customer delivery files.",
    ],
  };
}

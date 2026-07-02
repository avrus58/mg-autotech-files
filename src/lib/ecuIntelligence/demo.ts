import { buildDemoBinaryFixtures, demoFixtureVersion, isAiTrainingDemoEnabled } from "@/lib/ecuIntelligence/demoFixtures";
import { emptyTrainingServiceLabels } from "@/lib/ecuIntelligence/types";
import { createTrainingSampleFromBuffers } from "@/lib/ecuIntelligence/learning";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function runAiTrainingDemo(actorUserId: string) {
  if (!isAiTrainingDemoEnabled()) {
    throw new Error("AI training demo mode is disabled.");
  }

  const fixtures = buildDemoBinaryFixtures();
  const oriName = "ori_same_size.bin";
  const modName = "mod_same_size_stage1_like.bin";
  const ori = fixtures[oriName];
  const mod = fixtures[modName];
  const basePath = `demo/${demoFixtureVersion}`;
  const oriPath = `${basePath}/${oriName}`;
  const modPath = `${basePath}/${modName}`;
  const admin = getSupabaseAdmin();

  for (const [path, buffer] of [[oriPath, ori], [modPath, mod]] as const) {
    const uploaded = await admin.storage.from("ai-training").upload(path, buffer, {
      contentType: "application/octet-stream",
      upsert: true,
      cacheControl: "3600",
    });
    if (uploaded.error) throw new Error(`Demo fixture upload failed: ${uploaded.error.message}`);
  }

  const labels = emptyTrainingServiceLabels();
  labels.stage1 = true;

  return createTrainingSampleFromBuffers({
    analysisId: "00000000-0000-4000-8000-000000000100",
    requestId: null,
    userId: null,
    actorUserId,
    ori,
    mod,
    oriFilePath: oriPath,
    modFilePath: modPath,
    oriFileName: oriName,
    modFileName: modName,
    brand: "DEMO VEHICLE",
    model: "Level 0 Training Fixture",
    engine: "Demo 2.0",
    ecuType: "Bosch EDC17C50 DEMO",
    ecuFamily: "EDC17",
    swNumber: "SW1037550001-DEMO",
    hwNumber: "HW0281031234-DEMO",
    readMethod: "Bench",
    serviceLabels: labels,
    provider: "demo_fixture",
    revisionLabel: demoFixtureVersion,
    sourceMetadata: {
      demo: true,
      fixture_version: demoFixtureVersion,
      source_bucket: "ai-training",
      customer_data: false,
      logs_available: false,
      dyno_available: false,
    },
    createdMessage: "DEMO ONLY: harmless ORI/MOD fixture converted into a Level 0 training sample.",
  });
}

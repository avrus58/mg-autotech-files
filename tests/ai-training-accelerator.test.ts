import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";
import { buildSyntheticTrainingBenchmark, buildSyntheticTrainingCase } from "../src/lib/aiFileIntelligence/trainingAccelerator";

function readProjectFile(...segments: string[]) {
  return readFileSync(resolve(process.cwd(), ...segments), "utf8");
}

test("synthetic training accelerator benchmark is safe, deterministic and export locked", () => {
  const first = buildSyntheticTrainingBenchmark();
  const second = buildSyntheticTrainingBenchmark();

  assert.equal(first.mode, "synthetic_fixture_lab");
  assert.equal(first.safe_fake_binary, true);
  assert.equal(first.not_flashable, true);
  assert.equal(first.total_cases, 4);
  assert.equal(first.export_allowed_cases, 0);
  assert.deepEqual(first.cases.map((item) => item.fixture_id), second.cases.map((item) => item.fixture_id));
  assert.ok(first.cases.every((item) => item.generation_export_allowed === false));
  assert.ok(first.cases.every((item) => item.not_flashable === true));
});

test("synthetic training cases exercise map attribution and generation gates without real files", () => {
  const stage1 = buildSyntheticTrainingCase("stage1_like");
  const checksum = buildSyntheticTrainingCase("checksum_like");

  assert.equal(stage1.safe_fake_binary, true);
  assert.equal(stage1.not_flashable, true);
  assert.ok(stage1.expected_categories.includes("torque_limiter"));
  assert.ok(stage1.expected_categories.includes("boost_request"));
  assert.equal(stage1.attribution_status, "attributed");
  assert.ok(stage1.evidence_score >= 80);
  assert.equal(stage1.generation_export_allowed, false);
  assert.ok(stage1.generation_blocked_reasons.includes("output_export_disabled"));
  assert.ok(checksum.expected_categories.includes("checksum"));
});

test("synthetic lab admin API rejects anonymous users", async () => {
  const { GET, POST } = await import("../src/app/api/admin/ai-training/synthetic-lab/route");
  const getResponse = await GET(new Request("http://localhost/api/admin/ai-training/synthetic-lab"));
  const postResponse = await POST(new Request("http://localhost/api/admin/ai-training/synthetic-lab", { method: "POST" }));
  assert.equal(getResponse.status, 401);
  assert.equal(postResponse.status, 401);
});

test("synthetic lab UI is linked from the AI training control room and states dry-run safety", () => {
  const aiPage = readProjectFile("src", "app", "admin", "ai-training", "page.tsx");
  const labPage = readProjectFile("src", "app", "admin", "ai-training", "synthetic-lab", "page.tsx");

  assert.match(aiPage, /\/admin\/ai-training\/synthetic-lab/);
  assert.match(labPage, /safe_fake_binary/);
  assert.match(labPage, /not_flashable|not flashable/i);
  assert.match(labPage, /no customer file generation/i);
});

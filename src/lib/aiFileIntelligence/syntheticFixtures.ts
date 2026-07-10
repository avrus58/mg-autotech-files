import { createHash } from "crypto";
import {
  mapCategories,
  type ChangedRegionInput,
  type MapDefinition,
  type MapDefinitionSet,
} from "@/lib/aiFileIntelligence/types";
import type { TrainingFeature } from "@/lib/ecuIntelligence/types";

export type SyntheticFixtureType = "stage1_like" | "egr_off_like" | "dtc_off_like" | "checksum_like";

export type SyntheticFixture = {
  fixture_id: string;
  fixture_type: SyntheticFixtureType;
  safe_fake_binary: true;
  not_flashable: true;
  ecu_family: string;
  ecu_type: string;
  sw_number: string;
  hw_number: string;
  service_labels: TrainingFeature[];
  ori: Buffer;
  mod: Buffer;
  changed_regions: ChangedRegionInput[];
  definition_set: MapDefinitionSet;
  map_definitions: MapDefinition[];
  expected_attributions: Array<{ changed_region_id: string; category: string; map_name: string }>;
  summary: string;
};

function hashId(input: string) {
  return createHash("sha256").update(input).digest("hex").slice(0, 16);
}

function baseBuffer(size = 32_768) {
  const buffer = Buffer.alloc(size, 0xff);
  for (let index = 0x0800; index < size - 0x0800; index += 1) {
    buffer[index] = (index * 31 + Math.floor(index / 17)) % 256;
  }
  Buffer.from("SAFE_FAKE_NOT_FLASHABLE BOSCH EDC17C50 SWFAKE0001 HWFAKE0001").copy(buffer, 0x40);
  return buffer;
}

function patchRegion(buffer: Buffer, start: number, length: number, delta: number) {
  for (let offset = start; offset < start + length && offset < buffer.length; offset += 1) {
    buffer[offset] = (buffer[offset] + delta + 256) % 256;
  }
}

function region(id: string, start: number, size: number): ChangedRegionInput {
  return {
    id,
    offset_start: start,
    offset_end: start + size - 1,
    size,
    changed_byte_count: size,
  };
}

function definition(
  definitionSetId: string,
  id: string,
  mapName: string,
  category: (typeof mapCategories)[number],
  start: number,
  size: number,
  verified = true
): MapDefinition {
  return {
    id,
    definition_set_id: definitionSetId,
    map_name: mapName,
    category,
    offset_start: start,
    offset_end: start + size - 1,
    rows: 16,
    cols: 16,
    data_type: "uint16",
    endian: "big",
    factor: 1,
    unit: category === "boost_request" ? "mbar" : category === "rail_pressure" ? "bar" : "raw",
    axis_x: null,
    axis_y: null,
    description: "Synthetic test-only map definition. Not a real ECU map.",
    confidence_score: verified ? 92 : 55,
    human_verified: verified,
    active: true,
  };
}

export function buildSyntheticFixture(type: SyntheticFixtureType): SyntheticFixture {
  const ori = baseBuffer();
  const mod = Buffer.from(ori);
  const fixtureId = `synthetic-${type}-${hashId(type)}`;
  const definitionSetId = `set-${hashId(`${type}-definitions`)}`;
  const definitionSet: MapDefinitionSet = {
    id: definitionSetId,
    name: `Synthetic ${type} EDC17C50 definitions`,
    ecu_family: "EDC17",
    ecu_type: "Bosch EDC17C50",
    sw_number: "SWFAKE0001",
    hw_number: "HWFAKE0001",
    vehicle_brand: "Synthetic",
    vehicle_model: "Fixture",
    engine: "3.0d fake",
    source_type: "research",
    confidence_score: 85,
    human_verified: true,
    active: true,
  };
  const definitions = [
    definition(definitionSetId, "def-driver-wish", "Driver wish fake map", "driver_wish", 0x2000, 0x120),
    definition(definitionSetId, "def-torque-limiter", "Torque limiter fake map", "torque_limiter", 0x2400, 0x160),
    definition(definitionSetId, "def-boost-request", "Boost request fake map", "boost_request", 0x3000, 0x140),
    definition(definitionSetId, "def-egr", "EGR switch fake area", "egr", 0x3a00, 0x80),
    definition(definitionSetId, "def-dtc", "DTC table fake area", "dtc", 0x4200, 0x120),
    definition(definitionSetId, "def-checksum", "Checksum fake footer", "checksum", 0x7800, 0x40, false),
  ];
  let changedRegions: ChangedRegionInput[] = [];
  let serviceLabels: TrainingFeature[] = [];

  if (type === "stage1_like") {
    patchRegion(mod, 0x2000, 0x80, 6);
    patchRegion(mod, 0x2400, 0x90, 8);
    patchRegion(mod, 0x3000, 0x70, 4);
    changedRegions = [region("driver-wish-change", 0x2000, 0x80), region("torque-change", 0x2400, 0x90), region("boost-change", 0x3000, 0x70)];
    serviceLabels = ["stage1"];
  } else if (type === "egr_off_like") {
    patchRegion(mod, 0x3a10, 0x40, -12);
    changedRegions = [region("egr-change", 0x3a10, 0x40)];
    serviceLabels = ["egr_off"];
  } else if (type === "dtc_off_like") {
    patchRegion(mod, 0x4210, 0x60, 0x22);
    patchRegion(mod, 0x4270, 0x20, 0x11);
    changedRegions = [region("dtc-change-a", 0x4210, 0x60), region("dtc-change-b", 0x4270, 0x20)];
    serviceLabels = ["dtc_off"];
  } else {
    patchRegion(mod, 0x7800, 0x20, 1);
    changedRegions = [region("checksum-change", 0x7800, 0x20)];
    serviceLabels = [];
  }

  const expectedAttributions = changedRegions.map((changed) => {
    const matched = definitions.find((item) =>
      changed.offset_start <= item.offset_end && changed.offset_end >= item.offset_start
    );
    return {
      changed_region_id: changed.id ?? `${changed.offset_start}-${changed.offset_end}`,
      category: matched?.category ?? "unknown",
      map_name: matched?.map_name ?? "Unknown",
    };
  });

  return {
    fixture_id: fixtureId,
    fixture_type: type,
    safe_fake_binary: true,
    not_flashable: true,
    ecu_family: "EDC17",
    ecu_type: "Bosch EDC17C50",
    sw_number: "SWFAKE0001",
    hw_number: "HWFAKE0001",
    service_labels: serviceLabels,
    ori,
    mod,
    changed_regions: changedRegions,
    definition_set: definitionSet,
    map_definitions: definitions,
    expected_attributions: expectedAttributions,
    summary: "Synthetic binary fixture for tests only. This is not a real ECU file and must never be flashed.",
  };
}

export function buildSyntheticFixtureCatalog() {
  return [
    buildSyntheticFixture("stage1_like"),
    buildSyntheticFixture("egr_off_like"),
    buildSyntheticFixture("dtc_off_like"),
    buildSyntheticFixture("checksum_like"),
  ];
}

export const demoFixtureVersion = "level-0-v1";

function createOriBuffer() {
  const buffer = Buffer.alloc(4096, 0xff);
  for (let index = 256; index < buffer.length - 128; index += 1) {
    buffer[index] = (index * 29 + Math.floor(index / 17)) % 256;
  }
  Buffer.from("MG_AUTOTECH_DEMO BOSCH EDC17C50 HW0281031234 SW1037550001").copy(buffer, 32);
  return buffer;
}

function changedCopy(ori: Buffer, ranges: Array<{ start: number; end: number; delta: number }>) {
  const output = Buffer.from(ori);
  for (const range of ranges) {
    for (let index = range.start; index < range.end; index += 1) {
      output[index] = (output[index] + range.delta + (index % 3)) % 256;
    }
  }
  return output;
}

export function buildDemoBinaryFixtures() {
  const ori = createOriBuffer();
  return {
    "ori_same_size.bin": ori,
    "mod_same_size_stage1_like.bin": changedCopy(ori, [
      { start: 1024, end: 1184, delta: 9 },
      { start: 2048, end: 2144, delta: 5 },
      { start: 2816, end: 2880, delta: 3 },
    ]),
    "mod_same_size_vmax_like.bin": changedCopy(ori, [
      { start: 3072, end: 3088, delta: 24 },
    ]),
    "mod_same_size_pop_like.bin": changedCopy(ori, [
      { start: 1504, end: 1520, delta: 13 },
      { start: 1600, end: 1616, delta: 13 },
      { start: 1696, end: 1712, delta: 13 },
      { start: 1792, end: 1808, delta: 13 },
    ]),
    "mod_different_size.bin": Buffer.concat([ori, Buffer.alloc(128, 0x5a)]),
    "empty_invalid.bin": Buffer.alloc(0),
  } as const;
}

export function isAiTrainingDemoEnabled(
  env?: Record<string, string | undefined>
) {
  const source = env ?? (process.env as unknown as Record<string, string | undefined>);
  return source.ENABLE_AI_TRAINING_DEMO?.trim().toLowerCase() === "true";
}

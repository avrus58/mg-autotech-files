#!/usr/bin/env node
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_OUT = "data/ai-dataset-fixture";

function parseArgs(argv) {
  const args = {
    out: DEFAULT_OUT,
    clean: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--out") args.out = argv[++index] || DEFAULT_OUT;
    else if (value === "--clean") args.clean = true;
  }
  return args;
}

function fakeBytes(seed, size) {
  const buffer = Buffer.alloc(size);
  for (let index = 0; index < size; index += 1) {
    buffer[index] = (seed.charCodeAt(index % seed.length) + index * 17) % 256;
  }
  return buffer;
}

function patchedBytes(source, patches) {
  const buffer = Buffer.from(source);
  for (const [offset, value] of patches) {
    if (offset >= 0 && offset < buffer.length) buffer[offset] = value;
  }
  return buffer;
}

const bmwOri = fakeBytes("BMW_EDC17_ORI_SAFE_FAKE", 256);
const bmwStage1Mod = patchedBytes(bmwOri, [
  [48, 0x51],
  [49, 0x52],
  [120, 0x62],
  [121, 0x63],
  [180, 0x74],
]);
const mercedesOri = fakeBytes("MERCEDES_ORIGINAL_SAFE_FAKE", 192);
const mercedesEgrMod = patchedBytes(mercedesOri, [
  [32, 0x00],
  [33, 0x00],
  [34, 0x00],
  [96, 0x7a],
]);

const fixtureFiles = [
  {
    path: "BMW/EDC17/BMW_EDC17_ORI.bin",
    content: bmwOri,
  },
  {
    path: "BMW/EDC17/BMW_EDC17_STAGE1_MOD.bin",
    content: bmwStage1Mod,
  },
  {
    path: "Mercedes/Delco/Mercedes_EGR_OFF.mod",
    content: mercedesEgrMod,
  },
  {
    path: "Mercedes/Delco/Mercedes_ORIGINAL.ori",
    content: mercedesOri,
  },
  {
    path: "Duplicates/duplicate_a.mod",
    content: fakeBytes("DUPLICATE_SAFE_FAKE", 128),
  },
  {
    path: "Duplicates/duplicate_b.mod",
    content: fakeBytes("DUPLICATE_SAFE_FAKE", 128),
  },
  {
    path: "Archives/provider_package.zip",
    content: Buffer.from("SAFE SYNTHETIC ARCHIVE PLACEHOLDER - NOT A REAL ZIP\n", "utf8"),
  },
  {
    path: "Unsupported/readme.txt",
    content: Buffer.from("Safe synthetic dataset fixture. No real ECU data.\n", "utf8"),
  },
];

export async function createFixture(options) {
  const root = resolve(options.out || DEFAULT_OUT);
  if (options.clean) await rm(root, { recursive: true, force: true });
  await mkdir(root, { recursive: true });

  for (const file of fixtureFiles) {
    const target = join(root, file.path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, file.content);
  }

  const manifest = {
    generated_at: new Date().toISOString(),
    safe_fake_binary: true,
    not_flashable: true,
    raw_customer_data: false,
    files: fixtureFiles.map((file) => file.path),
    usage: `node scripts/scan-ai-dataset.mjs --root "${root}" --out data/ai-dataset-fixture-scan.jsonl`,
  };
  await writeFile(join(root, "fixture-manifest.json"), JSON.stringify(manifest, null, 2));
  return { root, ...manifest };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  createFixture(parseArgs(process.argv.slice(2))).then((summary) => {
    console.log(JSON.stringify(summary, null, 2));
  }).catch((error) => {
    console.error(`[error] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}

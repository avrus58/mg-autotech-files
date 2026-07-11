#!/usr/bin/env node
import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, relative, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

const SUPPORTED_EXTENSIONS = new Set([".bin", ".ori", ".mod", ".hex", ".frf", ".sgo", ".zip", ".rar", ".7z", ".a2l", ".xdf", ".csv", ".json"]);
const ARCHIVE_EXTENSIONS = new Set([".zip", ".rar", ".7z"]);
const DEFAULT_PROGRESS_EVERY = 100;
const QUICK_HASH_BYTES = 64 * 1024;

export function parseArgs(argv) {
  const args = {
    datasetRoot: process.env.DATASET_ROOT || "",
    out: "data/ai-dataset-scan.jsonl",
    limit: Number.POSITIVE_INFINITY,
    dryRun: false,
    extensions: null,
    progressEvery: DEFAULT_PROGRESS_EVERY,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--root") args.datasetRoot = argv[++index] || "";
    else if (value === "--out") args.out = argv[++index] || args.out;
    else if (value === "--limit") args.limit = Number(argv[++index] || 0) || Number.POSITIVE_INFINITY;
    else if (value === "--dry-run") args.dryRun = true;
    else if (value === "--extensions") {
      args.extensions = new Set((argv[++index] || "").split(",").map((entry) => normalizeExtension(entry)).filter(Boolean));
    } else if (value === "--progress-every") {
      args.progressEvery = Math.max(1, Number(argv[++index] || DEFAULT_PROGRESS_EVERY) || DEFAULT_PROGRESS_EVERY);
    }
  }
  return args;
}

function normalizeExtension(value) {
  const trimmed = String(value || "").trim().toLowerCase();
  if (!trimmed) return "";
  return trimmed.startsWith(".") ? trimmed : `.${trimmed}`;
}

function toRelativePath(root, filePath) {
  return relative(root, filePath).split(sep).join("/");
}

function formatGb(bytes) {
  return Number((bytes / 1024 / 1024 / 1024).toFixed(3));
}

function normalizeText(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function guessFileRoleFromPath(relativePath) {
  const text = normalizeText(relativePath);
  if (/\b(ori|original|stock|read|backup)\b/.test(text)) return "ori";
  if (/\b(mod|tuned|stage\s*1|stage\s*2|stage\s*3|egr|dpf|adblue|dtc|vmax|tcu)\b/.test(text)) return "mod";
  return "unknown";
}

export function guessServiceLabelsFromPath(relativePath) {
  const text = normalizeText(relativePath);
  const labels = new Set();
  if (/\bstage\s*1\b|\bstg\s*1\b|\bstage1\b/.test(text)) labels.add("stage1");
  if (/\bstage\s*2\b|\bstg\s*2\b|\bstage2\b/.test(text)) labels.add("stage2");
  if (/\begr\b/.test(text)) labels.add("egr_off");
  if (/\bdpf\b/.test(text)) labels.add("dpf_off");
  if (/\badblue\b|\bscr\b/.test(text)) labels.add("adblue_off");
  if (/\bdtc\b|\bp[0-9]{4}\b/.test(text)) labels.add("dtc_off");
  if (/\bvmax\b|speed\s*limit/.test(text)) labels.add("vmax_off");
  if (/\btcu\b|\bdsg\b|\bgearbox\b/.test(text)) labels.add("tcu");
  return [...labels];
}

export function guessEcuMetadataFromPath(relativePath) {
  const normalized = relativePath.replace(/\\/g, "/");
  const upper = normalized.toUpperCase();
  const ecuFamilies = ["EDC17", "EDC16", "MD1", "MG1", "MED17", "MEVD", "SIMOS", "SID", "PCR", "DCM", "DELPHI", "DELCO", "DENSO", "ZF", "TCU"];
  const family = ecuFamilies.find((candidate) => upper.includes(candidate)) || null;
  const typeMatch = upper.match(/\b(?:BOSCH\s*)?(EDC17C[0-9A-Z]+|EDC16[0-9A-Z]+|MD1[A-Z0-9]+|MG1[A-Z0-9]+|MED17[0-9A-Z.]*|SIMOS[0-9A-Z.]*|SID[0-9A-Z]+|DCM[0-9A-Z.]+|PCR[0-9A-Z.]+|E[0-9]{2}|6HP|8HP)\b/);
  const swMatch = normalized.match(/\b(?:SW|software|soft)[_\s-]*([A-Z0-9.]{5,32})\b/i) || normalized.match(/\b(1037[0-9A-Z]{6,16})\b/i);
  const hwMatch = normalized.match(/\b(?:HW|hardware)[_\s-]*([A-Z0-9.]{5,32})\b/i);
  return {
    guessed_ecu_family: family,
    guessed_ecu_type: typeMatch?.[1] || null,
    guessed_sw_number: swMatch?.[1] || null,
    guessed_hw_number: hwMatch?.[1] || null,
  };
}

async function hashFile(filePath, size) {
  const sha = createHash("sha256");
  await new Promise((resolvePromise, rejectPromise) => {
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => sha.update(chunk));
    stream.on("error", rejectPromise);
    stream.on("end", resolvePromise);
  });
  const quick = createHash("sha256");
  quick.update(String(size));
  if (size > 0) {
    const first = await readChunk(filePath, 0, Math.min(QUICK_HASH_BYTES, size));
    quick.update(first);
    if (size > QUICK_HASH_BYTES) {
      const last = await readChunk(filePath, Math.max(0, size - QUICK_HASH_BYTES), Math.min(QUICK_HASH_BYTES, size));
      quick.update(last);
    }
  }
  return { sha256: sha.digest("hex"), quick_hash: quick.digest("hex") };
}

async function readChunk(filePath, start, length) {
  const handle = await import("node:fs/promises").then((fs) => fs.open(filePath, "r"));
  try {
    const buffer = Buffer.alloc(length);
    const result = await handle.read(buffer, 0, length, start);
    return buffer.subarray(0, result.bytesRead);
  } finally {
    await handle.close();
  }
}

async function* walkFiles(root) {
  const stack = [root];
  while (stack.length) {
    const current = stack.pop();
    let entries = [];
    try {
      entries = await import("node:fs/promises").then((fs) => fs.readdir(current, { withFileTypes: true }));
    } catch (error) {
      yield { type: "walk_error", path: current, error };
      continue;
    }
    for (const entry of entries) {
      const entryPath = join(current, entry.name);
      if (entry.isDirectory()) stack.push(entryPath);
      else if (entry.isFile()) yield { type: "file", path: entryPath };
    }
  }
}

function emptySummary(root, outPath) {
  return {
    dataset_root_label: basename(root),
    dataset_root_hash: createHash("sha256").update(resolve(root)).digest("hex").slice(0, 16),
    output_jsonl: outPath,
    generated_at: new Date().toISOString(),
    total_files: 0,
    scanned_entries: 0,
    skipped_by_extension: 0,
    total_size_bytes: 0,
    total_size_gb: 0,
    supported_files: 0,
    unsupported_files: 0,
    duplicate_files: 0,
    archive_candidates: 0,
    error_count: 0,
    warning_count: 0,
    guessed_ori_count: 0,
    guessed_mod_count: 0,
    unknown_role_count: 0,
    service_label_distribution: {},
    ecu_guess_distribution: {},
    errors: [],
    warnings: [],
  };
}

function addDistribution(target, values) {
  for (const value of values.filter(Boolean)) target[value] = (target[value] || 0) + 1;
}

export async function scanDataset(options) {
  const root = resolve(options.datasetRoot || "");
  if (!options.datasetRoot) throw new Error("DATASET_ROOT or --root is required.");
  const rootStat = await stat(root);
  if (!rootStat.isDirectory()) throw new Error(`Dataset root is not a directory: ${root}`);

  const outPath = resolve(options.out);
  const summaryPath = outPath.replace(/\.jsonl$/i, ".summary.json");
  const tmpDir = await mkdtemp(join(tmpdir(), "mg-ai-dataset-"));
  const tmpPath = join(tmpDir, "scan.tmp.jsonl");
  await mkdir(dirname(outPath), { recursive: true });
  const tmpStream = createWriteStream(tmpPath, { encoding: "utf8" });
  const summary = emptySummary(root, outPath);
  const hashCounts = new Map();
  const extensionFilter = options.extensions || null;
  let scannedEntries = 0;

  for await (const entry of walkFiles(root)) {
    if (entry.type === "walk_error") {
      summary.error_count += 1;
      summary.errors.push({ path: toRelativePath(root, entry.path), error: entry.error instanceof Error ? entry.error.message : String(entry.error) });
      continue;
    }
    if (summary.total_files >= options.limit) break;
    const filePath = entry.path;
    const relativePath = toRelativePath(root, filePath);
    const extension = normalizeExtension(extname(filePath));
    if (extensionFilter && !extensionFilter.has(extension)) {
      scannedEntries += 1;
      summary.scanned_entries = scannedEntries;
      summary.skipped_by_extension += 1;
      continue;
    }
    const warnings = [];
    const errors = [];
    let fileStat;
    try {
      fileStat = await stat(filePath);
    } catch (error) {
      summary.error_count += 1;
      summary.errors.push({ path: relativePath, error: error instanceof Error ? error.message : String(error) });
      continue;
    }
    const supported = SUPPORTED_EXTENSIONS.has(extension);
    const archiveCandidate = ARCHIVE_EXTENSIONS.has(extension);
    if (!supported) warnings.push("Unsupported extension recorded for visibility; it will not become trusted learning evidence.");
    if (archiveCandidate) warnings.push("Archive candidate only; contents were not extracted.");
    let hashes;
    try {
      hashes = await hashFile(filePath, fileStat.size);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
      hashes = { sha256: "", quick_hash: "" };
    }
    const role = guessFileRoleFromPath(relativePath);
    const labels = guessServiceLabelsFromPath(relativePath);
    const ecu = guessEcuMetadataFromPath(relativePath);
    const metadata = {
      relative_path: relativePath,
      filename: basename(filePath),
      extension: extension.replace(/^\./, ""),
      file_size: fileStat.size,
      sha256: hashes.sha256,
      quick_hash: hashes.quick_hash,
      modified_at: fileStat.mtime.toISOString(),
      guessed_file_role: role,
      guessed_service_labels: labels,
      ...ecu,
      duplicate_hash_group: null,
      archive_candidate: archiveCandidate,
      supported,
      warnings,
      errors,
    };
    tmpStream.write(`${JSON.stringify(metadata)}\n`);
    if (hashes.sha256) hashCounts.set(hashes.sha256, (hashCounts.get(hashes.sha256) || 0) + 1);
    summary.total_files += 1;
    summary.total_size_bytes += fileStat.size;
    if (supported) summary.supported_files += 1;
    else summary.unsupported_files += 1;
    if (archiveCandidate) summary.archive_candidates += 1;
    if (role === "ori") summary.guessed_ori_count += 1;
    else if (role === "mod") summary.guessed_mod_count += 1;
    else summary.unknown_role_count += 1;
    summary.warning_count += warnings.length;
    summary.error_count += errors.length;
    for (const warning of warnings) summary.warnings.push({ path: relativePath, warning });
    for (const error of errors) summary.errors.push({ path: relativePath, error });
    addDistribution(summary.service_label_distribution, labels);
    addDistribution(summary.ecu_guess_distribution, [ecu.guessed_ecu_type || ecu.guessed_ecu_family]);
    scannedEntries += 1;
    summary.scanned_entries = scannedEntries;
    if (summary.total_files % options.progressEvery === 0) {
      console.error(`[scan] files=${summary.total_files} skipped=${summary.skipped_by_extension} duplicates=${summary.duplicate_files} errors=${summary.error_count} size_gb=${formatGb(summary.total_size_bytes)} current=${relativePath}`);
    }
  }
  await new Promise((resolvePromise, rejectPromise) => {
    tmpStream.end((error) => error ? rejectPromise(error) : resolvePromise());
  });

  const duplicateGroups = new Map();
  let groupIndex = 0;
  for (const [hash, count] of hashCounts.entries()) {
    if (count > 1) {
      groupIndex += 1;
      duplicateGroups.set(hash, `dup-${String(groupIndex).padStart(5, "0")}`);
      summary.duplicate_files += count;
    }
  }

  if (!options.dryRun) {
    const finalStream = createWriteStream(outPath, { encoding: "utf8" });
    const reader = createInterface({
      input: createReadStream(tmpPath, { encoding: "utf8" }),
      crlfDelay: Number.POSITIVE_INFINITY,
    });
    for await (const line of reader) {
      if (!line) continue;
      const row = JSON.parse(line);
      row.duplicate_hash_group = duplicateGroups.get(row.sha256) || null;
      if (row.duplicate_hash_group && !row.warnings.includes("Duplicate SHA-256 hash detected in scan.")) {
        row.warnings.push("Duplicate SHA-256 hash detected in scan.");
      }
      finalStream.write(`${JSON.stringify(row)}\n`);
    }
    await new Promise((resolvePromise, rejectPromise) => finalStream.end((error) => error ? rejectPromise(error) : resolvePromise()));
  }
  summary.total_size_gb = formatGb(summary.total_size_bytes);
  await writeFile(summaryPath, JSON.stringify(summary, null, 2));
  await rm(tmpDir, { recursive: true, force: true });
  console.error(`[summary] files=${summary.total_files} scanned_entries=${summary.scanned_entries} skipped=${summary.skipped_by_extension} supported=${summary.supported_files} unsupported=${summary.unsupported_files} duplicates=${summary.duplicate_files} archives=${summary.archive_candidates} errors=${summary.error_count} warnings=${summary.warning_count} size_gb=${summary.total_size_gb}`);
  if (options.dryRun) {
    console.error("[dry-run] JSONL output was not written. Summary JSON was written for inspection.");
  }
  return summary;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  scanDataset(parseArgs(process.argv.slice(2))).catch((error) => {
    console.error(`[error] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}

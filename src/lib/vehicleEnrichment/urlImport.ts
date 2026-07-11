import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { ExternalVehicleEntry } from "@/lib/vehicleEnrichment/types";
import { parseVehicleEnrichmentEntries } from "@/lib/vehicleEnrichment/parseInput";

export type VehicleUrlSourceType = "auto" | "html" | "json" | "csv" | "text";

export type VehicleUrlExtractionResult = {
  title: string | null;
  detectedRows: number;
  detectedItems: number;
  candidates: ExternalVehicleEntry[];
  warnings: string[];
  errors: string[];
  confidence: number;
  contentType: string | null;
};

export type VehicleUrlFetchResult = VehicleUrlExtractionResult & {
  finalUrl: string;
  sourceUrl: string;
  fetchedBytes: number;
};

const maxUrlFetchBytes = 1024 * 1024;
const requestTimeoutMs = 10_000;
const redirectStatuses = new Set([301, 302, 303, 307, 308]);

function lowerKeys(record: Record<string, unknown>) {
  const output = new Map<string, unknown>();
  for (const [key, value] of Object.entries(record)) {
    output.set(key.trim().toLowerCase().replace(/[\s_-]+/g, ""), value);
  }
  return output;
}

function valueFrom(record: Map<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record.get(key.toLowerCase().replace(/[\s_-]+/g, ""));
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

function stripHtml(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function titleFromHtml(html: string) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? stripHtml(match[1]) : null;
}

function textTitle(text: string) {
  const line = text.split(/\r?\n/).map((item) => item.trim()).find(Boolean);
  return line ? line.slice(0, 160) : null;
}

function normalizeRecord(record: Record<string, unknown>, fallback: { sourceUrl: string; sourceName?: string | null }): ExternalVehicleEntry | null {
  const row = lowerKeys(record);
  const rawTitle = valueFrom(row, ["rawTitle", "title", "name", "vehicle", "description"]) ?? null;
  const brand = valueFrom(row, ["brand", "make", "manufacturer", "marque"]) ?? guessBrand(rawTitle ?? "");
  const model = valueFrom(row, ["model", "series", "modelName"]) ?? guessModel(rawTitle ?? "", brand ?? "");
  const engineDisplayName = valueFrom(row, ["engineDisplayName", "engine", "engineName", "variant", "trim", "modification"]) ?? null;
  const entry: ExternalVehicleEntry = {
    brand: brand ?? "",
    model: model ?? "",
    rawTitle,
    rawModel: valueFrom(row, ["rawModel"]) ?? null,
    rawGeneration: valueFrom(row, ["rawGeneration", "generation", "chassis", "platform", "bodychassis"]) ?? null,
    rawBodyType: valueFrom(row, ["rawBodyType", "bodyType", "body", "bodyStyle"]) ?? null,
    rawYearRange: valueFrom(row, ["rawYearRange", "years", "yearRange", "production", "modelYears"]) ?? null,
    rawPowerRange: valueFrom(row, ["rawPowerRange", "powerRange"]) ?? null,
    engineDisplayName,
    engineCodeText: valueFrom(row, ["engineCodeText", "engineCode", "engineModelCode", "code"]) ?? null,
    displacementText: valueFrom(row, ["displacementText", "displacement", "engineDisplacement", "cc"]) ?? null,
    powerText: valueFrom(row, ["powerText", "power", "hp", "horsepower", "kw"]) ?? null,
    torqueText: valueFrom(row, ["torqueText", "torque", "nm"]) ?? null,
    fuelType: valueFrom(row, ["fuelType", "fuel", "fuelSystem"]) ?? null,
    drivetrain: valueFrom(row, ["drivetrain", "drive", "driveType"]) ?? null,
    transmission: valueFrom(row, ["transmission", "gearbox"]) ?? null,
    hybridType: valueFrom(row, ["hybridType", "hybrid"]) ?? null,
    sourceUrl: valueFrom(row, ["sourceUrl", "url", "reference"]) ?? fallback.sourceUrl,
  };

  if (!entry.brand && !entry.model && !entry.rawTitle && !entry.engineDisplayName) return null;
  return entry;
}

function guessBrand(text: string) {
  const lower = text.toLowerCase();
  const known = [
    ["Mercedes-Benz", ["mercedes-benz", "mercedes benz", "mercedes"]],
    ["BMW", ["bmw"]],
    ["Volkswagen", ["volkswagen", "vw"]],
    ["Audi", ["audi"]],
    ["Porsche", ["porsche"]],
    ["Opel", ["opel"]],
    ["Ford", ["ford"]],
  ] as const;
  return known.find(([, aliases]) => aliases.some((alias) => lower.includes(alias)))?.[0] ?? null;
}

function guessModel(text: string, brand: string) {
  let cleaned = text.replace(new RegExp(brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig"), " ");
  cleaned = cleaned.replace(/\b(power|torque|engine|displacement|hp|kw|nm|petrol|diesel|hybrid)\b.*$/i, " ");
  const match = cleaned.match(/\b([A-Z0-9][A-Za-z0-9.+-]*(?:\s(?:Class|Klasse|Series|Golf|Tiguan|A5|A4|A6|E|C|S|GLC|GLE|G60|W214|B10))?)\b/);
  return match?.[1]?.trim() || null;
}

function entryFromTextLine(line: string, sourceUrl: string): ExternalVehicleEntry | null {
  const text = stripHtml(line);
  if (text.length < 12) return null;
  const brand = guessBrand(text) ?? "";
  const model = guessModel(text, brand) ?? "";
  const year = text.match(/\b(20\d{2})(?:\s*[-–]\s*(present|current|20\d{2}))?/i)?.[0] ?? null;
  const power = text.match(/(?:power[:\s]*)?\b\d{2,4}\s*(?:hp|ps|kw)\b/i)?.[0] ?? null;
  const torque = text.match(/(?:torque[:\s]*)?\b\d{2,4}\s*nm\b/i)?.[0] ?? null;
  const displacement = text.match(/\b\d(?:[.,]\d)?\s*(?:l|liter|litre)\b|\b\d{3,5}\s*(?:cm3|cm³|cc)\b/i)?.[0] ?? null;
  const fuel = text.match(/\b(diesel|petrol|gasoline|hybrid|plug-in hybrid|mild hybrid|electric)\b/i)?.[0] ?? null;
  if (!brand && !model && !power && !torque) return null;
  return {
    brand,
    model,
    rawTitle: text,
    rawGeneration: text.match(/\b[A-Z]\s?\d{2,3}\b|\b[A-Z]\d{2,3}\/[A-Z]\d{2,3}\b/)?.[0]?.replace(/\s+/g, "") ?? null,
    rawYearRange: year,
    engineDisplayName: text,
    powerText: power,
    torqueText: torque,
    displacementText: displacement,
    fuelType: fuel,
    sourceUrl,
  };
}

function parseJsonCandidates(text: string, sourceUrl: string) {
  const parsed = JSON.parse(text) as unknown;
  const arrays: unknown[] = [];
  if (Array.isArray(parsed)) arrays.push(parsed);
  if (parsed && typeof parsed === "object") {
    for (const value of Object.values(parsed as Record<string, unknown>)) {
      if (Array.isArray(value)) arrays.push(value);
    }
  }
  const rows = arrays.flat().filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item));
  return rows.map((row) => normalizeRecord(row, { sourceUrl })).filter((entry): entry is ExternalVehicleEntry => Boolean(entry));
}

function parseCsvCandidates(text: string, sourceUrl: string) {
  return parseVehicleEnrichmentEntries(text).map((entry) => ({ ...entry, sourceUrl: entry.sourceUrl ?? sourceUrl }));
}

function tableRowsFromHtml(html: string, sourceUrl: string) {
  const entries: ExternalVehicleEntry[] = [];
  let detectedRows = 0;
  const tables = [...html.matchAll(/<table[\s\S]*?<\/table>/gi)].map((match) => match[0]);
  for (const table of tables) {
    const rows = [...table.matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((match) => match[0]);
    if (rows.length < 2) continue;
    const headers = [...rows[0].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((match) => stripHtml(match[1]));
    if (!headers.length) continue;
    for (const row of rows.slice(1)) {
      const cells = [...row.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((match) => stripHtml(match[1]));
      if (cells.length < 2) continue;
      detectedRows += 1;
      const record = Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
      const entry = normalizeRecord(record, { sourceUrl });
      if (entry) entries.push(entry);
    }
  }
  return { entries, detectedRows };
}

function listItemsFromHtml(html: string, sourceUrl: string) {
  const chunks = [
    ...html.matchAll(/<(?:li|article)[^>]*>([\s\S]*?)<\/(?:li|article)>/gi),
    ...html.matchAll(/<div[^>]+class=["'][^"']*(?:card|item|vehicle|engine|model)[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi),
  ].map((match) => stripHtml(match[1]));
  const entries = chunks.map((chunk) => entryFromTextLine(chunk, sourceUrl)).filter((entry): entry is ExternalVehicleEntry => Boolean(entry));
  return { entries, detectedItems: chunks.length };
}

function confidenceFor(entries: ExternalVehicleEntry[], warnings: string[]) {
  if (!entries.length) return 0;
  const complete = entries.filter((entry) => entry.brand && entry.model && (entry.rawGeneration || entry.rawTitle) && entry.engineDisplayName).length;
  const score = Math.round((complete / entries.length) * 70) + Math.min(20, entries.length * 2) - warnings.length * 5;
  return Math.max(10, Math.min(95, score));
}

export function extractVehicleEntriesFromSource(input: {
  text: string;
  sourceUrl: string;
  sourceName?: string | null;
  sourceType?: VehicleUrlSourceType;
  contentType?: string | null;
}): VehicleUrlExtractionResult {
  const sourceType = input.sourceType ?? "auto";
  const contentType = input.contentType ?? null;
  const warnings: string[] = [];
  const errors: string[] = [];
  const title = contentType?.includes("html") || /<html|<table|<title/i.test(input.text)
    ? titleFromHtml(input.text)
    : textTitle(input.text);
  let candidates: ExternalVehicleEntry[] = [];
  let detectedRows = 0;
  let detectedItems = 0;

  try {
    if (sourceType === "json" || (sourceType === "auto" && (contentType?.includes("json") || input.text.trim().startsWith("{") || input.text.trim().startsWith("[")))) {
      candidates = parseJsonCandidates(input.text, input.sourceUrl);
      detectedRows = candidates.length;
    } else if (sourceType === "csv" || (sourceType === "auto" && (contentType?.includes("csv") || /^[^\n,]+,[^\n,]+/m.test(input.text)))) {
      candidates = parseCsvCandidates(input.text, input.sourceUrl);
      detectedRows = candidates.length;
    } else if (sourceType === "html" || (sourceType === "auto" && /<html|<table|<li|<article/i.test(input.text))) {
      const table = tableRowsFromHtml(input.text, input.sourceUrl);
      const list = listItemsFromHtml(input.text, input.sourceUrl);
      candidates = [...table.entries, ...list.entries];
      detectedRows = table.detectedRows;
      detectedItems = list.detectedItems;
      if (!table.entries.length && list.entries.length) warnings.push("No structured HTML table detected; extracted candidates from repeated list/card text.");
    } else {
      const lines = input.text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      detectedItems = lines.length;
      candidates = lines.map((line) => entryFromTextLine(line, input.sourceUrl)).filter((entry): entry is ExternalVehicleEntry => Boolean(entry));
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "URL extraction failed.");
  }

  candidates = candidates.map((entry) => ({
    ...entry,
    sourceUrl: entry.sourceUrl ?? input.sourceUrl,
  })).slice(0, 250);

  if (!candidates.length) warnings.push("No reliable vehicle candidates were extracted. Try structured JSON/CSV or paste content manually.");
  if (candidates.some((entry) => !entry.brand || !entry.model)) warnings.push("Some extracted candidates are missing brand/model and require manual review.");
  if (candidates.some((entry) => !entry.rawGeneration && !entry.rawTitle)) warnings.push("Some extracted candidates are missing generation/chassis details.");
  if (candidates.length >= 250) warnings.push("Extraction was capped at 250 candidates for safe dry-run review.");

  return {
    title,
    detectedRows,
    detectedItems,
    candidates,
    warnings,
    errors,
    confidence: confidenceFor(candidates, warnings),
    contentType,
  };
}

function isPrivateIp(address: string) {
  const normalizedAddress = address.startsWith("[") && address.endsWith("]") ? address.slice(1, -1) : address;
  const version = isIP(normalizedAddress);
  if (!version) return false;
  if (version === 6) {
    const lower = normalizedAddress.toLowerCase();
    return lower === "::1" || lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe80:") || lower === "::";
  }
  const parts = normalizedAddress.split(".").map((part) => Number.parseInt(part, 10));
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
}

export function validateVehicleSourceUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { ok: false as const, error: "Invalid source URL." };
  }
  if (!["http:", "https:"].includes(url.protocol)) return { ok: false as const, error: "Only http/https URLs are allowed." };
  const hostname = url.hostname.toLowerCase();
  if (["localhost", "localhost.localdomain"].includes(hostname) || hostname.endsWith(".localhost")) {
    return { ok: false as const, error: "Localhost URLs are blocked." };
  }
  if (hostname === "metadata.google.internal") {
    return { ok: false as const, error: "Cloud metadata URLs are blocked." };
  }
  if (isPrivateIp(hostname)) return { ok: false as const, error: "Private/internal IP addresses are blocked." };
  return { ok: true as const, url };
}

async function assertPublicNetworkTarget(url: URL) {
  const validation = validateVehicleSourceUrl(url.toString());
  if (!validation.ok) throw new Error(validation.error);
  const hostname = url.hostname.startsWith("[") && url.hostname.endsWith("]") ? url.hostname.slice(1, -1) : url.hostname;
  if (isIP(hostname)) return;
  const addresses = await lookup(hostname, { all: true, verbatim: false });
  if (!addresses.length) throw new Error("Source host could not be resolved.");
  if (addresses.some((item) => isPrivateIp(item.address))) throw new Error("Source host resolves to a private/internal IP address.");
}

async function readLimitedText(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxUrlFetchBytes) throw new Error("Source response is too large for safe one-page extraction.");
    chunks.push(value);
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(Buffer.concat(chunks));
}

export async function fetchAndExtractVehicleUrl(input: {
  sourceUrl: string;
  sourceName?: string | null;
  sourceType?: VehicleUrlSourceType;
}) {
  const current = validateVehicleSourceUrl(input.sourceUrl);
  if (!current.ok) throw new Error(current.error);
  const url = current.url;
  await assertPublicNetworkTarget(url);
  const response = await fetch(url, {
    redirect: "manual",
    signal: AbortSignal.timeout(requestTimeoutMs),
    headers: {
      Accept: "text/html,application/json,text/csv,text/plain;q=0.9,*/*;q=0.2",
      "User-Agent": "MG AutoTech Vehicle Enrichment Dry-Run/1.0",
    },
  });
  if (redirectStatuses.has(response.status)) {
    throw new Error("Source URL returned a redirect. Enter the final public URL directly for exact one-page extraction.");
  }
  if (!response.ok) throw new Error(`Source returned HTTP ${response.status}.`);
  const contentType = response.headers.get("content-type");
  const text = await readLimitedText(response);
  const extraction = extractVehicleEntriesFromSource({
    text,
    sourceUrl: url.toString(),
    sourceName: input.sourceName,
    sourceType: input.sourceType ?? "auto",
    contentType,
  });
  return {
    ...extraction,
    sourceUrl: input.sourceUrl,
    finalUrl: url.toString(),
    fetchedBytes: new TextEncoder().encode(text).byteLength,
  } satisfies VehicleUrlFetchResult;
}

#!/usr/bin/env node

/**
 * CareEcuFile vehicle database scraper
 *
 * Usage:
 *   node scripts/carecufile-scraper.mjs --brands-only
 *   node scripts/carecufile-scraper.mjs --brand-id 7 --brand-name BMW --limit-models 1 --limit-generations 1 --limit-engines 2
 *   node scripts/carecufile-scraper.mjs --brand-id 68 --brand-name Mercedes-Benz --append
 *   node scripts/carecufile-scraper.mjs --all --append
 *
 * Optional:
 *   CAREECU_COOKIE="PHPSESSID=...; cf_clearance=..." node scripts/carecufile-scraper.mjs --brand-id 7 --brand-name BMW
 *
 * Do not share your cookie with anyone.
 */

import { mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const BASE_URL = "https://carecufile.com";
const LANG = "en";
const OUTPUT_DIR = "data";
const OUTPUT_JSON = path.join(OUTPUT_DIR, "vehicle-database.json");
const OUTPUT_ERRORS = path.join(OUTPUT_DIR, "vehicle-database-errors.json");

const args = parseArgs(process.argv.slice(2));

const HEADERS = {
  "accept": "*/*",
  "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
  "x-requested-with": "XMLHttpRequest",
  "origin": BASE_URL,
  "referer": `${BASE_URL}/${LANG}`,
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari/537.36",
};

if (process.env.CAREECU_COOKIE) {
  HEADERS.cookie = process.env.CAREECU_COOKIE;
}

main().catch((error) => {
  console.error("Scraper failed:", error);
  process.exit(1);
});

async function mergeWithExistingRows(newRows) {
  const existing = await readJsonIfExists(OUTPUT_JSON, []);
  const map = new Map();

  for (const row of existing) {
    map.set(vehicleKey(row), row);
  }

  for (const row of newRows) {
    map.set(vehicleKey(row), row);
  }

  return Array.from(map.values()).sort((a, b) => {
    return [
      String(a.brand || "").localeCompare(String(b.brand || "")),
      Number(a.brandId || 0) - Number(b.brandId || 0),
      String(a.model || "").localeCompare(String(b.model || "")),
      Number(a.modelId || 0) - Number(b.modelId || 0),
      String(a.generation || "").localeCompare(String(b.generation || "")),
      Number(a.generationId || 0) - Number(b.generationId || 0),
      String(a.engine || "").localeCompare(String(b.engine || "")),
      Number(a.engineId || 0) - Number(b.engineId || 0),
    ].find((value) => value !== 0) || 0;
  });
}

async function mergeWithExistingErrors(newErrors) {
  const existing = await readJsonIfExists(OUTPUT_ERRORS, []);
  return [...existing, ...newErrors];
}

async function readJsonIfExists(filePath, fallback) {
  if (!existsSync(filePath)) return fallback;

  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function vehicleKey(row) {
  return [
    row.brandId || row.brand || "",
    row.modelId || row.model || "",
    row.generationId || row.generation || "",
    row.engineId || row.engine || "",
  ].join("|");
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });

  if (args["brands-only"]) {
    const brands = await getBrands();
    console.log(JSON.stringify(brands, null, 2));
    await writeFile(path.join(OUTPUT_DIR, "carecufile-brands.json"), JSON.stringify(brands, null, 2), "utf8");
    console.log(`Saved: ${path.join(OUTPUT_DIR, "carecufile-brands.json")}`);
    return;
  }

  let brands = [];

  if (args["brand-id"]) {
    brands = [
      {
        id: String(args["brand-id"]),
        name: args["brand-name"] ? String(args["brand-name"]) : `Brand ${args["brand-id"]}`,
      },
    ];
  } else {
    brands = await getBrands();
  }

  if (!args.all && !args["brand-id"]) {
    console.log("No --all or --brand-id given. Running safe BMW test because BMW brand id is known as 7.");
    brands = [{ id: "7", name: "BMW" }];
  }

  const limitBrands = numberArg("limit-brands", 0);
  const limitModels = numberArg("limit-models", 0);
  const limitGenerations = numberArg("limit-generations", 0);
  const limitEngines = numberArg("limit-engines", 0);

  if (limitBrands > 0) brands = brands.slice(0, limitBrands);

  const rows = [];
  const errors = [];

  for (const brand of brands) {
    console.log(`\nBrand: ${brand.name} (${brand.id})`);

    let models = [];
    try {
      models = await getModels(brand.id);
    } catch (error) {
      errors.push({ level: "models", brand, error: String(error.message || error) });
      continue;
    }

    if (limitModels > 0) models = models.slice(0, limitModels);

    for (const model of models) {
      console.log(`  Model: ${model.name} (${model.id})`);

      let generations = [];
      try {
        generations = await getGenerations(brand.id, model.id);
      } catch (error) {
        errors.push({ level: "generations", brand, model, error: String(error.message || error) });
        continue;
      }

      if (limitGenerations > 0) generations = generations.slice(0, limitGenerations);

      for (const generation of generations) {
        console.log(`    Generation: ${generation.name} (${generation.id})`);

        let engines = [];
        try {
          engines = await getEngines(brand.id, model.id, generation.id);
        } catch (error) {
          errors.push({ level: "engines", brand, model, generation, error: String(error.message || error) });
          continue;
        }

        if (limitEngines > 0) engines = engines.slice(0, limitEngines);

        for (const engine of engines) {
          const performanceUrl = `${BASE_URL}/${LANG}/Performance?b=${encodeURIComponent(
            brand.id
          )}&m=${encodeURIComponent(model.id)}&g=${encodeURIComponent(generation.id)}&mt=${encodeURIComponent(engine.id)}`;

          console.log(`      Engine: ${engine.name} (${engine.id})`);

          try {
            const html = await getText(performanceUrl);
            const parsed = parsePerformancePage(html);

            rows.push({
              source: "carecufile",
              sourceUrl: performanceUrl,
              brand: parsed.brand || brand.name,
              brandId: brand.id,
              model: model.name,
              modelId: model.id,
              generation: generation.name,
              generationId: generation.id,
              engine: parsed.engine || engine.name,
              engineId: engine.id,
              fuelType: parsed.fuelType,
              ecu: parsed.ecu,
              stage1: parsed.stage1,
              stage2: parsed.stage2,
              readMethods: parsed.readMethods,
              services: parsed.services,
              imageUrl: parsed.imageUrl,
              scrapedAt: new Date().toISOString(),
            });
          } catch (error) {
            errors.push({
              level: "performance",
              brand,
              model,
              generation,
              engine,
              url: performanceUrl,
              error: String(error.message || error),
            });
          }

          await sleep(numberArg("delay", 350));
        }
      }
    }
  }

  const finalRows = args.append ? await mergeWithExistingRows(rows) : rows;
  const finalErrors = args.append ? await mergeWithExistingErrors(errors) : errors;

  await writeFile(OUTPUT_JSON, JSON.stringify(finalRows, null, 2), "utf8");
  await writeFile(OUTPUT_ERRORS, JSON.stringify(finalErrors, null, 2), "utf8");

  console.log(`\nDone. New vehicles scraped: ${rows.length}`);
  console.log(`Total vehicles in database: ${finalRows.length}`);
  console.log(`Saved: ${OUTPUT_JSON}`);
  console.log(`Errors: ${OUTPUT_ERRORS}`);
}

async function getBrands() {
  const html = await getText(`${BASE_URL}/${LANG}`);
  const options = parseOptions(html);

  // The homepage normally has brand options first. Filter very small/noisy values out only by label.
  const blacklist = new Set(["select", "choose", "model", "generation", "engine"]);
  const brands = uniqueById(
    options.filter((item) => item.id && item.name && !blacklist.has(item.name.toLowerCase()))
  );

  if (brands.length === 0) {
    throw new Error("Could not parse brand list from homepage.");
  }

  return brands;
}

async function getModels(brandId) {
  return postAjaxOptions({
    aracmarka: brandId,
    dilNe: LANG,
  });
}

async function getGenerations(brandId, modelId) {
  const candidates = [
    { aracmodel: modelId, aracmarkacek: brandId, dilNe: LANG },
    { aracmodelcek: modelId, aracmarkacek: brandId, dilNe: LANG },
    { aracmarkacek: brandId, aracmodelcek: modelId, dilNe: LANG },
    { aracmarka: brandId, aracmodel: modelId, dilNe: LANG },
    { aracmodel: modelId, aracmarka: brandId, dilNe: LANG },
  ];

  return firstWorkingOptions(candidates, "generation", { brandId, modelId });
}

async function getEngines(brandId, modelId, generationId) {
  return postAjaxOptions({
    aracgen: generationId,
    aracmarkacek2: brandId,
    aracmodelcek: modelId,
    dilNe: LANG,
  });
}

async function firstWorkingOptions(candidates, label, meta) {
  const attempts = [];

  for (const params of candidates) {
    try {
      const options = await postAjaxOptions(params);
      attempts.push({ params, count: options.length });

      if (options.length > 0) {
        return options;
      }
    } catch (error) {
      attempts.push({ params, error: String(error.message || error) });
    }

    await sleep(150);
  }

  throw new Error(`No working ${label} payload found: ${JSON.stringify({ meta, attempts })}`);
}

async function postAjaxOptions(params) {
  const html = await postText(`${BASE_URL}/pages/ajax.php`, params);
  const options = parseOptions(html);

  if (options.length === 0) {
    const preview = cleanText(html).slice(0, 240);
    throw new Error(`No options returned. Payload=${JSON.stringify(params)} Response=${preview}`);
  }

  return options;
}

async function getText(url) {
  const response = await fetch(url, {
    method: "GET",
    headers: HEADERS,
  });

  if (!response.ok) {
    throw new Error(`GET ${url} failed: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

async function postText(url, params) {
  const body = new URLSearchParams(params).toString();

  const response = await fetch(url, {
    method: "POST",
    headers: HEADERS,
    body,
  });

  if (!response.ok) {
    throw new Error(`POST ${url} failed: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

function parsePerformancePage(html) {
  const brand = matchText(html, /<div class="name">\s*([\s\S]*?)\s*<\/div>/i);
  const modelLine = matchText(html, /<div class="model">\s*([\s\S]*?)\s*<\/div>/i);
  const imageUrl = matchText(html, /<img[^>]+src="([^"]*panel\.carecufile\.com\/assets\/images\/carimage\/[^"]+)"/i);

  const stage1Html = extractTab(html, "pills-stage1");
  const stage2Html = extractTab(html, "pills-stage2");

  const stage1 = parseStage(stage1Html);
  const stage2 = parseStage(stage2Html);

  const ecu = parseEcuList(stage1Html || html);
  const engine = parseListingSmallValue(stage1Html || html, "Engine") || modelLine?.split(" ").slice(2).join(" ");
  const fuelType = parseListingSmallValue(stage1Html || html, "Fuel Type");

  const readMethods = parseReadMethods(html);
  const services = parseServices(html);

  return {
    brand,
    modelLine,
    engine,
    fuelType,
    ecu,
    stage1,
    stage2,
    readMethods,
    services,
    imageUrl,
  };
}

function extractTab(html, tabId) {
  const start = html.indexOf(`id="${tabId}"`);
  if (start === -1) return "";

  const next = html.indexOf('<div class="tab-pane', start + 1);
  const end = next === -1 ? html.indexOf('<div class="result-reads"', start) : next;

  return html.slice(start, end === -1 ? undefined : end);
}

function parseStage(segment) {
  if (!segment) return null;

  const powerBlock = extractListingBlock(segment, "Power hp");
  const torqueBlock = extractListingBlock(segment, "Torque");

  const powerValues = extractNumericValues(powerBlock);
  const torqueValues = extractNumericValues(torqueBlock);

  return {
    stockHp: powerValues[0] ?? null,
    tunedHp: powerValues[1] ?? null,
    gainHp: powerValues[2] ?? null,
    stockNm: torqueValues[0] ?? null,
    tunedNm: torqueValues[1] ?? null,
    gainNm: torqueValues[2] ?? null,
  };
}

function extractListingBlock(html, label) {
  const index = html.toLowerCase().indexOf(label.toLowerCase());
  if (index === -1) return "";

  const start = html.lastIndexOf('<div class="listing-block"', index);
  const next = html.indexOf('<div class="listing-block"', index + 1);

  return html.slice(start === -1 ? index : start, next === -1 ? undefined : next);
}

function extractNumericValues(html) {
  if (!html) return [];

  const values = [];
  const regex = /<div[^>]*class="[^"]*\bvalue\b[^"]*"[^>]*>\s*([0-9]+(?:[.,][0-9]+)?)/gi;

  let match;
  while ((match = regex.exec(html))) {
    values.push(Number(String(match[1]).replace(",", ".")));
  }

  return values;
}

function parseEcuList(html) {
  const block = extractListingBlock(html, "Ecu");
  const values = [];

  const regex = /class="value small-value"[^>]*>\s*([\s\S]*?)\s*<\/div>/gi;
  let match;

  while ((match = regex.exec(block))) {
    const value = cleanText(match[1]);
    if (value && !values.includes(value)) values.push(value);
  }

  return values;
}

function parseListingSmallValue(html, label) {
  const block = extractListingBlock(html, label);
  const value = matchText(block, /class="value small-value"[^>]*>\s*([\s\S]*?)\s*<\/div>/i);
  return value || null;
}

function parseReadMethods(html) {
  const start = html.indexOf('<div class="result-reads"');
  if (start === -1) return [];

  const end = html.indexOf('<div class="result-content"', start);
  const section = html.slice(start, end === -1 ? undefined : end);
  const blocks = section.split('<div class="listing-block"').slice(1);
  const result = [];

  for (const rawBlock of blocks) {
    const block = `<div class="listing-block"${rawBlock}`;
    const brand = matchText(block, /<div[^>]*class="brand"[^>]*>\s*([\s\S]*?)\s*<\/div>/i);
    const type = matchText(block, /<div[^>]*class="type"[^>]*>\s*([\s\S]*?)\s*<\/div>/i);
    const name = matchText(block, /<div[^>]*class="name"[^>]*>\s*([\s\S]*?)\s*<\/div>/i);

    const value = cleanText([brand, type].filter(Boolean).join(" ")) || name;

    if (value && !result.includes(value)) result.push(value);
  }

  return result;
}

function parseServices(html) {
  const start = html.indexOf("This car can do the following");
  if (start === -1) return [];

  const end = html.indexOf("</main>", start);
  const section = html.slice(start, end === -1 ? undefined : end);

  const services = [];
  const regex = /assets\/images\/services\/([^".]+)\.[a-z0-9]+/gi;

  let match;
  while ((match = regex.exec(section))) {
    const service = mapServiceSlug(match[1]);
    if (service && !services.includes(service)) services.push(service);
  }

  return services;
}

function mapServiceSlug(slug) {
  const normalized = slug.toLowerCase();

  if (normalized.includes("adblue")) return "AdBlue OFF";
  if (normalized.includes("chip-tuning-stage-1")) return "Stage 1";
  if (normalized.includes("dpf") || normalized.includes("fap")) return "DPF OFF";
  if (normalized.includes("dtc")) return "DTC OFF";
  if (normalized.includes("egr")) return "EGR OFF";
  if (normalized.includes("popbang") || normalized.includes("pop")) return "Pops & Bangs";
  if (normalized.includes("vmax") || normalized.includes("speed-limiter")) return "VMAX OFF";
  if (normalized.includes("launch")) return "Launch Control";

  return titleCase(slug.replaceAll("-", " "));
}

function parseOptions(html) {
  const options = [];
  const regex = /<option\b([^>]*)>([\s\S]*?)<\/option>/gi;

  let match;
  while ((match = regex.exec(html))) {
    const attrs = match[1] || "";
    const label = cleanText(match[2]);
    const valueMatch = attrs.match(/\bvalue=(["'])(.*?)\1/i);
    const id = valueMatch ? cleanText(valueMatch[2]) : "";

    if (!id || !label || /^select$/i.test(label)) continue;

    options.push({ id, name: label });
  }

  return uniqueById(options);
}

function uniqueById(list) {
  const seen = new Set();
  const result = [];

  for (const item of list) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    result.push(item);
  }

  return result;
}

function matchText(html, regex) {
  const match = html.match(regex);
  return match ? cleanText(match[1]) : "";
}

function cleanText(input) {
  return String(input || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#160;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseArgs(argv) {
  const result = {};

  for (let i = 0; i < argv.length; i++) {
    const item = argv[i];

    if (!item.startsWith("--")) continue;

    const key = item.slice(2);
    const next = argv[i + 1];

    if (!next || next.startsWith("--")) {
      result[key] = true;
    } else {
      result[key] = next;
      i++;
    }
  }

  return result;
}

function numberArg(name, fallback) {
  const value = args[name];

  if (value === undefined || value === true) return fallback;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function titleCase(value) {
  return String(value)
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

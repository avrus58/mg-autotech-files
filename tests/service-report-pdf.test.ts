import assert from "node:assert/strict";
import test from "node:test";
import { inflateSync } from "node:zlib";
import sharp from "sharp";
import { renderServiceReportPdf } from "../src/lib/serviceReports/pdf";
import { reportFixture } from "./helpers/service-report-fixture";

function assertPdfStructure(pdf: Buffer) {
  const source = pdf.toString("latin1");
  assert.match(source, /^%PDF-1\.[3-7]/);
  assert.match(source, /%%EOF\s*$/);
  assert.ok(pdf.length > 5000 && pdf.length < 20 * 1024 * 1024);
  const pages = source.match(/\/Type \/Page\b/g) ?? [];
  assert.ok(pages.length >= 1 && pages.length <= 2, `Unexpected standard report page count: ${pages.length}`);
  assert.match(source, /\/FontFile2\b/);
  assert.match(source, /\/ToUnicode\b/);
  assert.match(source, /\/BaseFont \/[^\s]+NotoSans/);
  assert.doesNotMatch(source, /<html\b|<!doctype html|\/JavaScript\b|\/Launch\b/i);
  // Private identity must not appear in document metadata either as ASCII or
  // UTF-16BE. Body extraction and bounding boxes are checked by the parser QA.
  const privateId = reportFixture.customerId;
  const privateHex = [...privateId].map((char) => char.charCodeAt(0).toString(16).padStart(4, "0")).join("");
  assert.ok(!source.includes(privateId));
  assert.ok(!source.toLowerCase().includes(privateHex));
}

function unicodeMaps(pdf: Buffer): string {
  const source = pdf.toString("latin1");
  const maps: string[] = [];
  // Inspect only this pinned renderer's deflated streams, not an arbitrary PDF
  // parser. Release QA additionally uses a real parser for full extracted text.
  for (const marker of source.matchAll(/\bstream\r?\n/g)) {
    const start = marker.index + marker[0].length;
    const end = source.indexOf("endstream", start);
    if (end < start) continue;
    try {
      const decoded = inflateSync(pdf.subarray(start, end), { maxOutputLength: 16 * 1024 * 1024 }).toString("utf8");
      if (decoded.includes("begincmap")) maps.push(decoded);
    } catch {
      // Image streams may have a different codec; they are not text maps.
    }
  }
  assert.ok(maps.length > 0, "Embedded fonts need readable Unicode mappings");
  return maps.join("\n");
}

test("the production renderer creates binary Unicode-font PDFs with and without optional branding", { timeout: 90_000 }, async () => {
  const logo = await sharp({ create: { width: 16, height: 16, channels: 4, background: "#b1121b" } }).png().toBuffer();
  for (const locale of ["en", "zh", "tr"] as const) {
    const pdf = await renderServiceReportPdf(reportFixture, locale, locale === "en" ? logo : null);
    assertPdfStructure(pdf);
    assert.match(pdf.toString("latin1"), /NotoSansSC/);
    if (locale === "tr") {
      const mappings = unicodeMaps(pdf);
      // Composite-glyph cache poisoning previously dropped dotless ı and Y
      // from Yıl, plus accents in searchable/copyable report text.
      for (const codePoint of ["0131", "0059", "011f", "015f", "00fc"]) {
        assert.ok(mappings.includes(`<${codePoint}>`), `Missing Turkish Unicode map: ${codePoint}`);
      }
    }
  }
});

test("the real PDF renderer handles absent optional metrics without changing the snapshot", { timeout: 90_000 }, async () => {
  const empty = structuredClone(reportFixture);
  empty.workshop.name = null;
  empty.performedServices = [];
  empty.performance = { beforeHp: null, afterHp: null, beforeNm: null, afterNm: null, source: null, sourceNote: "" };
  const before = structuredClone(empty);
  assertPdfStructure(await renderServiceReportPdf(empty, "en"));
  assert.deepEqual(empty, before, "Rendering must not change the issued snapshot");
});

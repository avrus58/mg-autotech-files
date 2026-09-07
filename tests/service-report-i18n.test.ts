import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ServiceReportDownload from "../src/components/dashboard/ServiceReportDownload";
import { serviceReportLocaleOrder, serviceReportRows, serviceReportT, serviceReportTranslations } from "../src/lib/i18n/service-report-translations";
import { supportedLocales } from "../src/lib/i18nConfig";
import { ActiveLocaleProvider } from "../src/lib/useActiveLocale";
import { customerWorkflowClientSurfaceManifest } from "../src/lib/i18n/customer-workflow-surface-manifest";

test("service report catalog has every key in all12 locales with matching placeholders", () => {
  assert.deepEqual([...serviceReportLocaleOrder].sort(), supportedLocales.map(({ code }) => code).sort());
  assert.equal(new Set(serviceReportRows.map(([key]) => key)).size, serviceReportRows.length);
  for (const [key, ...values] of serviceReportRows) {
    assert.equal(values.length, supportedLocales.length, key);
    const expectedParams = [...values[0].matchAll(/\{([^}]+)\}/g)].map((match) => match[1]).sort();
    for (const [index, value] of values.entries()) {
      assert.ok(value.trim(), `${key}/${serviceReportLocaleOrder[index]}`);
      assert.doesNotMatch(value, /\uFFFD|[\u200B-\u200D\uFEFF]/u);
      assert.deepEqual([...value.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]).sort(), expectedParams, key);
      assert.equal(serviceReportT(serviceReportLocaleOrder[index], key), value);
      // Short technical/common nouns may coincide; sentences must be translated.
      if (index > 0 && values[0].length > 35) assert.notEqual(value, values[0], `${key} must not fall back to English`);
    }
  }
  for (const { code } of supportedLocales) {
    assert.deepEqual(Object.keys(serviceReportTranslations[code]).sort(), Object.keys(serviceReportTranslations.en).sort());
    const pagination = serviceReportT(code, "pageNumber", { page: "2", total: "5" });
    assert.doesNotMatch(pagination, /\{(?:page|total)\}/);
    assert.match(pagination, /2/);
    assert.match(pagination, /5/);
  }
  assert.throws(() => serviceReportT("zz" as Parameters<typeof serviceReportT>[0], "reportTitle"));
  assert.throws(() => serviceReportT("de", "missingKey" as Parameters<typeof serviceReportT>[1]));
});

test("the real report download component renders translated enabled and pending states in all12 locales", () => {
  for (const { code } of supportedLocales) {
    for (const status of ["completed", "new", "in_progress", "cancelled"]) {
      const html = renderToStaticMarkup(createElement(
        ActiveLocaleProvider,
        { initialLocale: code } as Parameters<typeof ActiveLocaleProvider>[0],
        createElement(ServiceReportDownload, { orderId: "00000000-0000-4000-8000-000000000001", status }),
      ));
      assert.ok(html.includes(serviceReportT(code, "downloadTitle")), `${code}/${status}`);
      assert.ok(html.includes(serviceReportT(code, "downloadPdf")), `${code}/${status}`);
      if (status === "completed") assert.doesNotMatch(html, /<button[^>]* disabled=""/);
      else assert.match(html, /<button[^>]* disabled=""/);
      assert.match(html, /aria-describedby=/);
      assert.match(html, /role="status"/);
      assert.doesNotMatch(html, /href="blob:/);
    }
  }
});

test("service-report customer surfaces are exact typed inventory entries, not legacy catalog exemptions", () => {
  for (const [group, file] of [
    ["orders", "src/components/dashboard/ServiceReportDownload.tsx"],
    ["orders", "src/lib/serviceReports/pdf.tsx"],
    ["security", "src/components/account/ReportBrandingCard.tsx"],
  ] as const) {
    assert.ok(customerWorkflowClientSurfaceManifest[group].typedUiBoundaries.some((entry) => entry.file === file && entry.localizationImport === "@/lib/i18n/service-report-translations"));
    assert.ok(customerWorkflowClientSurfaceManifest[group].sharedCatalogs.includes("service-report-translations"));
  }
  const checker = readFileSync("scripts/check-customer-i18n.ts", "utf8");
  assert.match(checker, /"@\/lib\/i18n\/service-report-translations",\s*new Map\(\[\["serviceReportT", typedKeyTranslatorContract\]\]\)/u);
  assert.match(checker, /"src\/lib\/serviceReports\/pdf\.tsx"/u);
  const source = readFileSync("src/components/dashboard/ServiceReportDownload.tsx", "utf8");
  assert.match(source, /authenticatedFetchForUser\(userId,/u);
  assert.match(source, /latestSession\?\.user\.id !== userId/u);
  assert.match(source, /subscription\.unsubscribe\(\)/u);
  assert.match(source, /URL\.revokeObjectURL\(url\)/u);
  assert.match(source, /disabled=\{!completed \|\| busy\}/u);
  assert.doesNotMatch(source, /window\.print|data-no-translate|dangerouslySetInnerHTML/u);
});

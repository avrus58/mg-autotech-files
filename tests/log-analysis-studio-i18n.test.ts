import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { buildDemoLog } from "../src/components/dashboard/LogAnalysisStudio";
import { analyzeLogStudio, logStudioResultMessageKeys } from "../src/lib/logAnalysisStudio";
import {
  buildDeterministicLogAnalyzerFallback,
  projectLogAnalyzerResponse,
} from "../src/lib/logAnalyzer";
import { logAnalyzerMessageKeys, type LogAnalyzerMessage } from "../src/lib/logAnalyzer/types";
import {
  logStudioAnalysisErrorT,
  logStudioChannelKindT,
  logStudioExactLocaleOrder,
  logStudioExactTranslations,
  logStudioLocaleOrder,
  logStudioMessageT,
  logStudioNumberLocale,
  logStudioT,
  logStudioTranslationKeys,
  logStudioTranslations,
  performanceReportTranslationKeys,
  performanceReportTranslations,
} from "../src/lib/i18n/log-analysis-studio-translations";

const nonEnglishLocales = logStudioLocaleOrder.filter((locale) => locale !== "en");

test("Log Analysis Studio has a complete typed catalog for every site locale", () => {
  assert.deepEqual(logStudioLocaleOrder, [
    "en", "nl", "de", "fr", "it", "ru", "es", "tr", "pt", "zh", "pl", "sq",
  ]);
  assert.ok(logStudioTranslationKeys.length >= 160);

  for (const locale of logStudioLocaleOrder) {
    assert.equal(Object.keys(logStudioTranslations[locale]).length, logStudioTranslationKeys.length);
    for (const key of logStudioTranslationKeys) {
      assert.ok(logStudioTranslations[locale][key].trim(), `${locale}.${key} must not be empty`);
    }
  }
});

test("non-English prose never silently falls back to the English source", () => {
  const proseKeys = logStudioTranslationKeys.filter((key) =>
    /\s/.test(logStudioTranslations.en[key])
  );

  for (const locale of nonEnglishLocales) {
    for (const key of proseKeys) {
      assert.notEqual(
        logStudioTranslations[locale][key],
        logStudioTranslations.en[key],
        `${locale}.${key} must be reviewed localized prose`
      );
    }
  }
});

test("performance report copy is complete, typed and preserves placeholder parity in all 12 locales", () => {
  const tokens = (value: string) =>
    [...value.matchAll(/\{([A-Za-z][A-Za-z0-9]*)\}/g)]
      .map((match) => match[1])
      .sort();

  assert.ok(performanceReportTranslationKeys.length >= 45);
  for (const locale of logStudioLocaleOrder) {
    assert.equal(
      Object.keys(performanceReportTranslations[locale]).length,
      performanceReportTranslationKeys.length
    );
    for (const key of performanceReportTranslationKeys) {
      const localized = performanceReportTranslations[locale][key];
      assert.ok(localized.trim(), `${locale}.${key} must not be empty`);
      assert.deepEqual(
        tokens(localized),
        tokens(performanceReportTranslations.en[key]),
        `${locale}.${key} placeholder mismatch`
      );
      if (locale !== "en" && /\s/.test(performanceReportTranslations.en[key])) {
        assert.notEqual(
          localized,
          performanceReportTranslations.en[key],
          `${locale}.${key} leaked English report prose`
        );
      }
    }
  }
});

test("static source rows are exportable to the shared exact-text compatibility layer", () => {
  assert.deepEqual(logStudioExactLocaleOrder, nonEnglishLocales);
  assert.ok(Object.keys(logStudioExactTranslations).length >= 120);
  for (const values of Object.values(logStudioExactTranslations)) {
    assert.equal(values.length, nonEnglishLocales.length);
    assert.ok(values.every((value) => value.trim().length > 0));
  }
  assert.equal(logStudioExactTranslations["Datalog Analysis Studio"][1], "Datalog-Analyse-Studio");
  assert.equal(logStudioExactTranslations["Choose log"][6], "Log seç");
  assert.equal(logStudioExactTranslations["Analysis boundary"][9], "Granice analizy");
});

test("Turkish, German and Albanian copy keeps native diacritics instead of ASCII transliteration", () => {
  const localeText = (locale: "tr" | "de" | "sq") =>
    Object.values(logStudioTranslations[locale]).join(" ");

  const turkish = localeText("tr");
  assert.match(turkish, /[çğıöşüİ]/);
  assert.doesNotMatch(turkish, /\b(?:secin|yukleme|cok|gozlem|degil|kopyalandi|kullanilabilir)\b/i);

  const german = localeText("de");
  assert.match(german, /[äöüßÄÖÜ]/);
  assert.doesNotMatch(german, /\b(?:Waehlen|Uebersicht|fuer|Loeschen|uebermittelt)\b/);

  const albanian = localeText("sq");
  assert.match(albanian, /[ëçËÇ]/);
  assert.doesNotMatch(albanian, /\b(?:eshte|zgjedhni|permbledhje|perpunuar)\b/i);
});

test("typed interpolation, number locales and technical channel identifiers remain deterministic", () => {
  assert.equal(
    logStudioT("tr", "selectedCount", { current: 2, maximum: 3 }),
    "2/3 seçildi"
  );
  assert.equal(logStudioNumberLocale("de"), "de-DE");
  assert.equal(logStudioNumberLocale("zh"), "zh-CN");
  assert.equal(logStudioChannelKindT("tr", "rpm"), "Motor devri");
  assert.equal(logStudioChannelKindT("de", "egt"), "Abgastemperatur");
  assert.equal(logStudioChannelKindT("sq", "torque"), "Çift-rrotullimi real i motorit");
  assert.equal(logStudioChannelKindT("tr", "afr"), "AFR");
  assert.equal(
    logStudioAnalysisErrorT("de", "The log needs a header and at least one numeric data row."),
    "Das Log benötigt eine Kopfzeile und mindestens eine numerische Datenzeile."
  );
  assert.equal(
    logStudioAnalysisErrorT("tr", "An unknown parser failure"),
    "Kullanılabilir sayısal log kanalı algılanmadı."
  );
});

test("the Studio consumes the active locale and protects only raw technical leaves", () => {
  const component = readFileSync(
    resolve(process.cwd(), "src", "components", "dashboard", "LogAnalysisStudio.tsx"),
    "utf8"
  );

  assert.match(component, /useActiveLocale\(\)/);
  assert.match(component, /StudioLocaleContext\.Provider value=\{activeLocale\}/);
  assert.match(component, /logStudioChannelKindT\(locale, channel\.kind\)/);
  assert.match(component, /title=\{channel\.header\} translate="no" data-no-translate>\{channel\.label\}/);
  assert.match(component, /sourceName \? <span translate="no" data-no-translate>\{sourceName\}<\/span> : t\("dropOrChoose"\)/);
  assert.match(component, /useState<StudioError \| null>\(null\)/);
  assert.match(component, /localizeStudioError\(error, activeLocale\)/);
  assert.match(component, /locale: activeLocale/);
  assert.match(component, /setError\(\{ kind: "translation", key: "analysisFailedError" \}\)/);
  assert.doesNotMatch(component, /setError\(t\("(?:analysisFailedError|fileReadError)"\)\)/);
  assert.doesNotMatch(component, /<(?:main|section|article)\b[^>]*data-no-translate/u);
});

test("every dynamic result key has 12-locale coverage and placeholder parity", () => {
  const keys = [...logStudioResultMessageKeys, ...logAnalyzerMessageKeys];
  const tokens = (value: string) => [...value.matchAll(/\{([A-Za-z][A-Za-z0-9]*)\}/g)]
    .map((match) => match[1])
    .sort();

  assert.equal(new Set(keys).size, keys.length);
  for (const key of keys) {
    const expected = tokens(logStudioTranslations.en[key]);
    for (const locale of logStudioLocaleOrder) {
      assert.deepEqual(tokens(logStudioTranslations[locale][key]), expected, `${locale}.${key}`);
    }
  }
});

test("demo and deterministic review fixtures render every result leaf without English fallback or unresolved tokens", () => {
  const analysis = analyzeLogStudio(buildDemoLog());
  assert.equal(analysis.status, "ready");
  const performanceRows = analysis.rows.flatMap((row) => {
    const rpm = analysis.channels.find((channel) => channel.kind === "rpm");
    const torque = analysis.channels.find((channel) => channel.kind === "torque");
    const rpmValue = rpm ? row.values[rpm.id] : null;
    const torqueValue = torque ? row.values[torque.id] : null;
    return rpmValue !== null && torqueValue !== null ? [{ rpm: rpmValue, torqueNm: torqueValue }] : [];
  });
  const response = buildDeterministicLogAnalyzerFallback({
    source: "browser_tool",
    rows: performanceRows,
    fileName: "RAW_owner-file.csv",
    vehicle: { brand: "RAW_Brand", model: "RAW_Model", engine: "RAW_Engine", ecuType: "RAW_ECU" },
  });
  const projected = projectLogAnalyzerResponse(response, { id: "fixture", fileName: "RAW_owner-file.csv" }, "customer").customer;
  const studioMessages = [
    ...analysis.insights.flatMap((insight) => [insight.titleMessage, insight.textMessage]),
    ...analysis.quality.reasonMessages,
    ...analysis.warningMessages,
    ...analysis.missingChannelMessages,
    ...analysis.safetyBoundaryMessages,
  ];
  const reviewMessages: LogAnalyzerMessage[] = [
    projected.stateLabelMessage,
    projected.providerNoticeMessage,
    projected.summaryMessage,
    ...projected.confidenceReasons.map((item) => item.message),
    ...projected.evidence.map((item) => item.message),
    ...projected.riskFlags.map((item) => item.message),
    ...projected.recommendations.map((item) => item.message),
    ...projected.missingInformationMessages,
    projected.humanReview.reasonMessage,
    ...projected.humanReview.requiredBeforeMessages,
    ...projected.safetyBoundaryMessages,
  ];

  for (const locale of logStudioLocaleOrder) {
    for (const message of [...studioMessages, ...reviewMessages]) {
      const rendered = logStudioMessageT(locale, message);
      assert.ok(rendered.trim(), `${locale}.${message.key}`);
      assert.doesNotMatch(rendered, /\{[A-Za-z][A-Za-z0-9]*\}/, `${locale}.${message.key}`);
      if (locale !== "en" && /\s/.test(message.fallback)) {
        assert.notEqual(rendered, message.fallback, `${locale}.${message.key} leaked its English fallback`);
      }
    }
  }
});

test("raw channel labels remain byte-identical inside localized descriptor output", () => {
  const raw = "RAW_Channel_ÄÖ_123";
  const message = {
    key: "studio.insight.rangeText" as const,
    params: { channelLabel: raw, minimum: 1.25, maximum: 2.5, average: 1.875, unit: "bar" },
    fallback: `${raw} ranged from 1.25 to 2.5 bar, with an average of 1.875 bar.`,
  };
  for (const locale of logStudioLocaleOrder) {
    const localized = logStudioMessageT(locale, message);
    assert.ok(localized.includes(raw), `${locale} changed the raw channel label`);
  }
});

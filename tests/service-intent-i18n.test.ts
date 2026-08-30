import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  serviceIntentExactTranslations,
  serviceIntentLocaleOrder,
  type ServiceIntentTranslationTuple,
} from "../src/lib/i18n/service-intent-translations";
import { supportedLocales, type LocaleCode } from "../src/lib/i18nConfig";
import {
  serviceIntentGuides,
  type ServiceIntentGuide,
} from "../src/lib/serviceIntentGuides";

const chromeSources = [
  "Home",
  "Breadcrumb",
  "ECU File Service",
  "Create file request",
  "Compare all services",
  "Service review boundary",
  "Review-first boundary",
  "Compatibility is confirmed per request.",
  "This public page does not inspect, upload, modify or approve a controller file. Exact support depends on the submitted identity, source file and workshop context.",
  "When this route fits",
  "Start with evidence, not assumptions.",
  "Required request context",
  "What the workshop should prepare.",
  "Technical review gates",
  "Three checks keep the request precise.",
  "Secure workflow",
  "From workshop brief to tracked request.",
  "Step",
  "Questions before submission",
  "Service-specific answers.",
  "Published by MG AutoTech",
  "Related workshop routes",
  "Updated",
  "Public guidance only; secure handling remains account-based.",
  "About MG AutoTech",
] as const;

const serviceIntentCatalog: Readonly<
  Record<string, ServiceIntentTranslationTuple>
> = serviceIntentExactTranslations;

function collectGuideSources(guide: ServiceIntentGuide) {
  return [
    guide.name,
    guide.metaTitle,
    guide.description,
    guide.eyebrow,
    guide.heroTitle,
    guide.lead,
    guide.cardLabel,
    ...guide.fitSignals,
    ...guide.requiredInputs,
    ...guide.reviewChecks.flatMap(({ title, text }) => [title, text]),
    ...guide.workflow.flatMap(({ title, text }) => [title, text]),
    ...guide.faq.flatMap(({ q, a }) => [q, a]),
    ...guide.related.map(({ label }) => label),
  ];
}

test("service-intent catalog uses every supported non-English locale exactly once", () => {
  const expected = supportedLocales
    .map(({ code }) => code)
    .filter((code): code is Exclude<LocaleCode, "en"> => code !== "en")
    .sort();

  assert.deepEqual([...serviceIntentLocaleOrder].sort(), expected);
  assert.equal(new Set(serviceIntentLocaleOrder).size, expected.length);
});

test("every service-intent guide and chrome source has complete reviewed coverage", () => {
  const sources = new Set([
    ...chromeSources,
    ...serviceIntentGuides.flatMap(collectGuideSources),
  ]);
  const missing = [...sources].filter(
    (source) => !serviceIntentCatalog[source]
  );

  assert.deepEqual(missing, []);
  assert.equal(sources.size, 196);

  for (const source of sources) {
    const translations = serviceIntentCatalog[source];
    assert.equal(translations.length, serviceIntentLocaleOrder.length, source);

    translations.forEach((translation, index) => {
      const locale = serviceIntentLocaleOrder[index];
      assert.ok(translation.trim(), `${locale}: blank translation for ${source}`);
      assert.notEqual(
        translation.trim(),
        source.trim(),
        `${locale}: English fallback for ${source}`
      );
    });
  }
});

test("controller identifiers and stage names remain exact inside localized prose", () => {
  const protectedTokens = [
    "MG AutoTech",
    "HW/SW",
    "ECU",
    "TCU",
    "OBD",
    "DSG",
    "ZF",
    "VGS",
    "DCT",
    "PDK",
    "OEM",
    "Stage 1",
    "Stage 2",
    "Stage 3",
  ] as const;

  for (const [source, translations] of Object.entries(
    serviceIntentExactTranslations
  )) {
    for (const token of protectedTokens) {
      if (!source.includes(token)) continue;
      translations.forEach((translation, index) => {
        assert.ok(
          translation.includes(token),
          `${serviceIntentLocaleOrder[index]} changed ${token} in ${source}`
        );
      });
    }
  }
});

test("native scripts and diacritics replace legacy ASCII transliterations", () => {
  const byLocale = Object.fromEntries(
    serviceIntentLocaleOrder.map((locale, index) => [
      locale,
      Object.values(serviceIntentExactTranslations)
        .map((translations) => translations[index])
        .join("\n"),
    ])
  ) as Record<Exclude<LocaleCode, "en">, string>;

  assert.match(byLocale.ru, /[А-Яа-яЁё]/u);
  assert.match(byLocale.zh, /[\p{Script=Han}]/u);
  assert.match(byLocale.de, /[äöüÄÖÜß]/u);
  assert.match(byLocale.tr, /[çğıİöşüÇĞÖŞÜ]/u);
  assert.match(byLocale.pt, /[áâãçéêíóôõúÁÂÃÇÉÊÍÓÔÕÚ]/u);
  assert.match(byLocale.pl, /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/u);
  assert.match(byLocale.sq, /[ëçËÇ]/u);

  assert.doesNotMatch(byLocale.de, /\b(?:fuer|ueber|pruefung)\b/iu);
  assert.doesNotMatch(byLocale.tr, /\b(?:icin|degil|guvenli|gonderin)\b/iu);
  assert.doesNotMatch(byLocale.pt, /\b(?:analise|verificacao)\b/iu);
  assert.doesNotMatch(byLocale.sq, /\b(?:sherbim|kerkese|perputhshmeri)\b/iu);
});

test("ServiceIntentPage keeps UI prose translatable and protects only the raw date", () => {
  const source = readFileSync(
    "src/components/ServiceIntentPage.tsx",
    "utf8"
  );

  for (const text of chromeSources) {
    assert.ok(source.includes(text), `ServiceIntentPage is missing ${text}`);
  }

  assert.doesNotMatch(source, /<main[^>]*data-no-translate/u);
  assert.match(
    source,
    /<time dateTime=\{guide\.updatedAt\} translate="no" data-no-translate>/u
  );
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  buildEcuReadAdvisorCopy,
  buildFileReadinessCopy,
  buildPerformanceCalculatorCopy,
  buildPublicLogSnapshotCopy,
  buildRequestBriefCopy,
} from "../src/lib/i18n/tool-client-copy";
import {
  ecuReadAdvisorCopyKeys,
  fileReadinessCopyKeys,
  performanceCalculatorCopyKeys,
  publicLogSnapshotCopyKeys,
  requestBriefCopyKeys,
} from "../src/lib/i18n/tool-client-copy-keys";
import { publicSurfaceLocaleOrder } from "../src/lib/i18n/public-surface-types";

function source(...segments: string[]) {
  return readFileSync(path.join(process.cwd(), ...segments), "utf8");
}

const deliberatelyLanguageNeutral = new Set([
  "Stage 1",
  "AutoTuner",
  "Flex",
  "KESS / KTAG",
  "CMD",
  "Magic Motorsport",
]);

test("every compact interactive-tool key has reviewed non-English copy", () => {
  const builders = [
    [fileReadinessCopyKeys, buildFileReadinessCopy],
    [ecuReadAdvisorCopyKeys, buildEcuReadAdvisorCopy],
    [performanceCalculatorCopyKeys, buildPerformanceCalculatorCopy],
    [requestBriefCopyKeys, buildRequestBriefCopy],
    [publicLogSnapshotCopyKeys, buildPublicLogSnapshotCopy],
  ] as const;

  for (const locale of publicSurfaceLocaleOrder) {
    for (const [keys, build] of builders) {
      const copy = build(locale) as Readonly<Record<string, string>>;
      for (const key of keys) {
        assert.equal(typeof copy[key], "string", `${locale}: missing ${key}`);
        assert.ok(copy[key].trim().length > 0, `${locale}: blank ${key}`);
        if (!deliberatelyLanguageNeutral.has(key)) {
          assert.notEqual(copy[key], key, `${locale}: English fallback for ${key}`);
        }
      }
    }
  }
});

test("public log snapshot exposes a native progressive loading status in every locale", () => {
  const expected = {
    de: "Kostenloser Log-Snapshot wird geladen",
    tr: "Ücretsiz log anlık görüntüsü yükleniyor",
    nl: "Gratis logsnapshot wordt geladen",
    fr: "Chargement de l’aperçu gratuit du log en cours",
    it: "Caricamento dell’istantanea gratuita del log in corso",
    es: "Cargando la instantánea gratuita del registro",
    pt: "A carregar a captura gratuita do registo",
    pl: "Trwa ładowanie bezpłatnego podglądu logu",
    ru: "Загружается бесплатный снимок лога",
    zh: "正在加载免费日志快照",
    sq: "Po ngarkohet pamja e çastit falas e regjistrit",
  } as const;

  for (const [locale, loadingStatus] of Object.entries(expected)) {
    assert.equal(
      buildPublicLogSnapshotCopy(locale as keyof typeof expected)[
        "Loading the free log snapshot"
      ],
      loadingStatus,
    );
  }
});

test("interactive tool clients receive compact copies without bundling the global catalog", () => {
  for (const component of [
    "FileReadinessAssistant.tsx",
    "EcuReadMethodAdvisor.tsx",
    "PerformanceTools.tsx",
    "RequestBriefBuilder.tsx",
    "PublicLogSnapshot.tsx",
  ]) {
    const clientSource = source("src", "components", "tools", component);
    assert.doesNotMatch(clientSource, /public-tools-translations/);
    assert.doesNotMatch(clientSource, /publicSurfaceExactT/);
  }

  const pages = {
    "file-readiness-check/page.tsx": "buildFileReadinessCopy",
    "ecu-read-method-advisor/page.tsx": "buildEcuReadAdvisorCopy",
    "torque-power-calculator/page.tsx": "buildPerformanceCalculatorCopy",
    "request-brief-builder/page.tsx": "buildRequestBriefCopy",
  } as const;

  for (const [page, builder] of Object.entries(pages)) {
    const pageSource = source("src", "app", "tools", ...page.split("/"));
    assert.match(pageSource, new RegExp(`${builder}\\(locale\\)`));
    assert.match(pageSource, /copy=\{clientCopy\}/);
  }

  const homepage = [
    source("src", "app", "page.tsx"),
    source("src", "lib", "renderRootHomepage.tsx"),
  ].join("\n");
  assert.match(homepage, /buildPublicLogSnapshotCopy\(locale\)/);
  assert.match(homepage, /publicLogSnapshotCopy=/);
});

test("a single localized tool payload stays compact", () => {
  for (const locale of publicSurfaceLocaleOrder) {
    const payloads = [
      buildFileReadinessCopy(locale),
      buildEcuReadAdvisorCopy(locale),
      buildPerformanceCalculatorCopy(locale),
      buildRequestBriefCopy(locale),
      buildPublicLogSnapshotCopy(locale),
    ];

    for (const payload of payloads) {
      assert.ok(
        Buffer.byteLength(JSON.stringify(payload), "utf8") < 20_000,
        `${locale}: compact copy payload exceeded 20 KB`
      );
    }
  }
});

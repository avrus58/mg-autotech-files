import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type {
  FileExpertChangeProfile,
  FileExpertFeature,
  FileExpertFinding,
  FileExpertIntegrityAssessment,
  FileExpertPossibleFeature,
  FileExpertVehicleMatch,
} from "../src/lib/fileExpert/types";
import {
  fileExpertReportLocaleOrder,
  fileExpertReportRows,
  fileExpertReportT,
  localizeFileExpertAnalyzerEvidence,
  localizeFileExpertChangeProfile,
  localizeFileExpertClusterMessage,
  localizeFileExpertFeatureLabel,
  localizeFileExpertFeatureReason,
  localizeFileExpertFileFormat,
  localizeFileExpertFinding,
  localizeFileExpertIntegrityIssue,
  localizeFileExpertReadScope,
  localizeFileExpertSimilarityMessage,
  localizeFileExpertVehicleCandidateEvidence,
  localizeFileExpertVehicleSummary,
} from "../src/lib/i18n/file-expert-report-translations";
import { supportedLocales } from "../src/lib/i18nConfig";

function placeholders(value: string) {
  return [...value.matchAll(/\{([a-zA-Z][a-zA-Z0-9]*)\}/g)]
    .map((match) => match[1])
    .sort();
}

function profile(
  classification: FileExpertChangeProfile["classification"],
  summary = ""
): FileExpertChangeProfile {
  return {
    classification,
    label: "provider-owned label",
    summary,
    confidence: 0.8,
    affected_area_percent: 0.1,
    changed_regions: 2,
  };
}

const integrity: FileExpertIntegrityAssessment = {
  file_size_match: false,
  ecu_identity_match: false,
  vin_match: false,
  checksum_status: "not_checked",
  issues: [
    "ORI and MOD file sizes differ.",
    "ORI and MOD contain different ECU family signatures.",
    "ORI and MOD contain different VIN identifiers.",
    "High entropy may indicate an encrypted or compressed container.",
  ],
};

const vehicleMatch: FileExpertVehicleMatch = {
  total_matches: 3,
  exact_vehicle_identified: false,
  summary: "provider-owned vehicle prose",
  candidates: [],
};

const fileExpertFeatures = [
  "stock_or_modified",
  "stage1",
  "stage2",
  "stage3",
  "dpf_off",
  "egr_off",
  "adblue_off",
  "dtc_off",
  "vmax_off",
  "pop_bangs",
  "tcu_tune",
  "tcu_shift",
  "tcu_lockup",
] as const satisfies readonly FileExpertFeature[];

test("File Expert report catalog covers every locale and preserves placeholder contracts", () => {
  assert.deepEqual(
    [...fileExpertReportLocaleOrder].sort(),
    supportedLocales.map(({ code }) => code).sort()
  );
  assert.equal(new Set(fileExpertReportRows.map(([key]) => key)).size, fileExpertReportRows.length);

  for (const row of fileExpertReportRows) {
    assert.equal(row.length, fileExpertReportLocaleOrder.length + 1, row[0]);
    const expected = placeholders(row[1]);
    row.slice(1).forEach((translation, index) => {
      assert.ok(translation.trim(), `${fileExpertReportLocaleOrder[index]}.${row[0]}`);
      assert.deepEqual(
        placeholders(translation),
        expected,
        `${fileExpertReportLocaleOrder[index]}.${row[0]} placeholder parity`
      );
    });
  }

  for (const locale of fileExpertReportLocaleOrder.filter((code) => code !== "en")) {
    assert.notEqual(fileExpertReportT(locale, "summarySingle"), fileExpertReportT("en", "summarySingle"));
    assert.notEqual(fileExpertReportT(locale, "genericEvidence"), fileExpertReportT("en", "genericEvidence"));
    assert.doesNotMatch(fileExpertReportT(locale, "reportLoadError"), /could not be loaded|try again/iu);
  }
});

test("finite File Expert enums localize and unknown values fail closed", () => {
  for (const locale of fileExpertReportLocaleOrder) {
    assert.doesNotMatch(localizeFileExpertFileFormat(locale, "raw_binary"), /raw_binary/u);
    assert.doesNotMatch(localizeFileExpertReadScope(locale, "calibration_area"), /calibration_area/u);
    assert.doesNotMatch(localizeFileExpertFeatureLabel(locale, "stock_or_modified"), /stock_or_modified/u);
    assert.equal(localizeFileExpertFileFormat(locale, "__proto__"), fileExpertReportT(locale, "formatUnknown"));
    assert.equal(localizeFileExpertReadScope(locale, "future_scope"), fileExpertReportT(locale, "scopeUnknown"));
    assert.equal(localizeFileExpertFeatureLabel(locale, "provider-owned feature"), fileExpertReportT(locale, "genericEvidence"));
    fileExpertFeatures.forEach((feature) => {
      assert.ok(localizeFileExpertFeatureLabel(locale, feature));
      assert.ok(localizeFileExpertFeatureReason(locale, {
        feature,
        confidence: 0.5,
        reasons: ["provider-owned"],
      }));
    });
    assert.equal(
      localizeFileExpertFeatureReason(locale, {
        feature: "future-provider-feature" as FileExpertFeature,
        confidence: 0.5,
        reasons: ["CUSTOMER-SECRET"],
      }),
      fileExpertReportT(locale, "genericEvidence")
    );
  }

  assert.equal(localizeFileExpertFileFormat("de", "raw_binary"), "Binärdatei");
  assert.equal(localizeFileExpertReadScope("tr", "full_read"), "Tam okuma");
  assert.equal(localizeFileExpertFeatureLabel("zh", "stock_or_modified"), "原厂 / 已修改");
  assert.equal(localizeFileExpertFeatureLabel("fr", "dpf_off"), "DPF OFF");
});

test("every analyzer identification evidence template has an anchored localized branch", () => {
  const samples = [
    ["ECU signature EDC17C64 found inside the binary.", "EDC17C64"],
    ["Additional ECU variant markers were also present: EDC17C64, EDC17CP14.", "EDC17C64"],
    ["ECU signature MED17.5 found in the uploaded file name.", "MED17.5"],
    ["ECU type MG1CS003 was supplied by the customer, not verified inside the binary.", "MG1CS003"],
    ["Supplier marker Bosch found inside the binary.", "Bosch"],
    ["Processor marker TC1797 found inside the binary.", "TC1797"],
    ["Hardware identifier extracted from file content or naming.", null],
    ["Software identifier extracted from file content or naming.", null],
    ["A VIN-format identifier was found inside the binary.", null],
    ["Engine code marker N47D20 found in the binary or uploaded file name.", "N47D20"],
    ["Conflicting control-unit signatures were found: EDC17C64, MED17.5.", "EDC17C64"],
  ] as const;

  for (const locale of fileExpertReportLocaleOrder) {
    for (const [source, marker] of samples) {
      const localized = localizeFileExpertAnalyzerEvidence(locale, source);
      assert.ok(localized);
      if (marker) assert.match(localized, new RegExp(marker.replaceAll(".", "\\."), "u"));
      if (locale !== "en") assert.notEqual(localized, source, `${locale}: ${source}`);
    }
    const arbitrary = "Provider says CUSTOMER-SECRET should be flashed now.";
    assert.equal(
      localizeFileExpertAnalyzerEvidence(locale, arbitrary),
      fileExpertReportT(locale, "genericEvidence")
    );
    assert.doesNotMatch(localizeFileExpertAnalyzerEvidence(locale, arbitrary), /CUSTOMER-SECRET/u);
  }
});

test("change profiles, findings, feature reasons and integrity issues use typed branches", () => {
  const profiles = [
    profile("single_file"),
    profile("structural_mismatch"),
    profile("identical"),
    profile("focused_calibration", "Changes are concentrated in a limited set of structured, calibration-like regions."),
    profile("focused_calibration", "Changes are concentrated in a limited part of the file, but map purpose cannot be named safely."),
    profile("distributed_calibration"),
    profile("broad_rework"),
  ];
  const features: FileExpertPossibleFeature[] = [
    { feature: "stage1", confidence: 0.7, reasons: ["provider-owned"] },
    { feature: "dtc_off", confidence: 0.4, reasons: ["provider-owned"] },
    { feature: "tcu_tune", confidence: 0.6, reasons: ["provider-owned"] },
    { feature: "stock_or_modified", confidence: 0.6, reasons: ["provider-owned"] },
  ];
  const findingIds: FileExpertFinding["id"][] = [
    "ecu-identification",
    "file-profile",
    "change-profile",
    "calibration-regions",
    "integrity-warning",
    "integrity-status",
    "vehicle-applications",
  ];

  for (const locale of fileExpertReportLocaleOrder) {
    profiles.forEach((item) => {
      const localized = localizeFileExpertChangeProfile(locale, item);
      assert.ok(localized.label);
      assert.ok(localized.summary);
      assert.doesNotMatch(`${localized.label} ${localized.summary}`, /provider-owned/u);
    });
    features.forEach((item) => {
      const localized = localizeFileExpertFeatureReason(locale, item);
      assert.ok(localized);
      assert.doesNotMatch(localized, /provider-owned/u);
    });
    integrity.issues.forEach((issue) => {
      const localized = localizeFileExpertIntegrityIssue(locale, issue);
      assert.ok(localized);
      if (locale !== "en") assert.notEqual(localized, issue);
    });

    const unknownProfile = localizeFileExpertChangeProfile(locale, {
      ...profile("single_file"),
      classification: "provider-owned" as FileExpertChangeProfile["classification"],
      label: "CUSTOMER-SECRET",
      summary: "CUSTOMER-SECRET",
    });
    assert.equal(unknownProfile.label, fileExpertReportT(locale, "genericEvidence"));
    assert.equal(unknownProfile.summary, fileExpertReportT(locale, "genericEvidence"));

    findingIds.forEach((id) => {
      const finding: FileExpertFinding = {
        id,
        category: id === "vehicle-applications" ? "vehicle" : "comparison",
        severity: "info",
        title: id === "ecu-identification" ? "Bosch EDC17C64" : "provider-owned title",
        summary: "provider-owned summary",
        confidence: 0.7,
        evidence: [],
      };
      const localized = localizeFileExpertFinding(locale, finding, {
        fileFormat: "raw_binary",
        readScope: "full_read",
        changeProfile: profiles[3],
        identificationStatus: "detected",
        identificationModule: "ECU",
        mapCandidateCount: 4,
        integrity,
        vehicleMatch,
        vehicleTarget: "EDC17C64",
      });
      assert.ok(localized.title);
      assert.ok(localized.summary);
      assert.doesNotMatch(localized.summary, /provider-owned/u);
      if (id !== "ecu-identification") assert.doesNotMatch(localized.title, /provider-owned/u);
    });

    const unknownFinding = localizeFileExpertFinding(locale, {
      id: "provider-owned-finding",
      category: "comparison",
      severity: "info",
      title: "CUSTOMER-SECRET",
      summary: "CUSTOMER-SECRET",
      confidence: 0.5,
      evidence: ["CUSTOMER-SECRET"],
    });
    assert.equal(unknownFinding.title, fileExpertReportT(locale, "genericEvidence"));
    assert.equal(unknownFinding.summary, fileExpertReportT(locale, "genericEvidence"));
  }
});

test("vehicle, similarity and cluster copy preserves raw identifiers but never arbitrary prose", () => {
  for (const locale of fileExpertReportLocaleOrder) {
    const summary = localizeFileExpertVehicleSummary(locale, vehicleMatch, "EDC17C64");
    assert.match(summary, /EDC17C64/u);
    assert.doesNotMatch(summary, /provider-owned/u);
    assert.ok(localizeFileExpertSimilarityMessage(locale, { matchesFound: 3 }));
    assert.ok(localizeFileExpertClusterMessage(locale, { matchingClusters: 2 }));
    assert.equal(
      localizeFileExpertVehicleCandidateEvidence(locale, {
        brand: "Raw Brand",
        model: "Raw Model",
        generation: "Raw Generation",
        engine: "RAW-ENGINE",
        ecu: "RAW-ECU",
        confidence: 0.7,
        reason: "arbitrary provider prose CUSTOMER-SECRET",
      }),
      fileExpertReportT(locale, "vehicleCandidateEvidence")
    );
  }
});

test("File Expert detail consumes only typed localized output and protects raw leaves", () => {
  const page = readFileSync("src/app/dashboard/file-expert/[id]/page.tsx", "utf8");
  const helper = readFileSync("src/lib/i18n/file-expert-report-translations.ts", "utf8");

  for (const forbidden of [
    /job\.executive_summary/u,
    /job\.error_message/u,
    /finding\.summary/u,
    /vehicleMatch\.summary/u,
    /feature\.reasons/u,
    /clusterEvidence\.message/u,
  ]) {
    assert.doesNotMatch(page, forbidden);
  }
  for (const required of [
    "localizeFileExpertAnalyzerEvidence",
    "localizeFileExpertFinding",
    "localizeFileExpertFeatureReason",
    "localizeFileExpertVehicleSummary",
    "localizeFileExpertClusterMessage",
    "localizeFileExpertSimilarityMessage",
  ]) {
    assert.match(page, new RegExp(required, "u"));
  }
  assert.match(page, /candidate\.brand[\s\S]{0,260}translate="no" data-no-translate/u);
  assert.match(page, /file\.name \? <span translate="no" data-no-translate>/u);
  assert.match(page, /<span translate="no" data-no-translate>\{identity\.display_name\}<\/span>/u);
  assert.match(helper, /Object\.prototype\.hasOwnProperty\.call/u);
  assert.doesNotMatch(helper, /return\s+value\b/u);
});

test("analyzer source messages exercised by the customer report stay in the finite contract", () => {
  const analyzer = readFileSync("src/lib/fileExpert/analyzer.ts", "utf8");
  const identification = readFileSync("src/lib/fileExpert/identification.ts", "utf8");
  const vehicleMatcher = readFileSync("src/lib/fileExpert/vehicleMatcher.ts", "utf8");

  for (const source of [
    "Only one file was supplied, so modifications cannot be confirmed without a matching original file.",
    "ORI and MOD sizes differ. This can indicate different read scopes, a container mismatch or an incompatible file pair.",
    "No binary difference was found between the uploaded ORI and MOD files.",
    "Changes are concentrated in a limited set of structured, calibration-like regions.",
    "Changes are concentrated in a limited part of the file, but map purpose cannot be named safely.",
    "Multiple areas of the calibration appear to have been changed.",
    "A large part of the file differs.",
    "ORI and MOD file sizes differ.",
    "ORI and MOD contain different ECU family signatures.",
    "ORI and MOD contain different VIN identifiers.",
    "High entropy may indicate an encrypted or compressed container.",
  ]) assert.match(analyzer, new RegExp(source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "u"));

  for (const source of [
    "Hardware identifier extracted from file content or naming.",
    "Software identifier extracted from file content or naming.",
    "A VIN-format identifier was found inside the binary.",
  ]) assert.match(identification, new RegExp(source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "u"));

  assert.match(vehicleMatcher, /Vehicle and engine could not be matched/u);
  assert.match(vehicleMatcher, /ECU identity alone does not prove/u);
});

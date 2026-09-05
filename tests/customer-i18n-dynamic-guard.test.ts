import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { localizedSeoFooterCopy } from "../src/components/LocalizedSeoFooter";
import { widgetVehicleTypeLabels } from "../src/lib/i18n/widget-translations";
import { supportedLocales } from "../src/lib/i18nConfig";
import { widgetLanguageCodes } from "../src/lib/widget/types";
import {
  auditDynamicVisibleExpressions,
  reviewedDynamicVisibleExpressions,
  type DynamicVisibleExpression,
} from "../scripts/lib/i18n-dynamic-guard";
import {
  findUnclassifiedAppRouteFiles,
  findUnclassifiedFiles,
  isAuditedUiSourceFile,
  isCoLocatedAppUiSourceFile,
  isPotentialSharedUiSourceFile,
} from "../scripts/lib/i18n-component-inventory";
import {
  auditFrozenSource,
  normalizedSourceFingerprint,
} from "../scripts/lib/i18n-frozen-source";

const frozenFileServiceFingerprint =
  "0d6d6dc6aa22ed637aa92ce58911c4e3ce5a76740b76d8b207ca2f43b67c603f";

// This test module is the only caller allowed to request the checker’s
// fixture-only execution path. Every child still supplies an explicit
// I18N_AUDIT_EXTRA_ROOT; the checker refuses the fixture flag without one.
const previousFixtureAuditOnly = process.env.I18N_AUDIT_FIXTURE_ONLY;
process.env.I18N_AUDIT_FIXTURE_ONLY = "1";
test.after(() => {
  if (previousFixtureAuditOnly === undefined) {
    delete process.env.I18N_AUDIT_FIXTURE_ONLY;
  } else {
    process.env.I18N_AUDIT_FIXTURE_ONLY = previousFixtureAuditOnly;
  }
});

test("fixture-only audit cannot narrow a normal Production scan", () => {
  const checker = readFileSync("scripts/check-customer-i18n.ts", "utf8");
  assert.match(
    checker,
    /fixtureAuditOnlyRequested\s*&&\s*Boolean\(extraAuditRoot\)/u,
  );
  assert.match(
    checker,
    /:\s*customerWorkflowAuditRoots\(customerSurfaceRoots, extraAuditRoot\)/u,
  );
  assert.match(checker, /if \(!fixtureAuditMode\) \{/u);
  assert.match(checker, /walkSourceFiles\("src\/app", appRouteEntryFiles\)/u);
  assert.match(
    checker,
    /walkSourceFiles\("src\/components", componentFiles\)/u,
  );

  const result = spawnSync(
    process.execPath,
    ["node_modules/tsx/dist/cli.mjs", "scripts/check-customer-i18n.ts"],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        I18N_AUDIT_EXTRA_ROOT: "",
        I18N_AUDIT_FIXTURE_ONLY: "1",
      },
    },
  );
  const output = `${result.stdout}\n${result.stderr}`;
  assert.equal(result.status, 1, output);
  assert.match(
    output,
    /I18N_AUDIT_FIXTURE_ONLY requires a non-empty I18N_AUDIT_EXTRA_ROOT/u,
  );
});

test("the component inventory rejects every new unclassified shared component", () => {
  assert.deepEqual(
    findUnclassifiedFiles({
      files: [
        "src/components/dashboard/KnownCustomerCard.tsx",
        "src/components/admin/InternalCard.tsx",
        "src/components/LanguageSwitcher.tsx",
        "src/components/legal/LegalPageShell.tsx",
        "src/components/legal/FutureLegalCopy.tsx",
        "src/components/legal/FutureLegalCopy.jsx",
        "src/components/FutureCustomerCard.tsx",
      ],
      auditedRoots: [
        "src/components/dashboard",
        "src/components/LanguageSwitcher.tsx",
      ],
      intentionallyAuthoredRoots: [
        "src/components/admin",
        "src/components/legal/LegalPageShell.tsx",
      ],
    }),
    [
      "src/components/FutureCustomerCard.tsx",
      "src/components/legal/FutureLegalCopy.jsx",
      "src/components/legal/FutureLegalCopy.tsx",
    ],
  );
});

test("the app inventory rejects new layouts beside frozen and exact legal pages", () => {
  assert.deepEqual(
    findUnclassifiedAppRouteFiles({
      files: [
        "src/app/admin/layout.tsx",
        "src/app/dashboard/layout.tsx",
        "src/app/file-service/page.tsx",
        "src/app/file-service/layout.tsx",
        "src/app/file-service/layout.jsx",
        "src/app/file-service/icon.tsx",
        "src/app/file-service/manifest.ts",
        "src/app/file-service/icon1.tsx",
        "src/app/file-service/apple-icon2.jsx",
        "src/app/file-service/opengraph-image3.tsx",
        "src/app/file-service/twitter-image4.ts",
        "src/app/agb/page.tsx",
        "src/app/agb/layout.tsx",
        "src/app/agb/apple-icon.tsx",
        "src/app/dashboard/manifest.ts",
        "src/app/api/example/route.ts",
      ],
      auditedRoots: ["src/app/dashboard"],
      intentionallyAuthoredRoots: [
        "src/app/admin",
        "src/app/file-service/page.tsx",
        "src/app/agb/page.tsx",
      ],
    }),
    [
      "src/app/agb/apple-icon.tsx",
      "src/app/agb/layout.tsx",
      "src/app/file-service/apple-icon2.jsx",
      "src/app/file-service/icon.tsx",
      "src/app/file-service/icon1.tsx",
      "src/app/file-service/layout.jsx",
      "src/app/file-service/layout.tsx",
      "src/app/file-service/manifest.ts",
      "src/app/file-service/opengraph-image3.tsx",
      "src/app/file-service/twitter-image4.ts",
    ],
  );
});

test("the app UI inventory rejects co-located components beside exact pages", () => {
  assert.deepEqual(
    findUnclassifiedFiles({
      files: [
        "src/app/dashboard/KnownCustomerCopy.tsx",
        "src/app/agb/page.tsx",
        "src/app/agb/FutureLegalCopy.tsx",
        "src/app/agb/FutureLegalCopy.jsx",
        "src/app/agb/FutureLegalCopy.ts",
        "src/app/file-service/page.tsx",
        "src/app/file-service/FutureFrozenSibling.tsx",
      ],
      auditedRoots: ["src/app/dashboard"],
      intentionallyAuthoredRoots: [
        "src/app/agb/page.tsx",
        "src/app/file-service/page.tsx",
      ],
    }),
    [
      "src/app/agb/FutureLegalCopy.jsx",
      "src/app/agb/FutureLegalCopy.ts",
      "src/app/agb/FutureLegalCopy.tsx",
      "src/app/file-service/FutureFrozenSibling.tsx",
    ],
  );
});

test("the shared JSX inventory rejects new modules outside components", () => {
  assert.deepEqual(
    findUnclassifiedFiles({
      files: [
        "src/lib/homepageLocalization.tsx",
        "src/lib/renderRootHomepage.tsx",
        "src/lib/FutureCustomerCopy.tsx",
        "src/lib/FutureCustomerCopy.jsx",
        "src/lib/FutureCustomerCopy.ts",
      ],
      auditedRoots: [
        "src/lib/homepageLocalization.tsx",
        "src/lib/renderRootHomepage.tsx",
      ],
      intentionallyAuthoredRoots: [],
    }),
    [
      "src/lib/FutureCustomerCopy.jsx",
      "src/lib/FutureCustomerCopy.ts",
      "src/lib/FutureCustomerCopy.tsx",
    ],
  );
});

test("the shared UI source filter includes every supported JS and TS extension", () => {
  assert.deepEqual(
    [
      "src/app/Future.js",
      "src/app/Future.jsx",
      "src/app/Future.ts",
      "src/app/Future.tsx",
      "src/app/Future.css",
      "src/app/Future.json",
    ].filter(isAuditedUiSourceFile),
    [
      "src/app/Future.js",
      "src/app/Future.jsx",
      "src/app/Future.ts",
      "src/app/Future.tsx",
    ],
  );
  assert.equal(
    isCoLocatedAppUiSourceFile("src/app/agb/FutureLegalCopy.ts"),
    true,
  );
  assert.equal(
    isCoLocatedAppUiSourceFile("src/app/api/example/route.ts"),
    false,
  );
  assert.equal(isCoLocatedAppUiSourceFile("src/app/robots.ts"), false);
  assert.equal(
    isPotentialSharedUiSourceFile("src/lib/FutureCustomerCopy.ts"),
    true,
  );
  assert.equal(
    isPotentialSharedUiSourceFile("src/lib/internalServerState.ts"),
    false,
  );
});

test("project-alias imports cannot hide customer-visible copy in shared TS modules", () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "mg-i18n-alias-copy-"));
  const fixture = join(fixtureRoot, "AliasImportedCopy.tsx");
  const technicalSource = join(fixtureRoot, "TechnicalSource.ts");
  writeFileSync(
    technicalSource,
    'export const computedCustomerLabel = ["Unreviewed", "computed", "copy"].join(" ");\n',
    "utf8",
  );
  writeFileSync(
    fixture,
    [
      'import { presetFileVersionLabels } from "@/lib/fileVersionLabels";',
      'import { intlLocaleByCode } from "@/lib/i18nConfig";',
      'import { fileExpertAllowedExtensionsLabel, fileExpertTextLimits } from "@/lib/fileExpert/limits";',
      'import { CUSTOMER_REPLACEMENT_PASSWORD_MIN_LENGTH } from "@/lib/customerPasswordSecurity";',
      'import { maxLogStudioChannels } from "@/lib/logAnalysisStudio";',
      'import { computedCustomerLabel } from "./TechnicalSource";',
      'export function AliasImportedCopy({ locale }: { locale: "en" | "de" }) {',
      '  const versionIndex = locale === "en" ? 2 : 0;',
      "  return <p>",
      "    {presetFileVersionLabels[2]}",
      "    {presetFileVersionLabels[versionIndex]}",
      "    {intlLocaleByCode[locale]}",
      "    {fileExpertTextLimits.brand}",
      "    {fileExpertAllowedExtensionsLabel}",
      "    {CUSTOMER_REPLACEMENT_PASSWORD_MIN_LENGTH}",
      "    {maxLogStudioChannels}",
      "    {computedCustomerLabel}",
      "  </p>;",
      "}",
    ].join("\n"),
    "utf8",
  );

  try {
    const result = spawnSync(
      process.execPath,
      ["node_modules/tsx/dist/cli.mjs", "scripts/check-customer-i18n.ts"],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          I18N_AUDIT_EXTRA_ROOT: fixture,
          I18N_REPORT_IMPORTS: "1",
          I18N_REPORT_SOURCE_GAPS: "1",
        },
      },
    );

    const output = `${result.stdout}\n${result.stderr}`;
    assert.equal(result.status, 1, output);
    assert.match(output, /final/u);
    assert.match(output, /@\/lib\/fileVersionLabels#presetFileVersionLabels/u);
    assert.match(output, /\.\/TechnicalSource#computedCustomerLabel/u);
    for (const reviewedDescriptor of [
      "@/lib/i18nConfig#intlLocaleByCode",
      "@/lib/fileExpert/limits#fileExpertTextLimits",
      "@/lib/fileExpert/limits#fileExpertAllowedExtensionsLabel",
      "@/lib/customerPasswordSecurity#CUSTOMER_REPLACEMENT_PASSWORD_MIN_LENGTH",
      "@/lib/logAnalysisStudio#maxLogStudioChannels",
    ]) {
      assert.doesNotMatch(output, new RegExp(reviewedDescriptor, "u"));
    }
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test("exact reviewed imported locale catalogs keep complete native rows", () => {
  const siteLocaleCodes = supportedLocales.map(({ code }) => code);
  assert.deepEqual(
    Object.keys(localizedSeoFooterCopy).sort(),
    [...siteLocaleCodes].sort(),
  );
  for (const locale of siteLocaleCodes) {
    const row = localizedSeoFooterCopy[locale];
    assert.ok(row.brandLine.trim(), `${locale}: footer brandLine`);
    assert.ok(row.widget.trim(), `${locale}: footer widget`);
    assert.ok(row.country.trim(), `${locale}: footer country`);
    if (locale !== "en") {
      assert.notEqual(row.brandLine, localizedSeoFooterCopy.en.brandLine);
      assert.notEqual(row.widget, localizedSeoFooterCopy.en.widget);
      assert.notEqual(row.country, localizedSeoFooterCopy.en.country);
    }
  }

  assert.deepEqual(
    Object.keys(widgetVehicleTypeLabels).sort(),
    [...widgetLanguageCodes].sort(),
  );
  for (const locale of widgetLanguageCodes) {
    assert.ok(
      widgetVehicleTypeLabels[locale].trim(),
      `${locale}: vehicle type`,
    );
    if (locale !== "en") {
      assert.notEqual(
        widgetVehicleTypeLabels[locale],
        widgetVehicleTypeLabels.en,
      );
    }
  }
});

test("broad data-no-translate boundaries cannot hide customer-visible surfaces", () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "mg-i18n-no-translate-"));
  const fixture = join(fixtureRoot, "HiddenCustomerSurface.tsx");
  writeFileSync(
    fixture,
    [
      "export function HiddenCustomerSurface() {",
      '  return <main data-no-translate data-i18n-owned-surface="widget-site"><section><h1>MG AutoTech</h1></section></main>;',
      "}",
    ].join("\n"),
    "utf8",
  );

  try {
    const result = spawnSync(
      process.execPath,
      ["node_modules/tsx/dist/cli.mjs", "scripts/check-customer-i18n.ts"],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          I18N_AUDIT_EXTRA_ROOT: fixture,
        },
      },
    );

    const output = `${result.stdout}\n${result.stderr}`;
    assert.equal(result.status, 1, output);
    assert.match(
      output,
      /broad data-no-translate boundaries hide customer\/public surfaces/u,
    );
    assert.match(output, /HiddenCustomerSurface\.tsx/u);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test("machine status members stay structural only while used as control flow", () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "mg-i18n-machine-status-"));
  const states = join(fixtureRoot, "states.ts");
  const fixture = join(fixtureRoot, "MachineStatus.tsx");
  writeFileSync(
    states,
    [
      "export const machineStates = {",
      '  ready: "ready",',
      '  needsAttention: "needs_attention",',
      '  blocked: "blocked",',
      "} as const;",
    ].join("\n"),
    "utf8",
  );
  writeFileSync(
    fixture,
    [
      'import { machineStates } from "./states";',
      "export function MachineStatus({ blocked }: { blocked: boolean }) {",
      "  const result = { status: blocked ? machineStates.blocked : machineStates.ready };",
      '  return <p>{result.status === machineStates.ready ? "MG AutoTech" : "MG AutoTech"}</p>;',
      "}",
    ].join("\n"),
    "utf8",
  );

  try {
    const controlOnly = spawnSync(
      process.execPath,
      ["node_modules/tsx/dist/cli.mjs", "scripts/check-customer-i18n.ts"],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          I18N_AUDIT_EXTRA_ROOT: fixtureRoot,
        },
      },
    );
    const controlOutput = `${controlOnly.stdout}\n${controlOnly.stderr}`;
    assert.equal(controlOnly.status, 0, controlOutput);
    assert.match(controlOutput, /Fixture i18n audit passed/u);
    assert.doesNotMatch(controlOutput, /stale reviewed dynamic-expression/u);

    writeFileSync(
      fixture,
      [
        'import { machineStates } from "./states";',
        "export function MachineStatus() {",
        "  const result = { status: machineStates.ready };",
        "  return <p>{result.status}</p>;",
        "}",
      ].join("\n"),
      "utf8",
    );
    const visiblyRendered = spawnSync(
      process.execPath,
      ["node_modules/tsx/dist/cli.mjs", "scripts/check-customer-i18n.ts"],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          I18N_AUDIT_EXTRA_ROOT: fixtureRoot,
        },
      },
    );
    const visibleOutput = `${visiblyRendered.stdout}\n${visiblyRendered.stderr}`;
    assert.equal(visiblyRendered.status, 1, visibleOutput);
    assert.match(visibleOutput, /reviewed English fallback/u);
    assert.match(visibleOutput, /ready/u);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test("the legacy file-service surface is frozen until it joins the shared locale architecture", () => {
  const source = readFileSync("src/app/file-service/page.tsx", "utf8");
  const checker = readFileSync("scripts/check-customer-i18n.ts", "utf8");

  assert.equal(
    normalizedSourceFingerprint(source),
    frozenFileServiceFingerprint,
  );
  assert.equal(
    auditFrozenSource(source, frozenFileServiceFingerprint).matches,
    true,
  );
  assert.equal(
    auditFrozenSource(
      `${source}\n{/* unlocalized change */}`,
      frozenFileServiceFingerprint,
    ).matches,
    false,
  );
  assert.equal(
    normalizedSourceFingerprint(
      source.replace(/\r\n?/gu, "\n").replace(/\n/gu, "\r\n"),
    ),
    frozenFileServiceFingerprint,
  );
  assert.match(checker, /const frozenLegacyCustomerFiles = new Map/u);
  assert.match(checker, /src\/app\/file-service\/page\.tsx/u);
  assert.match(checker, new RegExp(frozenFileServiceFingerprint, "u"));
});

test("the checker has no generic component or app-segment localization bypass", () => {
  const checker = readFileSync("scripts/check-customer-i18n.ts", "utf8");
  const componentInventory = readFileSync(
    "scripts/lib/i18n-component-inventory.ts",
    "utf8",
  );
  const source = `${checker}\n${componentInventory}`;

  assert.doesNotMatch(source, /separatelyAuditedComponentFiles/u);
  assert.doesNotMatch(source, /separatelyAuditedAppSegments/u);
  assert.doesNotMatch(source, /separatelyAuditedFiles/u);
  assert.doesNotMatch(source, /intentionallyAuthoredAppSegments/u);
  assert.doesNotMatch(source, /"src\/components\/legal",/u);
  assert.match(source, /src\/components\/legal\/LegalPageShell\.tsx/u);
  assert.match(
    checker,
    /walkSourceFiles\("src\/components", componentFiles\)/u,
  );
});

test("the dynamic i18n inventory rejects every unreviewed visible composition", () => {
  const reviewed = reviewedDynamicVisibleExpressions.map(
    (expression, index): DynamicVisibleExpression => ({
      ...expression,
      line: index + 1,
    }),
  );
  const novelComposition: DynamicVisibleExpression = {
    file: "src/components/dashboard/Example.tsx",
    kind: "template",
    line: 42,
    source: "`${count} pending orders`",
  };

  const audit = auditDynamicVisibleExpressions([...reviewed, novelComposition]);

  assert.deepEqual(audit.unclassified, [novelComposition]);
  assert.deepEqual(audit.staleReviewed, []);
  assert.equal(audit.classificationFor(novelComposition), undefined);
});

test("the dynamic i18n inventory reports stale reviewed bypasses", () => {
  const [removed, ...detected] = reviewedDynamicVisibleExpressions;
  assert.ok(removed);

  const audit = auditDynamicVisibleExpressions(
    detected.map((expression, index): DynamicVisibleExpression => ({
      ...expression,
      line: index + 1,
    })),
  );

  assert.deepEqual(audit.unclassified, []);
  assert.deepEqual(audit.staleReviewed, [removed]);
});

test("the repository checker fails on a new composed visible string without a report flag", () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "mg-i18n-dynamic-"));
  const fixture = join(fixtureRoot, "UnreviewedCopy.tsx");
  writeFileSync(
    fixture,
    [
      "export function UnreviewedCopy({ count, isOpen }: { count: number; isOpen: boolean }) {",
      "  return isOpen && <p aria-label={`${count} HP`}>{count}</p>;",
      "}",
    ].join("\n"),
    "utf8",
  );

  try {
    const result = spawnSync(
      process.execPath,
      ["node_modules/tsx/dist/cli.mjs", "scripts/check-customer-i18n.ts"],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          I18N_AUDIT_EXTRA_ROOT: fixture,
        },
      },
    );

    const output = `${result.stdout}\n${result.stderr}`;
    assert.equal(result.status, 1, output);
    assert.match(
      result.stderr,
      /unclassified customer-visible dynamic\/composed expression/u,
    );
    assert.match(result.stderr, /UnreviewedCopy\.tsx/u);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test("the repository checker rejects direct visible operands of every logical operator", () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "mg-i18n-logical-"));
  const fixture = join(fixtureRoot, "LogicalCopy.tsx");
  writeFileSync(
    fixture,
    [
      "export function LogicalCopy({ andGate, orValue, nullishValue, count }: { andGate: boolean; orValue: string; nullishValue: string | null; count: number }) {",
      "  return <>",
      '    {andGate && "Logical AND static warning"}',
      "    {andGate && `Logical AND backtick warning`}",
      "    {andGate && `Logical AND template ${count}`}",
      '    {orValue || "Logical OR static warning"}',
      "    {orValue || `Logical OR backtick warning`}",
      "    {orValue || `Logical OR template ${count}`}",
      '    {nullishValue ?? "Logical nullish static warning"}',
      "    {nullishValue ?? `Logical nullish backtick warning`}",
      "    {nullishValue ?? `Logical nullish template ${count}`}",
      "  </>;",
      "}",
    ].join("\n"),
    "utf8",
  );

  try {
    const result = spawnSync(
      process.execPath,
      ["node_modules/tsx/dist/cli.mjs", "scripts/check-customer-i18n.ts"],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          I18N_AUDIT_EXTRA_ROOT: fixture,
          I18N_REPORT_DYNAMIC: "1",
          I18N_REPORT_SOURCE_GAPS: "1",
        },
      },
    );

    assert.equal(result.status, 1, result.stdout);
    for (const source of [
      "Logical AND static warning",
      "Logical AND backtick warning",
      "Logical OR static warning",
      "Logical OR backtick warning",
      "Logical nullish static warning",
      "Logical nullish backtick warning",
    ]) {
      assert.match(result.stdout, new RegExp(source, "u"));
    }
    for (const source of [
      "Logical AND template",
      "Logical OR template",
      "Logical nullish template",
    ]) {
      assert.ok(
        result.stdout.includes(
          `[template] \`${source} \${count}\` => UNCLASSIFIED`,
        ),
        `${source}: dynamic logical operand was not reported`,
      );
    }
    assert.match(
      result.stderr,
      /unclassified customer-visible dynamic\/composed expression/u,
    );
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test("the repository checker audits visible copy in JS and JSX directory roots", () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "mg-i18n-jsx-root-"));
  writeFileSync(
    join(fixtureRoot, "FutureJsCopy.js"),
    "export function FutureJsCopy() { return <p>Untranslated JS customer warning</p>; }",
    "utf8",
  );
  writeFileSync(
    join(fixtureRoot, "FutureJsxCopy.jsx"),
    "export function FutureJsxCopy() { return <p>Untranslated JSX customer warning</p>; }",
    "utf8",
  );

  try {
    const result = spawnSync(
      process.execPath,
      ["node_modules/tsx/dist/cli.mjs", "scripts/check-customer-i18n.ts"],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          I18N_AUDIT_EXTRA_ROOT: fixtureRoot,
          I18N_REPORT_SOURCE_GAPS: "1",
        },
      },
    );

    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stdout, /Untranslated JS customer warning/u);
    assert.match(result.stdout, /Untranslated JSX customer warning/u);
    assert.match(result.stderr, /reviewed English fallback/u);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test("the repository checker follows visible copy and exact translator provenance", () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "mg-i18n-static-flow-"));
  const fixture = join(fixtureRoot, "StaticFlow.tsx");
  writeFileSync(
    fixture,
    [
      'import { widgetT as fakeImportedWidgetT } from "@/lib/i18n/fake-provenance";',
      'import { customerWorkflowExactT as realExactT, customerWorkflowT as realKeyT } from "@/lib/i18n/customer-workflow-auth-translations";',
      "const customerWarning = `Untranslated variable customer warning`;",
      'const sourceWarning = "Untranslated aliased exact source warning";',
      "const aliasedWarning = sourceWarning;",
      'const objectCopy = { warning: "Untranslated object exact source warning" } as const;',
      'const arrayCopy = ["Untranslated array exact source warning"] as const;',
      'const suffix = "warning";',
      "const templateWarning = `Untranslated stored template ${suffix}`;",
      'const storedParams = { customer: "Untranslated stored params warning" } as const;',
      "const passthroughT = (value: string) => value;",
      "const widgetT = (_locale: string, value: string) => value;",
      'const wrappedT = (key: string, customer: string) => realKeyT("en", key as never, { customer });',
      'function useCopy() { return { t: (key: string, customer: string) => realKeyT("en", key as never, { customer }) }; }',
      "function Card({ helperText }: { helperText: string }) { return <p>{helperText}</p>; }",
      "export function StaticFlow({ count }: { count: number }) {",
      "  const { t: providerT } = useCopy();",
      "  const storedDynamicWarning = `Untranslated stored dynamic ${count}`;",
      "  return <>",
      "    <p>{customerWarning}</p>",
      '    <Card helperText="Untranslated custom helper warning" />',
      '    <p>{passthroughT("Untranslated fake translator warning")}</p>',
      '    <p>{widgetT("en", "Untranslated allowlisted-name warning")}</p>',
      '    <p>{fakeImportedWidgetT("en", "Untranslated fake imported translator warning")}</p>',
      '    <p>{realExactT("en", "Untranslated unknown exact source warning")}</p>',
      '    <p>{realKeyT("en", "supportSummary", { customer: "Untranslated literal interpolation warning" })}</p>',
      '    <p>{realExactT("en", aliasedWarning)}</p>',
      '    <p>{realExactT("en", objectCopy.warning)}</p>',
      '    <p>{realExactT("en", arrayCopy[0])}</p>',
      '    <p>{realExactT("en", templateWarning)}</p>',
      '    <p>{realKeyT("en", "supportSummary", storedParams)}</p>',
      '    <p>{wrappedT("supportSummary", "Untranslated wrapped interpolation warning")}</p>',
      '    <p>{providerT("supportSummary", "Untranslated provider interpolation warning")}</p>',
      "    <p>{storedDynamicWarning}</p>",
      "  </>;",
      "}",
    ].join("\n"),
    "utf8",
  );

  try {
    const result = spawnSync(
      process.execPath,
      ["node_modules/tsx/dist/cli.mjs", "scripts/check-customer-i18n.ts"],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          I18N_AUDIT_EXTRA_ROOT: fixture,
          I18N_REPORT_DYNAMIC: "1",
          I18N_REPORT_SOURCE_GAPS: "1",
        },
      },
    );

    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stdout, /Untranslated variable customer warning/u);
    assert.match(result.stdout, /Untranslated custom helper warning/u);
    assert.match(result.stdout, /Untranslated fake translator warning/u);
    assert.match(result.stdout, /Untranslated allowlisted-name warning/u);
    assert.match(
      result.stdout,
      /Untranslated fake imported translator warning/u,
    );
    assert.match(result.stdout, /Untranslated unknown exact source warning/u);
    assert.match(result.stdout, /Untranslated literal interpolation warning/u);
    for (const source of [
      "Untranslated aliased exact source warning",
      "Untranslated object exact source warning",
      "Untranslated array exact source warning",
      "Untranslated stored template warning",
      "Untranslated stored params warning",
      "Untranslated wrapped interpolation warning",
      "Untranslated provider interpolation warning",
    ]) {
      assert.match(result.stdout, new RegExp(source, "u"));
    }
    assert.ok(
      result.stdout.includes(
        "[template] `Untranslated stored dynamic ${count}` => UNCLASSIFIED",
      ),
      "stored dynamic aliases must stay inside the fail-closed signature gate",
    );
    assert.match(
      result.stderr,
      /unclassified customer-visible dynamic\/composed expression/u,
    );
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test("the repository checker follows wrapper and provider parameter data flow", () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "mg-i18n-wrapper-flow-"));
  writeFileSync(
    join(fixtureRoot, "WrapperBypasses.tsx"),
    [
      'import { customerWorkflowT as realKeyT } from "@/lib/i18n/customer-workflow-auth-translations";',
      'import type { CustomerWorkflowTranslationKey } from "@/lib/i18n/customer-workflow-auth-translations";',
      'import type { LocaleCode } from "@/lib/i18nConfig";',
      'const defaultWrappedT = (key: string, customer = "Untranslated isolated default parameter warning") => realKeyT("en", key as never, { customer });',
      "const restWrappedT = (...args: [LocaleCode, CustomerWorkflowTranslationKey, Record<string, string | number>]) => realKeyT(...args);",
      'const destructuredWrappedT = ({ key, customer }: { key: string; customer: string }) => realKeyT("en", key as never, { customer });',
      "export function WrapperBypasses({ translationKey }: { translationKey: string }) {",
      "  return <>",
      "    <p>{defaultWrappedT(translationKey)}</p>",
      '    <p>{restWrappedT("en", translationKey as never, { customer: "Untranslated isolated rest spread warning" })}</p>',
      '    <p>{destructuredWrappedT({ key: translationKey, customer: "Untranslated isolated destructured wrapper warning" })}</p>',
      "  </>;",
      "}",
    ].join("\n"),
    "utf8",
  );
  writeFileSync(
    join(fixtureRoot, "ProviderBypasses.tsx"),
    [
      'import { customerWorkflowT as realKeyT } from "@/lib/i18n/customer-workflow-auth-translations";',
      'import type { CustomerWorkflowTranslationKey } from "@/lib/i18n/customer-workflow-auth-translations";',
      'import type { LocaleCode } from "@/lib/i18nConfig";',
      'function useDefaultProvider() { return { t: (key: string, customer = "Untranslated isolated provider default warning") => realKeyT("en", key as never, { customer }) }; }',
      "function useRestProvider() { return { t: (...args: [LocaleCode, CustomerWorkflowTranslationKey, Record<string, string | number>]) => realKeyT(...args) }; }",
      'function useDestructuredProvider() { return { t: ({ key, customer }: { key: string; customer: string }) => realKeyT("en", key as never, { customer }) }; }',
      "export function ProviderBypasses({ translationKey }: { translationKey: string }) {",
      "  const { t: defaultProviderT } = useDefaultProvider();",
      "  const { t: restProviderT } = useRestProvider();",
      "  const { t: destructuredProviderT } = useDestructuredProvider();",
      "  return <>",
      "    <p>{defaultProviderT(translationKey)}</p>",
      '    <p>{restProviderT("en", translationKey as never, { customer: "Untranslated isolated provider rest warning" })}</p>',
      '    <p>{destructuredProviderT({ key: translationKey, customer: "Untranslated isolated provider destructured warning" })}</p>',
      "  </>;",
      "}",
    ].join("\n"),
    "utf8",
  );
  writeFileSync(
    join(fixtureRoot, "ShadowBypass.tsx"),
    [
      'import { customerWorkflowT } from "@/lib/i18n/customer-workflow-auth-translations";',
      'import type { CustomerWorkflowTranslationKey } from "@/lib/i18n/customer-workflow-auth-translations";',
      'import type { LocaleCode } from "@/lib/i18nConfig";',
      "export function invokeAuthenticTranslator(locale: LocaleCode, translationKey: CustomerWorkflowTranslationKey) {",
      "  return customerWorkflowT(locale, translationKey, {});",
      "}",
      "function ShadowedTranslator({ customerWorkflowT, locale, translationKey }: { customerWorkflowT: (locale: LocaleCode, translationKey: CustomerWorkflowTranslationKey, values: Record<string, string | number>) => string; locale: LocaleCode; translationKey: CustomerWorkflowTranslationKey }) {",
      '  return <p>{customerWorkflowT(locale, translationKey, { customer: "Untranslated isolated same-name shadow warning" })}</p>;',
      "}",
      "export function ShadowBypass({ locale, translationKey }: { locale: LocaleCode; translationKey: CustomerWorkflowTranslationKey }) {",
      "  return <ShadowedTranslator customerWorkflowT={(_locale, _translationKey, values) => String(values.customer)} locale={locale} translationKey={translationKey} />;",
      "}",
    ].join("\n"),
    "utf8",
  );

  try {
    const result = spawnSync(
      process.execPath,
      ["node_modules/tsx/dist/cli.mjs", "scripts/check-customer-i18n.ts"],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          I18N_AUDIT_EXTRA_ROOT: fixtureRoot,
          I18N_REPORT_DYNAMIC: "1",
          I18N_REPORT_SOURCE_GAPS: "1",
        },
      },
    );

    assert.equal(result.status, 1, result.stdout);
    for (const source of [
      "Untranslated isolated default parameter warning",
      "Untranslated isolated rest spread warning",
      "Untranslated isolated destructured wrapper warning",
      "Untranslated isolated provider default warning",
      "Untranslated isolated provider rest warning",
      "Untranslated isolated provider destructured warning",
      "Untranslated isolated same-name shadow warning",
    ]) {
      assert.match(result.stdout, new RegExp(source, "u"));
    }
    assert.match(result.stderr, /reviewed English fallback/u);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test("the repository checker follows scoped and assigned static visible copy", () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "mg-i18n-static-edge-"));
  const fixture = join(fixtureRoot, "StaticEdgeBypasses.tsx");
  writeFileSync(
    fixture,
    [
      'import { customerWorkflowExactT as realExactT } from "@/lib/i18n/customer-workflow-auth-translations";',
      'let mutableCopy = { warning: "ECU" };',
      'mutableCopy.warning = "Adversarial mutated exact source warning";',
      'const objectCopy = { warning: "Adversarial object-destructured visible warning" } as const;',
      "const { warning: objectWarning } = objectCopy;",
      'const arrayCopy = ["Adversarial array-destructured visible warning"] as const;',
      "const [arrayWarning] = arrayCopy;",
      'enum EnumCopy { Warning = "Adversarial enum member warning" }',
      'class StaticCopy { static readonly warning = "Adversarial class static warning"; }',
      "function FirstShadow() {",
      '  const repeatedCopy = "Adversarial duplicate-scope warning";',
      "  return <p>{repeatedCopy}</p>;",
      "}",
      "function SecondShadow() {",
      '  const repeatedCopy = "ECU";',
      "  return <p>{repeatedCopy}</p>;",
      "}",
      'function PropDefault({ warning = "Adversarial prop default warning" }: { warning?: string }) {',
      "  return <p>{warning}</p>;",
      "}",
      "export function StaticEdgeBypasses({ orValue, andGate, nullishValue }: { orValue: string; andGate: boolean; nullishValue: string | null }) {",
      '  const storedOrWarning = orValue || "Adversarial stored logical OR warning";',
      '  const storedAndWarning = andGate && "Adversarial stored logical AND warning";',
      '  const storedNullishWarning = nullishValue ?? "Adversarial stored logical nullish warning";',
      "  return <>",
      '    <p>{realExactT("en", mutableCopy.warning)}</p>',
      "    <FirstShadow />",
      "    <SecondShadow />",
      "    <p>{objectWarning}</p>",
      "    <p>{arrayWarning}</p>",
      "    <PropDefault />",
      "    <p>{storedOrWarning}</p>",
      "    <p>{storedAndWarning}</p>",
      "    <p>{storedNullishWarning}</p>",
      "    <p>{EnumCopy.Warning}</p>",
      "    <p>{StaticCopy.warning}</p>",
      "  </>;",
      "}",
    ].join("\n"),
    "utf8",
  );

  try {
    const result = spawnSync(
      process.execPath,
      ["node_modules/tsx/dist/cli.mjs", "scripts/check-customer-i18n.ts"],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          I18N_AUDIT_EXTRA_ROOT: fixture,
          I18N_REPORT_DYNAMIC: "1",
          I18N_REPORT_SOURCE_GAPS: "1",
        },
      },
    );

    assert.equal(result.status, 1, result.stdout);
    for (const source of [
      "Adversarial mutated exact source warning",
      "Adversarial duplicate-scope warning",
      "Adversarial object-destructured visible warning",
      "Adversarial array-destructured visible warning",
      "Adversarial prop default warning",
      "Adversarial stored logical OR warning",
      "Adversarial stored logical AND warning",
      "Adversarial stored logical nullish warning",
      "Adversarial enum member warning",
      "Adversarial class static warning",
    ]) {
      assert.match(result.stdout, new RegExp(source, "u"));
    }
    assert.match(result.stderr, /reviewed English fallback/u);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test("the repository checker follows relative imports of static visible copy", () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "mg-i18n-imported-copy-"));
  writeFileSync(
    join(fixtureRoot, "copy.ts"),
    'export const importedCopy = "Adversarial imported constant warning";\n',
    "utf8",
  );
  writeFileSync(
    join(fixtureRoot, "ImportedCopy.tsx"),
    [
      'import { importedCopy } from "./copy";',
      "export function ImportedCopy() {",
      "  return <p>{importedCopy}</p>;",
      "}",
    ].join("\n"),
    "utf8",
  );

  try {
    const result = spawnSync(
      process.execPath,
      ["node_modules/tsx/dist/cli.mjs", "scripts/check-customer-i18n.ts"],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          I18N_AUDIT_EXTRA_ROOT: fixtureRoot,
          I18N_REPORT_SOURCE_GAPS: "1",
        },
      },
    );

    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stdout, /Adversarial imported constant warning/u);
    assert.match(result.stderr, /reviewed English fallback/u);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test("the repository checker accepts structural wrapper keys and technical invariants", () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "mg-i18n-wrapper-invariant-"));
  const fixture = join(fixtureRoot, "TypedWrapperInvariant.tsx");
  writeFileSync(
    fixture,
    [
      'import { customerWorkflowT as realKeyT } from "@/lib/i18n/customer-workflow-auth-translations";',
      'const translationKey = "supportSummary" as never;',
      'const c = ({ key, customer }: { key: string; customer: string }) => realKeyT("en", key as never, { customer });',
      "export function TypedWrapperInvariant() {",
      '  return <p>{c({ key: translationKey, customer: "ECU" })}</p>;',
      "}",
    ].join("\n"),
    "utf8",
  );

  try {
    const result = spawnSync(
      process.execPath,
      ["node_modules/tsx/dist/cli.mjs", "scripts/check-customer-i18n.ts"],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          I18N_AUDIT_EXTRA_ROOT: fixture,
        },
      },
    );

    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test("reviewed source-identical targets are exact locale and source pairs", () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "mg-i18n-reviewed-cognate-"));
  const fixture = join(fixtureRoot, "ReviewedCognate.tsx");
  writeFileSync(
    fixture,
    [
      "export function ReviewedCognate() {",
      "  return <p>Service</p>;",
      "}",
    ].join("\n"),
    "utf8",
  );

  try {
    const result = spawnSync(
      process.execPath,
      ["node_modules/tsx/dist/cli.mjs", "scripts/check-customer-i18n.ts"],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          I18N_AUDIT_EXTRA_ROOT: fixture,
        },
      },
    );

    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test("short and supplemental source-identical targets fail without an exact review", () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "mg-i18n-unreviewed-same-"));
  const widgetRoot = join(fixtureRoot, "src", "components", "widget");
  mkdirSync(widgetRoot, { recursive: true });
  writeFileSync(
    join(fixtureRoot, "ShortCopy.tsx"),
    [
      "export function ShortCopy() {",
      "  return <p>Late support</p>;",
      "}",
    ].join("\n"),
    "utf8",
  );
  writeFileSync(
    join(widgetRoot, "SupplementalCopy.tsx"),
    [
      "export function SupplementalCopy() {",
      "  return <p>Privacy</p>;",
      "}",
    ].join("\n"),
    "utf8",
  );

  try {
    const result = spawnSync(
      process.execPath,
      ["node_modules/tsx/dist/cli.mjs", "scripts/check-customer-i18n.ts"],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          I18N_AUDIT_EXTRA_ROOT: fixtureRoot,
          I18N_REPORT_SOURCE_GAPS: "1",
        },
      },
    );
    const output = `${result.stdout}\n${result.stderr}`;

    assert.equal(result.status, 1, output);
    assert.match(output, /unreviewed source-identical target/u);
    assert.match(output, /base-exact: Late support/u);
    assert.match(output, /widget-site: Privacy/u);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test("visible angle-bracket comparisons and template placeholders cannot escape", () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "mg-i18n-special-copy-"));
  const fixture = join(fixtureRoot, "SpecialCopy.tsx");
  writeFileSync(
    fixture,
    [
      "export function SpecialCopy() {",
      '  const review = "Review {items} before continuing";',
      "  return <section><p>Torque > limit</p><p>{review}</p></section>;",
      "}",
    ].join("\n"),
    "utf8",
  );

  try {
    const result = spawnSync(
      process.execPath,
      ["node_modules/tsx/dist/cli.mjs", "scripts/check-customer-i18n.ts"],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          I18N_AUDIT_EXTRA_ROOT: fixture,
          I18N_REPORT_SOURCE_GAPS: "1",
        },
      },
    );
    const output = `${result.stdout}\n${result.stderr}`;

    assert.equal(result.status, 1, output);
    assert.match(output, /Torque > limit/u);
    assert.match(output, /Review \{items\} before continuing/u);
    assert.doesNotMatch(output, /<section>|<p>/u);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test("common workflow words are never globally exempt when rendered", () => {
  const fixtureRoot = mkdtempSync(
    join(tmpdir(), "mg-i18n-visible-workflow-words-"),
  );
  const fixture = join(fixtureRoot, "VisibleWorkflowWords.tsx");
  writeFileSync(
    fixture,
    [
      "export function VisibleWorkflowWords() {",
      "  return <><button>login</button><span>dashboard</span><p>active</p><div>all</div></>;",
      "}",
    ].join("\n"),
    "utf8",
  );

  try {
    const result = spawnSync(
      process.execPath,
      ["node_modules/tsx/dist/cli.mjs", "scripts/check-customer-i18n.ts"],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          I18N_AUDIT_EXTRA_ROOT: fixture,
          I18N_REPORT_SOURCE_GAPS: "1",
        },
      },
    );
    const output = `${result.stdout}\n${result.stderr}`;
    assert.equal(result.status, 1, output);
    for (const value of ["login", "dashboard", "active", "all"]) {
      assert.match(output, new RegExp(`- ${value} <=`, "u"));
    }
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test("non-rendered workflow identifiers do not become translation copy", () => {
  const fixtureRoot = mkdtempSync(
    join(tmpdir(), "mg-i18n-structural-workflow-words-"),
  );
  const fixture = join(fixtureRoot, "StructuralWorkflowWords.tsx");
  writeFileSync(
    fixture,
    [
      'const route = "login";',
      'const section = "dashboard";',
      'const status = "active";',
      'const scope = "all";',
      'const items = [{ activeKey: "dashboard", label: "ECU" }];',
      'function StructuralItem({ active }: { active: boolean }) { return <p>{active ? "ECU" : null}</p>; }',
      "function StructuralTab(_props: { value: string; activeView: string; onView: (value: string) => void; label: string }) { return <p>ECU</p>; }",
      'export function StructuralWorkflowWords({ activeItem = "dashboard" }) {',
      "  void route; void section; void status; void scope;",
      '  return <><StructuralTab value="overview" activeView="overview" onView={() => undefined} label="ECU" />{items.map((item) => <StructuralItem active={item.activeKey === activeItem} />)}</>;',
      "}",
    ].join("\n"),
    "utf8",
  );

  try {
    const result = spawnSync(
      process.execPath,
      ["node_modules/tsx/dist/cli.mjs", "scripts/check-customer-i18n.ts"],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          I18N_AUDIT_EXTRA_ROOT: fixture,
          I18N_REPORT_SOURCE_GAPS: "1",
        },
      },
    );
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.doesNotMatch(
      result.stdout,
      /^- (?:login|dashboard|active|all) <=/mu,
    );
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test("an unrelated parameter shadow does not invalidate an authentic translator import", () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "mg-i18n-local-shadow-"));
  const fixture = join(fixtureRoot, "LocalTranslatorShadow.tsx");
  writeFileSync(
    fixture,
    [
      'import { customerWorkflowT } from "@/lib/i18n/customer-workflow-auth-translations";',
      "export function UnrelatedShadow({ customerWorkflowT }: { customerWorkflowT: () => string }) {",
      "  void customerWorkflowT;",
      "  return null;",
      "}",
      "export function AuthenticTranslatorUse() {",
      '  return <p>{customerWorkflowT("en", "supportSummary" as never, { customer: "ECU" })}</p>;',
      "}",
    ].join("\n"),
    "utf8",
  );

  try {
    const result = spawnSync(
      process.execPath,
      ["node_modules/tsx/dist/cli.mjs", "scripts/check-customer-i18n.ts"],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          I18N_AUDIT_EXTRA_ROOT: fixture,
        },
      },
    );

    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test("an unrelated property mutation does not taint visible invariant copy", () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "mg-i18n-internal-mutation-"));
  const fixture = join(fixtureRoot, "InternalPropertyMutation.tsx");
  writeFileSync(
    fixture,
    [
      'import { customerWorkflowExactT as realExactT } from "@/lib/i18n/customer-workflow-auth-translations";',
      'const copy = { warning: "ECU", internal: "ECU" };',
      'copy.internal = "Adversarial internal routing sentinel";',
      "export function InternalPropertyMutation() {",
      '  return <p>{realExactT("en", copy.warning)}</p>;',
      "}",
    ].join("\n"),
    "utf8",
  );

  try {
    const result = spawnSync(
      process.execPath,
      ["node_modules/tsx/dist/cli.mjs", "scripts/check-customer-i18n.ts"],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          I18N_AUDIT_EXTRA_ROOT: fixture,
        },
      },
    );

    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test("a destructured key flowing into audited wrapper interpolation is reported", () => {
  const fixtureRoot = mkdtempSync(
    join(tmpdir(), "mg-i18n-audited-wrapper-key-"),
  );
  const fixture = join(fixtureRoot, "AuditedWrapperKey.tsx");
  writeFileSync(
    fixture,
    [
      'import { customerWorkflowT as realKeyT } from "@/lib/i18n/customer-workflow-auth-translations";',
      'const c = ({ key }: { key: string }) => realKeyT("en", "supportSummary" as never, { customer: key });',
      "export function AuditedWrapperKey({ left, right }: { left: string; right: string }) {",
      "  const args = { key: `Adversarial destructured audited key warning ${left}${right}` };",
      "  return <p>{c(args)}</p>;",
      "}",
    ].join("\n"),
    "utf8",
  );

  try {
    const result = spawnSync(
      process.execPath,
      ["node_modules/tsx/dist/cli.mjs", "scripts/check-customer-i18n.ts"],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          I18N_AUDIT_EXTRA_ROOT: fixture,
          I18N_REPORT_DYNAMIC: "1",
          I18N_REPORT_SOURCE_GAPS: "1",
        },
      },
    );

    assert.equal(result.status, 1, result.stdout);
    assert.match(
      result.stdout,
      /Adversarial destructured audited key warning/u,
    );
    assert.ok(
      result.stdout.includes(
        "[template] `Adversarial destructured audited key warning ${left}${right}` => UNCLASSIFIED",
      ),
      "aliased dynamic structural fields must stay inside the fail-closed signature gate",
    );
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test("provider key and kind fields flowing into audited interpolation are reported", () => {
  const fixtureRoot = mkdtempSync(
    join(tmpdir(), "mg-i18n-audited-provider-fields-"),
  );
  const fixture = join(fixtureRoot, "AuditedProviderFields.tsx");
  writeFileSync(
    fixture,
    [
      'import { customerWorkflowT as realKeyT } from "@/lib/i18n/customer-workflow-auth-translations";',
      'function useCopy() { return { t: ({ key, kind }: { key: string; kind: string }) => realKeyT("en", "supportSummary" as never, { customer: key, kind }) }; }',
      "export function AuditedProviderFields() {",
      "  const { t } = useCopy();",
      '  return <p>{t({ key: "Adversarial provider audited key warning", kind: "Adversarial provider audited kind warning" })}</p>;',
      "}",
    ].join("\n"),
    "utf8",
  );

  try {
    const result = spawnSync(
      process.execPath,
      ["node_modules/tsx/dist/cli.mjs", "scripts/check-customer-i18n.ts"],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          I18N_AUDIT_EXTRA_ROOT: fixture,
          I18N_REPORT_SOURCE_GAPS: "1",
        },
      },
    );

    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stdout, /Adversarial provider audited key warning/u);
    assert.match(result.stdout, /Adversarial provider audited kind warning/u);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test("an aliased mutation of visible exact copy is reported", () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "mg-i18n-aliased-mutation-"));
  const fixture = join(fixtureRoot, "AliasedVisibleMutation.tsx");
  writeFileSync(
    fixture,
    [
      'import { customerWorkflowExactT as realExactT } from "@/lib/i18n/customer-workflow-auth-translations";',
      'const copy = { warning: "ECU" };',
      "const alias = copy;",
      'alias.warning = "Adversarial aliased mutation warning";',
      "export function AliasedVisibleMutation() {",
      '  return <p>{realExactT("en", copy.warning)}</p>;',
      "}",
    ].join("\n"),
    "utf8",
  );

  try {
    const result = spawnSync(
      process.execPath,
      ["node_modules/tsx/dist/cli.mjs", "scripts/check-customer-i18n.ts"],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          I18N_AUDIT_EXTRA_ROOT: fixture,
          I18N_REPORT_SOURCE_GAPS: "1",
        },
      },
    );

    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stdout, /Adversarial aliased mutation warning/u);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test("Object.assign mutation of visible exact copy is reported", () => {
  const fixtureRoot = mkdtempSync(
    join(tmpdir(), "mg-i18n-object-assign-mutation-"),
  );
  const fixture = join(fixtureRoot, "ObjectAssignVisibleMutation.tsx");
  writeFileSync(
    fixture,
    [
      'import { customerWorkflowExactT as realExactT } from "@/lib/i18n/customer-workflow-auth-translations";',
      'const copy = { warning: "ECU" };',
      'Object.assign(copy, { warning: "Adversarial Object.assign mutation warning" });',
      "export function ObjectAssignVisibleMutation() {",
      '  return <p>{realExactT("en", copy.warning)}</p>;',
      "}",
    ].join("\n"),
    "utf8",
  );

  try {
    const result = spawnSync(
      process.execPath,
      ["node_modules/tsx/dist/cli.mjs", "scripts/check-customer-i18n.ts"],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          I18N_AUDIT_EXTRA_ROOT: fixture,
          I18N_REPORT_SOURCE_GAPS: "1",
        },
      },
    );

    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stdout, /Adversarial Object\.assign mutation warning/u);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test("an unrelated Object.assign property does not taint visible invariant copy", () => {
  const fixtureRoot = mkdtempSync(
    join(tmpdir(), "mg-i18n-object-assign-property-"),
  );
  const fixture = join(fixtureRoot, "ObjectAssignInternalMutation.tsx");
  writeFileSync(
    fixture,
    [
      'import { customerWorkflowExactT as realExactT } from "@/lib/i18n/customer-workflow-auth-translations";',
      'const copy = { warning: "ECU", internal: "ECU" };',
      'Object.assign(copy, { internal: "Adversarial unrelated Object.assign sentinel" });',
      "export function ObjectAssignInternalMutation() {",
      '  return <p>{realExactT("en", copy.warning)}</p>;',
      "}",
    ].join("\n"),
    "utf8",
  );

  try {
    const result = spawnSync(
      process.execPath,
      ["node_modules/tsx/dist/cli.mjs", "scripts/check-customer-i18n.ts"],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          I18N_AUDIT_EXTRA_ROOT: fixture,
        },
      },
    );

    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test("transparent static wrappers and constructors cannot hide visible exact copy", () => {
  const fixtureRoot = mkdtempSync(
    join(tmpdir(), "mg-i18n-object-wrapper-copy-"),
  );
  const fixture = join(fixtureRoot, "ObjectWrappedVisibleCopy.tsx");
  writeFileSync(
    fixture,
    [
      'import { customerWorkflowExactT as realExactT } from "@/lib/i18n/customer-workflow-auth-translations";',
      'const frozenCopy = Object.freeze({ warning: "Adversarial Object.freeze visible warning" });',
      'const sealedCopy = Object.seal({ warning: "Adversarial Object.seal visible warning" });',
      'const boundedCopy = Object.preventExtensions({ warning: "Adversarial Object.preventExtensions visible warning" });',
      'const clonedCopy = structuredClone({ warning: "Adversarial structuredClone visible warning" });',
      'const clonedWithOptions = structuredClone({ warning: "Adversarial structuredClone options visible warning" }, { transfer: [] });',
      'const arrayCopy = Array.from(["Adversarial Array.from visible warning"]);',
      'const mappedArrayCopy = Array.from(["ECU"], () => "Adversarial Array.from mapper visible warning");',
      'const arrayOfCopy = Array.of("Adversarial Array.of visible warning");',
      'const newArrayCopy = new Array("Adversarial new Array visible warning");',
      'const cloneSource = { warning: "ECU" };',
      'cloneSource.warning = "Adversarial structuredClone source mutation warning";',
      "const clonedMutatedSource = structuredClone(cloneSource);",
      'const arraySource = ["ECU"];',
      'arraySource[0] = "Adversarial Array.from source mutation warning";',
      "const arrayMutatedSource = Array.from(arraySource);",
      "export function ObjectWrappedVisibleCopy() {",
      '  return <>{realExactT("en", frozenCopy.warning)} {realExactT("en", sealedCopy.warning)} {realExactT("en", boundedCopy.warning)} {realExactT("en", clonedCopy.warning)} {realExactT("en", clonedWithOptions.warning)} {realExactT("en", arrayCopy[0])} {realExactT("en", mappedArrayCopy[0])} {realExactT("en", arrayOfCopy[0])} {realExactT("en", newArrayCopy[0])} {realExactT("en", clonedMutatedSource.warning)} {realExactT("en", arrayMutatedSource[0])}</>;',
      "}",
    ].join("\n"),
    "utf8",
  );

  try {
    const result = spawnSync(
      process.execPath,
      ["node_modules/tsx/dist/cli.mjs", "scripts/check-customer-i18n.ts"],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          I18N_AUDIT_EXTRA_ROOT: fixture,
          I18N_REPORT_SOURCE_GAPS: "1",
        },
      },
    );

    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stdout, /Adversarial Object\.freeze visible warning/u);
    assert.match(result.stdout, /Adversarial Object\.seal visible warning/u);
    assert.match(
      result.stdout,
      /Adversarial Object\.preventExtensions visible warning/u,
    );
    assert.match(result.stdout, /Adversarial structuredClone visible warning/u);
    assert.match(
      result.stdout,
      /Adversarial structuredClone options visible warning/u,
    );
    assert.match(result.stdout, /Adversarial Array\.from visible warning/u);
    assert.match(
      result.stdout,
      /Adversarial Array\.from mapper visible warning/u,
    );
    assert.match(result.stdout, /Adversarial Array\.of visible warning/u);
    assert.match(result.stdout, /Adversarial new Array visible warning/u);
    assert.match(
      result.stdout,
      /Adversarial structuredClone source mutation warning/u,
    );
    assert.match(
      result.stdout,
      /Adversarial Array\.from source mutation warning/u,
    );
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test("transitive and initializer Object.assign copy remains visible", () => {
  const fixtureRoot = mkdtempSync(
    join(tmpdir(), "mg-i18n-object-assign-flow-"),
  );
  const fixture = join(fixtureRoot, "ObjectAssignStaticFlow.tsx");
  writeFileSync(
    fixture,
    [
      'import { customerWorkflowExactT as realExactT } from "@/lib/i18n/customer-workflow-auth-translations";',
      'const directTarget = { warning: "ECU" };',
      'const directSource = { warning: "ECU" };',
      'directSource.warning = "Adversarial transitive direct assignment warning";',
      "directTarget.warning = directSource.warning;",
      'const mergeTarget = { warning: "ECU" };',
      'const mergeSource = { warning: "ECU" };',
      'mergeSource.warning = "Adversarial transitive Object.assign warning";',
      "Object.assign(mergeTarget, mergeSource);",
      'const merged = Object.assign({}, { warning: "Adversarial Object.assign initializer warning" });',
      'const chainedTarget = { warning: "ECU" };',
      "Object.assign(chainedTarget, merged);",
      "export function ObjectAssignStaticFlow() {",
      '  return <>{realExactT("en", directTarget.warning)} {realExactT("en", mergeTarget.warning)} {realExactT("en", chainedTarget.warning)}</>;',
      "}",
    ].join("\n"),
    "utf8",
  );

  try {
    const result = spawnSync(
      process.execPath,
      ["node_modules/tsx/dist/cli.mjs", "scripts/check-customer-i18n.ts"],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          I18N_AUDIT_EXTRA_ROOT: fixture,
          I18N_REPORT_SOURCE_GAPS: "1",
        },
      },
    );

    assert.equal(result.status, 1, result.stdout);
    for (const source of [
      "Adversarial transitive direct assignment warning",
      "Adversarial transitive Object.assign warning",
      "Adversarial Object.assign initializer warning",
    ]) {
      assert.match(result.stdout, new RegExp(source, "u"));
    }
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test("a transformed wrapper key is audited instead of trusted", () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "mg-i18n-transformed-key-"));
  const fixture = join(fixtureRoot, "TransformedWrapperKey.tsx");
  writeFileSync(
    fixture,
    [
      'import { customerWorkflowT as realKeyT } from "@/lib/i18n/customer-workflow-auth-translations";',
      'const wrappedT = (key: string) => realKeyT("en", key.trim() as never, {});',
      "export function TransformedWrapperKey() {",
      '  return <p>{wrappedT("Adversarial transformed wrapper key warning")}</p>;',
      "}",
    ].join("\n"),
    "utf8",
  );

  try {
    const result = spawnSync(
      process.execPath,
      ["node_modules/tsx/dist/cli.mjs", "scripts/check-customer-i18n.ts"],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          I18N_AUDIT_EXTRA_ROOT: fixture,
          I18N_REPORT_SOURCE_GAPS: "1",
        },
      },
    );

    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stdout, /Adversarial transformed wrapper key warning/u);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test("stored message descriptors preserve path-sensitive control keys", () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "mg-i18n-stored-descriptor-"));
  const fixture = join(fixtureRoot, "StoredMessageDescriptor.tsx");
  writeFileSync(
    fixture,
    [
      'import { localizeDtcAnalyzerMessage } from "@/lib/i18n/dtc-analyzer-translations";',
      'import type { DtcAnalyzerMessageDescriptor } from "@/lib/dtcAnalyzer/types";',
      'const descriptor: DtcAnalyzerMessageDescriptor = { key: "state.no_request_text", fallback: "ECU" };',
      'const localize = (value: DtcAnalyzerMessageDescriptor) => localizeDtcAnalyzerMessage("en", value);',
      "export function StoredMessageDescriptor() {",
      '  return <>{localizeDtcAnalyzerMessage("en", descriptor)} {localize({ key: "state.no_request_text", fallback: "ECU" })}</>;',
      "}",
    ].join("\n"),
    "utf8",
  );

  try {
    const result = spawnSync(
      process.execPath,
      ["node_modules/tsx/dist/cli.mjs", "scripts/check-customer-i18n.ts"],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          I18N_AUDIT_EXTRA_ROOT: fixture,
        },
      },
    );

    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test("function var scope, duplicate var and array rest aliases remain visible", () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "mg-i18n-static-scope-rest-"));
  const fixture = join(fixtureRoot, "StaticScopeAndRest.tsx");
  writeFileSync(
    fixture,
    [
      "export function FunctionScopedVar() {",
      '  if (true) { var warning = "Adversarial function-scoped var warning"; }',
      "  return <p>{warning}</p>;",
      "}",
      "export function DuplicateVar() {",
      '  var warning = "ECU";',
      '  var warning = "Adversarial duplicate var binding warning";',
      "  return <p>{warning}</p>;",
      "}",
      "export function DuplicateVarNoInitializer() {",
      '  var warning = "Adversarial duplicate var no-initializer warning";',
      "  var warning: string;",
      "  return <p>{warning}</p>;",
      "}",
      "export function TemporalVar() {",
      '  var warning = "Adversarial duplicate var temporal warning";',
      "  const visible = <p>{warning}</p>;",
      '  var warning = "ECU";',
      "  return visible;",
      "}",
      'export function ParameterVar(warning: string = "ECU") {',
      '  var warning = "Adversarial parameter var binding warning";',
      "  return <p>{warning}</p>;",
      "}",
      'const copy = ["ECU", "Adversarial array rest alias warning"] as const;',
      "const [, ...rest] = copy;",
      "const restAlias = rest;",
      "export function ArrayRestAlias() {",
      "  return <p>{rest[0]} {restAlias[0]}</p>;",
      "}",
    ].join("\n"),
    "utf8",
  );

  try {
    const result = spawnSync(
      process.execPath,
      ["node_modules/tsx/dist/cli.mjs", "scripts/check-customer-i18n.ts"],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          I18N_AUDIT_EXTRA_ROOT: fixture,
          I18N_REPORT_SOURCE_GAPS: "1",
        },
      },
    );

    assert.equal(result.status, 1, result.stdout);
    for (const source of [
      "Adversarial function-scoped var warning",
      "Adversarial duplicate var binding warning",
      "Adversarial duplicate var no-initializer warning",
      "Adversarial duplicate var temporal warning",
      "Adversarial parameter var binding warning",
      "Adversarial array rest alias warning",
    ]) {
      assert.match(result.stdout, new RegExp(source, "u"));
    }
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test("reassigned wrapper and provider bindings lose translator trust", () => {
  const fixtureRoot = mkdtempSync(
    join(tmpdir(), "mg-i18n-reassigned-translator-"),
  );
  const fixture = join(fixtureRoot, "ReassignedTranslator.tsx");
  writeFileSync(
    fixture,
    [
      'import { customerWorkflowT as realKeyT } from "@/lib/i18n/customer-workflow-auth-translations";',
      'let wrappedT = (key: string) => realKeyT("en", key as never, {});',
      "wrappedT = (value: string) => value;",
      'function useCopy() { return { t: (key: string) => realKeyT("en", key as never, {}) }; }',
      "let { t } = useCopy();",
      "t = (value: string) => value;",
      "export function ReassignedTranslator() {",
      '  return <>{wrappedT("Adversarial reassigned wrapper warning")} {t("Adversarial reassigned provider warning")}</>;',
      "}",
    ].join("\n"),
    "utf8",
  );

  try {
    const result = spawnSync(
      process.execPath,
      ["node_modules/tsx/dist/cli.mjs", "scripts/check-customer-i18n.ts"],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          I18N_AUDIT_EXTRA_ROOT: fixture,
          I18N_REPORT_SOURCE_GAPS: "1",
        },
      },
    );

    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stdout, /Adversarial reassigned wrapper warning/u);
    assert.match(result.stdout, /Adversarial reassigned provider warning/u);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test("primitive snapshots and pre-rebind aliases avoid future mutation taint", () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "mg-i18n-mutation-snapshot-"));
  const fixture = join(fixtureRoot, "MutationSnapshot.tsx");
  writeFileSync(
    fixture,
    [
      'import { customerWorkflowExactT as realExactT } from "@/lib/i18n/customer-workflow-auth-translations";',
      'const primitiveCopy = { warning: "ECU" };',
      "const warningSnapshot = primitiveCopy.warning;",
      'primitiveCopy.warning = "Adversarial post-snapshot mutation sentinel";',
      'let reboundCopy = { warning: "ECU" };',
      "const oldCopy = reboundCopy;",
      'reboundCopy = { warning: "Adversarial post-alias rebind sentinel" };',
      'const cloneSource = { warning: "ECU" };',
      "const cloneSnapshot = structuredClone(cloneSource);",
      'cloneSource.warning = "Adversarial post-structuredClone mutation sentinel";',
      'const arraySource = ["ECU"];',
      "const arraySnapshot = Array.from(arraySource);",
      'arraySource[0] = "Adversarial post-Array.from mutation sentinel";',
      "export function MutationSnapshot() {",
      '  return <>{realExactT("en", warningSnapshot)} {realExactT("en", oldCopy.warning)} {realExactT("en", cloneSnapshot.warning)} {realExactT("en", arraySnapshot[0])}</>;',
      "}",
    ].join("\n"),
    "utf8",
  );

  try {
    const result = spawnSync(
      process.execPath,
      ["node_modules/tsx/dist/cli.mjs", "scripts/check-customer-i18n.ts"],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          I18N_AUDIT_EXTRA_ROOT: fixture,
        },
      },
    );

    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test("copy aliases, lexical self bindings and shallow copies cannot hide visible copy", () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "mg-i18n-copy-alias-scope-"));
  const fixture = join(fixtureRoot, "CopyAliasScope.tsx");
  writeFileSync(
    fixture,
    [
      'import { customerWorkflowExactT as realExactT } from "@/lib/i18n/customer-workflow-auth-translations";',
      "switch (Math.random()) {",
      "  case 2:",
      "    const structuredClone = <T,>(value: T): T => value;",
      "    break;",
      "}",
      'const caseClone = structuredClone({ warning: "ADV case-block global structuredClone warning" });',
      "switch (Math.random()) {",
      "  case 3:",
      "    const Array = { from<T>(value: T[]): T[] { return value; } };",
      "    break;",
      "}",
      'const caseArray = Array.from(["ADV case-block global Array.from warning"]);',
      'const globalClone = globalThis.structuredClone({ warning: "ADV globalThis structuredClone warning" });',
      'const globalFrom = globalThis.Array.from(["ADV globalThis Array.from warning"]);',
      'const bracketClone = globalThis["structuredClone"]({ warning: "ADV bracket global clone warning" });',
      'const bracketFrom = globalThis["Array"]["from"](["ADV bracket global Array.from warning"]);',
      'const bracketAssign = globalThis["Object"]["assign"]({}, { warning: "ADV bracket global Object.assign warning" });',
      'const reflectArray = Reflect.construct(Array, ["ADV Reflect.construct Array warning"]);',
      "const cloneAlias = structuredClone;",
      'const aliasClone = cloneAlias({ warning: "ADV aliased structuredClone warning" });',
      "const fromAlias = Array.from;",
      'const aliasFrom = fromAlias(["ADV aliased Array.from warning"]);',
      "const ofAlias = Array.of;",
      'const aliasOf = ofAlias("ADV aliased Array.of warning");',
      "const ArrayCtor = Array;",
      'const aliasNew = new ArrayCtor("ADV aliased new Array warning");',
      "const { structuredClone: destructuredClone } = globalThis;",
      'const destructuredCloneCopy = destructuredClone({ warning: "ADV destructured global clone warning" });',
      "const { from: destructuredFrom } = Array;",
      'const destructuredFromCopy = destructuredFrom(["ADV destructured Array.from warning"]);',
      "const [arrayBoundClone] = [structuredClone];",
      'const arrayBoundCopy = arrayBoundClone({ warning: "ADV array-bound clone warning" });',
      "const objectMethods = { clone: structuredClone };",
      'const objectBoundCopy = objectMethods.clone({ warning: "ADV object-bound clone warning" });',
      'const globalAssignCopy = globalThis.Object.assign({}, { warning: "ADV global Object.assign warning" });',
      "const assignAlias = Object.assign;",
      'const aliasAssignCopy = assignAlias({}, { warning: "ADV aliased Object.assign warning" });',
      'const branchMapped = Array.from(["STALE"], (value) => {',
      '  if (value === "ECU") return "ECU";',
      '  return "ADV branch mapper runtime warning";',
      "});",
      'const nestedFromSource = [{ warning: "ECU" }];',
      "const nestedFromCopy = Array.from(nestedFromSource);",
      'nestedFromSource[0].warning = "ADV Array.from shallow post-copy warning";',
      'const nestedOfSource = { warning: "ECU" };',
      "const nestedOfCopy = Array.of(nestedOfSource);",
      'nestedOfSource.warning = "ADV Array.of shallow post-copy warning";',
      'const nestedNewSource = { warning: "ECU" };',
      "const nestedNewCopy = new Array(nestedNewSource);",
      'nestedNewSource.warning = "ADV new Array shallow post-copy warning";',
      'const nestedAssignSource = { nested: { warning: "ECU" } };',
      "const nestedAssignCopy = Object.assign({}, nestedAssignSource);",
      'nestedAssignSource.nested.warning = "ADV Object.assign shallow post-copy warning";',
      'const objectSpreadSource = { nested: { warning: "ECU" } };',
      "const objectSpreadCopy = { ...objectSpreadSource };",
      'objectSpreadSource.nested.warning = "ADV object spread shallow post-copy warning";',
      'const arraySpreadSource = [{ warning: "ECU" }];',
      "const arraySpreadCopy = [...arraySpreadSource];",
      'arraySpreadSource[0].warning = "ADV array spread shallow post-copy warning";',
      'const sliceSource = [{ warning: "ECU" }];',
      "const sliceCopy = sliceSource.slice();",
      'sliceSource[0].warning = "ADV slice shallow post-copy warning";',
      'const mapSource = [{ warning: "ECU" }];',
      "const mapCopy = mapSource.map((value) => value);",
      'mapSource[0].warning = "ADV identity map shallow post-copy warning";',
      'const concatSource = [{ warning: "ECU" }];',
      "const concatCopy = [].concat(concatSource);",
      'concatSource[0].warning = "ADV concat shallow post-copy warning";',
      'const deepSource = { nested: { warning: "ECU" } };',
      "const deepCopy = structuredClone(deepSource);",
      'deepSource.nested.warning = "ADV structuredClone deep post-copy sentinel";',
      "const NamedFn = function structuredClone(value?: { warning: string }): any {",
      '  if (value?.warning === "ECU") return { warning: "ADV named function self-binding warning" };',
      '  const copy = structuredClone({ warning: "ECU" });',
      '  return <p>{realExactT("en", copy.warning)}</p>;',
      "};",
      "const NamedClass = class Array {",
      '  static from(_value: string[]) { return ["ADV named class self-binding warning"]; }',
      "  static render() {",
      '    const copy = Array.from(["ECU"]);',
      '    return <p>{realExactT("en", copy[0])}</p>;',
      "  }",
      "};",
      "function LocalShadowCases() {",
      "  function structuredClone<T>(value: T): T { return value; }",
      "  const Array = {",
      "    from<T>(value: T[]): T[] { return value; },",
      "    of<T>(...value: T[]): T[] { return value; },",
      "  };",
      '  const localClone = structuredClone({ warning: "ADV shadowed structuredClone warning" });',
      '  const localFrom = Array.from(["ADV shadowed Array.from warning"]);',
      '  const localOf = Array.of("ADV shadowed Array.of warning");',
      '  return <>{realExactT("en", localClone.warning)} {realExactT("en", localFrom[0])} {realExactT("en", localOf[0])}</>;',
      "}",
      "export function CopyAliasScope() {",
      "  return <>",
      '    {realExactT("en", caseClone.warning)} {realExactT("en", caseArray[0])}',
      '    {realExactT("en", globalClone.warning)} {realExactT("en", globalFrom[0])}',
      '    {realExactT("en", bracketClone.warning)} {realExactT("en", bracketFrom[0])} {realExactT("en", bracketAssign.warning)}',
      '    {realExactT("en", reflectArray[0])} {realExactT("en", aliasClone.warning)} {realExactT("en", aliasFrom[0])}',
      '    {realExactT("en", aliasOf[0])} {realExactT("en", aliasNew[0])} {realExactT("en", destructuredCloneCopy.warning)}',
      '    {realExactT("en", destructuredFromCopy[0])} {realExactT("en", arrayBoundCopy.warning)} {realExactT("en", objectBoundCopy.warning)}',
      '    {realExactT("en", globalAssignCopy.warning)} {realExactT("en", aliasAssignCopy.warning)} {realExactT("en", branchMapped[0])}',
      '    {realExactT("en", nestedFromCopy[0].warning)} {realExactT("en", nestedOfCopy[0].warning)} {realExactT("en", nestedNewCopy[0].warning)}',
      '    {realExactT("en", nestedAssignCopy.nested.warning)} {realExactT("en", objectSpreadCopy.nested.warning)}',
      '    {realExactT("en", arraySpreadCopy[0].warning)} {realExactT("en", sliceCopy[0].warning)}',
      '    {realExactT("en", mapCopy[0].warning)} {realExactT("en", concatCopy[0].warning)} {realExactT("en", deepCopy.nested.warning)}',
      "    <NamedFn /> {NamedClass.render()} <LocalShadowCases />",
      "  </>;",
      "}",
    ].join("\n"),
    "utf8",
  );

  try {
    const result = spawnSync(
      process.execPath,
      ["node_modules/tsx/dist/cli.mjs", "scripts/check-customer-i18n.ts"],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          I18N_AUDIT_EXTRA_ROOT: fixture,
          I18N_REPORT_SOURCE_GAPS: "1",
        },
      },
    );

    const output = `${result.stdout}\n${result.stderr}`;
    assert.equal(result.status, 1, output);
    for (const marker of [
      "ADV case-block global structuredClone warning",
      "ADV case-block global Array.from warning",
      "ADV globalThis structuredClone warning",
      "ADV globalThis Array.from warning",
      "ADV bracket global clone warning",
      "ADV bracket global Array.from warning",
      "ADV bracket global Object.assign warning",
      "ADV Reflect.construct Array warning",
      "ADV aliased structuredClone warning",
      "ADV aliased Array.from warning",
      "ADV aliased Array.of warning",
      "ADV aliased new Array warning",
      "ADV destructured global clone warning",
      "ADV destructured Array.from warning",
      "ADV array-bound clone warning",
      "ADV object-bound clone warning",
      "ADV global Object.assign warning",
      "ADV aliased Object.assign warning",
      "ADV branch mapper runtime warning",
      "ADV Array.from shallow post-copy warning",
      "ADV Array.of shallow post-copy warning",
      "ADV new Array shallow post-copy warning",
      "ADV Object.assign shallow post-copy warning",
      "ADV object spread shallow post-copy warning",
      "ADV array spread shallow post-copy warning",
      "ADV slice shallow post-copy warning",
      "ADV identity map shallow post-copy warning",
      "ADV concat shallow post-copy warning",
      "ADV named function self-binding warning",
      "ADV named class self-binding warning",
      "ADV shadowed structuredClone warning",
      "ADV shadowed Array.from warning",
      "ADV shadowed Array.of warning",
    ]) {
      assert.match(output, new RegExp(marker.replaceAll(".", "\\."), "u"));
    }
    assert.doesNotMatch(
      result.stdout,
      /ADV structuredClone deep post-copy sentinel/u,
    );
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test("copy and mapper semantics do not report replaced or unreachable input", () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "mg-i18n-copy-semantics-"));
  const fixture = join(fixtureRoot, "CopySemantics.tsx");
  writeFileSync(
    fixture,
    [
      'import { customerWorkflowExactT as realExactT } from "@/lib/i18n/customer-workflow-auth-translations";',
      'const replaced = Array.from(["ADV replaced Array.from input sentinel"], () => "ECU");',
      'const branchMapped = Array.from(["ECU"], (value) => {',
      '  if (value === "ECU") return "ECU";',
      '  return "ADV unreachable mapper branch sentinel";',
      "});",
      'const ternaryMapped = Array.from(["ECU"], (value) => value === "ECU" ? "ECU" : "ADV unreachable ternary mapper sentinel");',
      'const switchMapped = Array.from(["ECU"], (value) => {',
      "  switch (value) {",
      '    case "ECU": return "ECU";',
      '    default: return "ADV unreachable switch mapper sentinel";',
      "  }",
      "});",
      'const deepSource = { nested: { warning: "ECU" } };',
      "const deepCopy = structuredClone(deepSource);",
      'deepSource.nested.warning = "ADV deep clone post-copy sentinel";',
      "function LocalShadowCases() {",
      '  const structuredClone = (_value: { warning: string }) => ({ warning: "ECU" });',
      "  const Array = {",
      '    from(_value: string[]) { return ["ECU"]; },',
      '    of(..._value: string[]) { return ["ECU"]; },',
      "  };",
      '  const clone = structuredClone({ warning: "ADV dropped local clone input sentinel" });',
      '  const from = Array.from(["ADV dropped local Array.from input sentinel"]);',
      '  const of = Array.of("ADV dropped local Array.of input sentinel");',
      '  return <>{realExactT("en", clone.warning)} {realExactT("en", from[0])} {realExactT("en", of[0])}</>;',
      "}",
      "function LocalConstructorCase() {",
      "  class Array {",
      '    readonly value = "ECU";',
      "    constructor(_value: string) {}",
      "  }",
      '  const constructed = new Array("ADV dropped local class constructor input sentinel");',
      '  return <>{realExactT("en", constructed.value)}</>;',
      "}",
      "export function CopySemantics() {",
      '  return <>{realExactT("en", replaced[0])} {realExactT("en", branchMapped[0])} {realExactT("en", ternaryMapped[0])} {realExactT("en", switchMapped[0])} {realExactT("en", deepCopy.nested.warning)} <LocalShadowCases /> <LocalConstructorCase /></>;',
      "}",
    ].join("\n"),
    "utf8",
  );

  try {
    const result = spawnSync(
      process.execPath,
      ["node_modules/tsx/dist/cli.mjs", "scripts/check-customer-i18n.ts"],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          I18N_AUDIT_EXTRA_ROOT: fixture,
          I18N_REPORT_SOURCE_GAPS: "1",
        },
      },
    );

    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.doesNotMatch(result.stdout, /ADV /u);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test("callable Array and every supported shallow-copy position remain visible", () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "mg-i18n-complete-shallow-"));
  const fixture = join(fixtureRoot, "CompleteShallowCopy.tsx");
  writeFileSync(
    fixture,
    [
      'import { customerWorkflowExactT as realExactT } from "@/lib/i18n/customer-workflow-auth-translations";',
      'const cloneKey = "structuredClone" as const;',
      'const arrayKey = "Array" as const;',
      'const fromKey = "from" as const;',
      'const computedClone = globalThis[cloneKey]({ warning: "ADV computed global clone warning" });',
      'const computedFrom = globalThis[arrayKey][fromKey](["ADV computed global Array.from warning"]);',
      "const { [cloneKey]: computedDestructuredClone } = globalThis;",
      'const computedDestructuredCloneCopy = computedDestructuredClone({ warning: "ADV computed destructured clone warning" });',
      "const { [fromKey]: computedDestructuredFrom } = globalThis.Array;",
      'const computedDestructuredFromCopy = computedDestructuredFrom(["ADV computed destructured Array.from warning"]);',
      'const directArray = Array("ADV direct callable Array warning");',
      'const globalArray = globalThis.Array("ADV global callable Array warning");',
      "const CallableArray = Array;",
      'const aliasArray = CallableArray("ADV aliased callable Array warning");',
      'const shared = { warning: "ECU" };',
      "const sharedSource = [shared];",
      "const sharedCopy = Array.from(sharedSource);",
      'shared.warning = "ADV Array.from shared binding post-copy warning";',
      'const directShared = { warning: "ECU" };',
      "const directSharedCopy = Array.from([directShared]);",
      'directShared.warning = "ADV Array.from direct shared binding warning";',
      'const nonfirstSpreadSource = [{ warning: "ECU" }];',
      'const nonfirstSpreadCopy = [{ warning: "ECU" }, ...nonfirstSpreadSource];',
      'nonfirstSpreadSource[0].warning = "ADV nonfirst array spread shallow warning";',
      'const firstSpreadSource = [{ warning: "ECU" }];',
      'const secondSpreadSource = [{ warning: "ECU" }];',
      "const multiSpreadCopy = [...firstSpreadSource, ...secondSpreadSource];",
      'secondSpreadSource[0].warning = "ADV second array spread shallow warning";',
      'const sliceZeroSource = [{ warning: "ECU" }];',
      "const sliceZeroCopy = sliceZeroSource.slice(0);",
      'sliceZeroSource[0].warning = "ADV slice-zero shallow warning";',
      'const sliceBoundsSource = [{ warning: "ECU" }];',
      "const sliceBoundsCopy = sliceBoundsSource.slice(0, sliceBoundsSource.length);",
      'sliceBoundsSource[0].warning = "ADV slice-bounds shallow warning";',
      'const firstConcatSource = [{ warning: "ECU" }];',
      'const secondConcatSource = [{ warning: "ECU" }];',
      "const concatCopy = ([] as { warning: string }[]).concat(firstConcatSource, secondConcatSource);",
      'secondConcatSource[0].warning = "ADV concat-second shallow warning";',
      'const ofSpreadSource = [{ warning: "ECU" }];',
      "const ofSpreadCopy = Array.of(...ofSpreadSource);",
      'ofSpreadSource[0].warning = "ADV Array.of spread shallow warning";',
      'const newSpreadSource = [{ warning: "ECU" }];',
      "const newSpreadCopy = new Array(...newSpreadSource);",
      'newSpreadSource[0].warning = "ADV new Array spread shallow warning";',
      'const reflectArguments = [{ warning: "ECU" }];',
      "const reflectCopy = Reflect.construct(Array, reflectArguments) as { warning: string }[];",
      'reflectArguments[0].warning = "ADV Reflect.construct shallow warning";',
      'const assignSource = { nested: { warning: "ECU" } };',
      'const assignTarget = { nested: { warning: "ECU" } };',
      "Object.assign(assignTarget, assignSource);",
      'assignSource.nested.warning = "ADV Object.assign statement shallow warning";',
      'const mappedProperty = Array.from([{ warning: "ADV mapper property projection warning" }], (value) => value.warning);',
      'const mappedObject = Array.from([{ warning: "ADV mapper object projection warning" }], (value) => ({ warning: value.warning }));',
      'const mappedDestructured = Array.from([{ warning: "ADV mapper destructured projection warning" }], ({ warning }) => warning);',
      'const mappedAlias = Array.from([{ warning: "ADV mapper local alias warning" }], (value) => { const result = value; return result; });',
      "function LocalProjectionCases() {",
      "  function structuredClone<T extends { warning: string }>(value: T) { return { warning: value.warning }; }",
      '  const copy = structuredClone({ warning: "ADV shadowed function property identity warning" });',
      "  class Array {",
      "    static from<T>(value: T[]): T[] { return value; }",
      "    static of<T>(...value: T[]): T[] { return value; }",
      "  }",
      '  const from = Array.from(["ADV shadowed class Array.from identity warning"]);',
      '  const of = Array.of("ADV shadowed class Array.of identity warning");',
      '  return <>{realExactT("en", copy.warning)} {realExactT("en", from[0])} {realExactT("en", of[0])}</>;',
      "}",
      "export function CompleteShallowCopy() {",
      "  return <>",
      '    {realExactT("en", computedClone.warning)} {realExactT("en", computedFrom[0])}',
      '    {realExactT("en", computedDestructuredCloneCopy.warning)} {realExactT("en", computedDestructuredFromCopy[0])}',
      '    {realExactT("en", directArray[0])} {realExactT("en", globalArray[0])} {realExactT("en", aliasArray[0])}',
      '    {realExactT("en", sharedCopy[0].warning)} {realExactT("en", directSharedCopy[0].warning)}',
      '    {realExactT("en", nonfirstSpreadCopy[1].warning)} {realExactT("en", multiSpreadCopy[1].warning)}',
      '    {realExactT("en", sliceZeroCopy[0].warning)} {realExactT("en", sliceBoundsCopy[0].warning)}',
      '    {realExactT("en", concatCopy[1].warning)} {realExactT("en", ofSpreadCopy[0].warning)}',
      '    {realExactT("en", newSpreadCopy[0].warning)} {realExactT("en", reflectCopy[0].warning)}',
      '    {realExactT("en", assignTarget.nested.warning)}',
      '    {realExactT("en", mappedProperty[0])} {realExactT("en", mappedObject[0].warning)}',
      '    {realExactT("en", mappedDestructured[0])} {realExactT("en", mappedAlias[0].warning)} <LocalProjectionCases />',
      "  </>;",
      "}",
    ].join("\n"),
    "utf8",
  );

  try {
    const result = spawnSync(
      process.execPath,
      ["node_modules/tsx/dist/cli.mjs", "scripts/check-customer-i18n.ts"],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          I18N_AUDIT_EXTRA_ROOT: fixture,
          I18N_REPORT_SOURCE_GAPS: "1",
        },
      },
    );

    const output = `${result.stdout}\n${result.stderr}`;
    assert.equal(result.status, 1, output);
    for (const marker of [
      "ADV computed global clone warning",
      "ADV computed global Array.from warning",
      "ADV computed destructured clone warning",
      "ADV computed destructured Array.from warning",
      "ADV direct callable Array warning",
      "ADV global callable Array warning",
      "ADV aliased callable Array warning",
      "ADV Array.from shared binding post-copy warning",
      "ADV Array.from direct shared binding warning",
      "ADV nonfirst array spread shallow warning",
      "ADV second array spread shallow warning",
      "ADV slice-zero shallow warning",
      "ADV slice-bounds shallow warning",
      "ADV concat-second shallow warning",
      "ADV Array.of spread shallow warning",
      "ADV new Array spread shallow warning",
      "ADV Reflect.construct shallow warning",
      "ADV Object.assign statement shallow warning",
      "ADV mapper property projection warning",
      "ADV mapper object projection warning",
      "ADV mapper destructured projection warning",
      "ADV mapper local alias warning",
      "ADV shadowed function property identity warning",
      "ADV shadowed class Array.from identity warning",
      "ADV shadowed class Array.of identity warning",
    ]) {
      assert.match(output, new RegExp(marker.replaceAll(".", "\\."), "u"));
    }
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test("generic call flow and indirect built-ins cannot hide exact visible copy", () => {
  const fixtureRoot = mkdtempSync(
    join(tmpdir(), "mg-i18n-indirect-call-flow-"),
  );
  const fixture = join(fixtureRoot, "IndirectCallFlow.tsx");
  writeFileSync(
    fixture,
    [
      'import { customerWorkflowExactT as realExactT } from "@/lib/i18n/customer-workflow-auth-translations";',
      "const identity = <T,>(value: T): T => value;",
      'const genericIdentity = identity({ warning: "ADV generic identity warning" });',
      'function makeCopy() { return { warning: "ADV generic factory warning" }; }',
      "const genericFactory = makeCopy();",
      "const helpers = { copy<T>(value: T): T { return value; } };",
      'const genericMethod = helpers.copy({ warning: "ADV generic object method warning" });',
      'const cloneCall = structuredClone.call(undefined, { warning: "ADV structuredClone.call warning" });',
      'const cloneApply = structuredClone.apply(undefined, [{ warning: "ADV structuredClone.apply warning" }]);',
      "const boundCloneFn = structuredClone.bind(globalThis);",
      'const boundClone = boundCloneFn({ warning: "ADV bound structuredClone warning" });',
      'const preboundCloneFn = structuredClone.bind(globalThis, { warning: "ADV prebound structuredClone warning" });',
      "const preboundClone = preboundCloneFn();",
      'const reflectedClone = Reflect.apply(structuredClone, globalThis, [{ warning: "ADV Reflect.apply clone warning" }]);',
      'const fromCall = Array.from.call(Array, ["ADV Array.from.call warning"]);',
      'const fromApply = Array.from.apply(Array, [["ADV Array.from.apply warning"]]);',
      "const boundFromFn = Array.from.bind(Array);",
      'const boundFrom = boundFromFn(["ADV bound Array.from warning"]);',
      'const reflectedFrom = Reflect.apply(Array.from, Array, [["ADV Reflect.apply Array.from warning"]]);',
      'const ofCall = Array.of.call(Array, "ADV Array.of.call warning");',
      'const callableArrayCall = Array.call(undefined, "ADV callable Array.call warning");',
      'const callableArrayApply = Array.apply(undefined, ["ADV callable Array.apply warning"]);',
      'const reflectedArray = Reflect.apply(Array, undefined, ["ADV Reflect.apply callable Array warning"]);',
      'const assignCall = Object.assign.call(Object, {}, { warning: "ADV Object.assign.call warning" });',
      'const assignReflect = Reflect.apply(Object.assign, Object, [{}, { warning: "ADV Reflect.apply Object.assign warning" }]);',
      "const extractedClone = [structuredClone][0];",
      'const extractedCloneCopy = extractedClone({ warning: "ADV array extracted clone warning" });',
      "const extractedFrom = { invoke: Array.from }.invoke;",
      'const extractedFromCopy = extractedFrom(["ADV object extracted Array.from warning"]);',
      "const ExtractedArray = [Array][0];",
      'const extractedArrayCopy = new ExtractedArray("ADV array extracted constructor warning");',
      'const mappedSource = [{ nested: { warning: "ECU" } }];',
      "const mappedProperty = Array.from(mappedSource, (value) => value.nested);",
      'mappedSource[0].nested.warning = "ADV mapper property shared post-copy warning";',
      'const destructuredSource = [{ nested: { warning: "ECU" } }];',
      "const mappedDestructured = Array.from(destructuredSource, ({ nested }) => nested);",
      'destructuredSource[0].nested.warning = "ADV mapper destructured shared post-copy warning";',
      "const LocalArray = (value: string) => [value];",
      'const localCallableArray = LocalArray("ADV local callable array identity warning");',
      'const sliceCallSource = [{ warning: "ECU" }];',
      "const sliceCallCopy = Array.prototype.slice.call(sliceCallSource);",
      'sliceCallSource[0].warning = "ADV slice.call shallow post-copy warning";',
      'const reflectSliceSource = [{ warning: "ECU" }];',
      "const reflectSliceCopy = Reflect.apply(Array.prototype.slice, reflectSliceSource, []);",
      'reflectSliceSource[0].warning = "ADV Reflect.apply slice shallow post-copy warning";',
      'const concatCallLeft = [{ warning: "ECU" }];',
      'const concatCallRight = [{ warning: "ECU" }];',
      "const concatCallCopy = Array.prototype.concat.call(concatCallLeft, concatCallRight);",
      'concatCallRight[0].warning = "ADV concat.call shallow post-copy warning";',
      'const reflectConcatLeft = [{ warning: "ECU" }];',
      'const reflectConcatRight = [{ warning: "ECU" }];',
      "const reflectConcatCopy = Reflect.apply(Array.prototype.concat, reflectConcatLeft, [reflectConcatRight]);",
      'reflectConcatRight[0].warning = "ADV Reflect.apply concat shallow post-copy warning";',
      "export function IndirectCallFlow() {",
      "  return <>",
      '    {realExactT("en", genericIdentity.warning)} {realExactT("en", genericFactory.warning)} {realExactT("en", genericMethod.warning)}',
      '    {realExactT("en", cloneCall.warning)} {realExactT("en", cloneApply.warning)} {realExactT("en", boundClone.warning)} {realExactT("en", preboundClone.warning)} {realExactT("en", reflectedClone.warning)}',
      '    {realExactT("en", fromCall[0])} {realExactT("en", fromApply[0])} {realExactT("en", boundFrom[0])} {realExactT("en", reflectedFrom[0])} {realExactT("en", ofCall[0])}',
      '    {realExactT("en", callableArrayCall[0])} {realExactT("en", callableArrayApply[0])} {realExactT("en", reflectedArray[0])}',
      '    {realExactT("en", assignCall.warning)} {realExactT("en", assignReflect.warning)}',
      '    {realExactT("en", extractedCloneCopy.warning)} {realExactT("en", extractedFromCopy[0])} {realExactT("en", extractedArrayCopy[0])}',
      '    {realExactT("en", mappedProperty[0].warning)} {realExactT("en", mappedDestructured[0].warning)} {realExactT("en", localCallableArray[0])}',
      '    {realExactT("en", sliceCallCopy[0].warning)} {realExactT("en", reflectSliceCopy[0].warning)} {realExactT("en", concatCallCopy[1].warning)} {realExactT("en", reflectConcatCopy[1].warning)}',
      "  </>;",
      "}",
    ].join("\n"),
    "utf8",
  );

  try {
    const result = spawnSync(
      process.execPath,
      ["node_modules/tsx/dist/cli.mjs", "scripts/check-customer-i18n.ts"],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          I18N_AUDIT_EXTRA_ROOT: fixture,
          I18N_REPORT_SOURCE_GAPS: "1",
        },
      },
    );
    const output = `${result.stdout}\n${result.stderr}`;
    assert.equal(result.status, 1, output);
    for (const marker of [
      "ADV generic identity warning",
      "ADV generic factory warning",
      "ADV generic object method warning",
      "ADV structuredClone.call warning",
      "ADV structuredClone.apply warning",
      "ADV bound structuredClone warning",
      "ADV prebound structuredClone warning",
      "ADV Reflect.apply clone warning",
      "ADV Array.from.call warning",
      "ADV Array.from.apply warning",
      "ADV bound Array.from warning",
      "ADV Reflect.apply Array.from warning",
      "ADV Array.of.call warning",
      "ADV callable Array.call warning",
      "ADV callable Array.apply warning",
      "ADV Reflect.apply callable Array warning",
      "ADV Object.assign.call warning",
      "ADV Reflect.apply Object.assign warning",
      "ADV array extracted clone warning",
      "ADV object extracted Array.from warning",
      "ADV array extracted constructor warning",
      "ADV mapper property shared post-copy warning",
      "ADV mapper destructured shared post-copy warning",
      "ADV local callable array identity warning",
      "ADV slice.call shallow post-copy warning",
      "ADV Reflect.apply slice shallow post-copy warning",
      "ADV concat.call shallow post-copy warning",
      "ADV Reflect.apply concat shallow post-copy warning",
    ]) {
      assert.match(output, new RegExp(marker.replaceAll(".", "\\."), "u"));
    }
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test("indirect dropped inputs and dead mapper branches stay excluded", () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "mg-i18n-indirect-negative-"));
  const fixture = join(fixtureRoot, "IndirectNegative.tsx");
  writeFileSync(
    fixture,
    [
      'import { customerWorkflowExactT as realExactT } from "@/lib/i18n/customer-workflow-auth-translations";',
      'function dropGeneric<T>(_value: T) { return { warning: "ECU" }; }',
      'const directDrop = dropGeneric({ warning: "ADV dropped generic input" });',
      'const callDrop = dropGeneric.call(undefined, { warning: "ADV dropped call input" });',
      'const applyDrop = dropGeneric.apply(undefined, [{ warning: "ADV dropped apply input" }]);',
      "const boundDropFn = dropGeneric.bind(undefined);",
      'const boundDrop = boundDropFn({ warning: "ADV dropped bound input" });',
      'const reflectedDrop = Reflect.apply(dropGeneric, undefined, [{ warning: "ADV dropped reflected input" }]);',
      'const helpers = { copy<T>(_value: T) { return { warning: "ECU" }; } };',
      'const methodDrop = helpers.copy({ warning: "ADV dropped method input" });',
      'const indexMapped = Array.from(["ECU"], (_value, index) => index === 0 ? "ECU" : "ADV dead mapper index branch");',
      'const propertyMapped = Array.from([{ kind: "safe" }], (value) => value.kind === "safe" ? "ECU" : "ADV dead mapper property branch");',
      "export function IndirectNegative() {",
      '  return <>{realExactT("en", directDrop.warning)} {realExactT("en", callDrop.warning)} {realExactT("en", applyDrop.warning)} {realExactT("en", boundDrop.warning)} {realExactT("en", reflectedDrop.warning)} {realExactT("en", methodDrop.warning)} {realExactT("en", indexMapped[0])} {realExactT("en", propertyMapped[0])}</>;',
      "}",
    ].join("\n"),
    "utf8",
  );

  try {
    const result = spawnSync(
      process.execPath,
      ["node_modules/tsx/dist/cli.mjs", "scripts/check-customer-i18n.ts"],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          I18N_AUDIT_EXTRA_ROOT: fixture,
          I18N_REPORT_SOURCE_GAPS: "1",
        },
      },
    );
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.doesNotMatch(result.stdout, /ADV /u);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test("async control flow iterables and shared projections stay inside the gate", () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "mg-i18n-advanced-flow-"));
  const fixture = join(fixtureRoot, "AdvancedFlow.tsx");
  writeFileSync(
    fixture,
    [
      'import { customerWorkflowExactT as realExactT } from "@/lib/i18n/customer-workflow-auth-translations";',
      'function choose<T>(useInput: boolean, input: T): T | { warning: string } { if (useInput) return input; return { warning: "ECU" }; }',
      'async function makeAsync() { return { warning: "ADV async factory warning" }; }',
      'function* values() { yield "ADV Array.from generator warning"; }',
      'const defaultMapped = Array.from([undefined] as (string | undefined)[], (value = "ADV mapper default parameter warning") => value);',
      'const getterSource = { get warning() { return "ADV structuredClone getter warning"; } };',
      "const getterClone = structuredClone(getterSource);",
      "const generated = Array.from(values());",
      'const mapperObjectSource = [{ nested: { warning: "ECU" } }];',
      "const mapperObjectCopy = Array.from(mapperObjectSource, (value) => ({ nested: value.nested }));",
      'mapperObjectSource[0].nested.warning = "ADV mapper object shared warning";',
      'const literalShared = { nested: { warning: "ECU" } };',
      "const literalProjected = Array.from([literalShared], (value) => value.nested);",
      'literalShared.nested.warning = "ADV literal projected shared warning";',
      'const localSource = { nested: { warning: "ECU" } };',
      "function localCopy<T extends { nested: unknown }>(value: T) { return { nested: value.nested }; }",
      "const localCopyResult = localCopy(localSource);",
      'localSource.nested.warning = "ADV local function shallow return warning";',
      'const constructorSource = { nested: { warning: "ECU" } };',
      "class LocalCopy { nested: { warning: string }; constructor(value: { nested: { warning: string } }) { this.nested = value.nested; } }",
      "const constructed = new LocalCopy(constructorSource);",
      'constructorSource.nested.warning = "ADV local constructor shallow warning";',
      "const assignedClone = Object.assign({}, { invoke: structuredClone }).invoke;",
      'const assignedCloneCopy = assignedClone({ warning: "ADV Object.assign extracted clone warning" });',
      "const frozenClone = Object.freeze({ invoke: structuredClone }).invoke;",
      'const frozenCloneCopy = frozenClone({ warning: "ADV Object.freeze extracted clone warning" });',
      "const spreadClone = [...[structuredClone]][0];",
      'const spreadCloneCopy = spreadClone({ warning: "ADV array spread extracted clone warning" });',
      "const conditionalClone = true ? structuredClone : structuredClone;",
      'const conditionalCloneCopy = conditionalClone({ warning: "ADV conditional clone warning" });',
      'const doubleCallClone = Function.prototype.call.call(structuredClone, undefined, { warning: "ADV Function call.call clone warning" });',
      'const holderSource = [{ nested: { warning: "ECU" } }];',
      "const holderCopy = Array.from(holderSource, (value) => ({ holder: value.nested }).holder);",
      'holderSource[0].nested.warning = "ADV mapper holder shared warning";',
      'const doubleSliceSource = [{ warning: "ECU" }];',
      "const doubleSliceCopy = Function.prototype.call.call(Array.prototype.slice, doubleSliceSource);",
      'doubleSliceSource[0].warning = "ADV Function call.call slice shallow warning";',
      'const doubleConcatLeft = [{ warning: "ECU" }];',
      'const doubleConcatRight = [{ warning: "ECU" }];',
      "const doubleConcatCopy = Function.prototype.call.call(Array.prototype.concat, doubleConcatLeft, doubleConcatRight);",
      'doubleConcatRight[0].warning = "ADV Function call.call concat shallow warning";',
      "export async function AdvancedFlow() {",
      '  const awaitedClone = await structuredClone({ warning: "ADV awaited structuredClone warning" });',
      '  const awaitedArray = await Array.from(["ADV awaited Array.from warning"]);',
      "  const awaitedFactory = await makeAsync();",
      '  const chosen = choose(true, { warning: "ADV generic multi-return warning" }) as { warning: string };',
      '  const commaClone = (0, structuredClone)({ warning: "ADV comma structuredClone warning" });',
      '  const commaFrom = (0, Array.from)(["ADV comma Array.from warning"]);',
      "  return <>",
      '    {realExactT("en", awaitedClone.warning)} {realExactT("en", awaitedArray[0])} {realExactT("en", awaitedFactory.warning)} {realExactT("en", chosen.warning)} {realExactT("en", commaClone.warning)} {realExactT("en", commaFrom[0])}',
      '    {realExactT("en", defaultMapped[0] ?? "ECU")} {realExactT("en", getterClone.warning)} {realExactT("en", generated[0])}',
      '    {realExactT("en", mapperObjectCopy[0].nested.warning)} {realExactT("en", literalProjected[0].warning)} {realExactT("en", localCopyResult.nested.warning)} {realExactT("en", constructed.nested.warning)}',
      '    {realExactT("en", assignedCloneCopy.warning)} {realExactT("en", frozenCloneCopy.warning)} {realExactT("en", spreadCloneCopy.warning)} {realExactT("en", conditionalCloneCopy.warning)} {realExactT("en", doubleCallClone.warning)}',
      '    {realExactT("en", holderCopy[0].warning)} {realExactT("en", doubleSliceCopy[0].warning)} {realExactT("en", doubleConcatCopy[1].warning)}',
      "  </>;",
      "}",
    ].join("\n"),
    "utf8",
  );
  try {
    const result = spawnSync(
      process.execPath,
      ["node_modules/tsx/dist/cli.mjs", "scripts/check-customer-i18n.ts"],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          I18N_AUDIT_EXTRA_ROOT: fixture,
          I18N_REPORT_SOURCE_GAPS: "1",
        },
      },
    );
    const output = `${result.stdout}\n${result.stderr}`;
    assert.equal(result.status, 1, output);
    for (const marker of [
      "ADV async factory warning",
      "ADV Array.from generator warning",
      "ADV mapper default parameter warning",
      "ADV structuredClone getter warning",
      "ADV mapper object shared warning",
      "ADV literal projected shared warning",
      "ADV local function shallow return warning",
      "ADV local constructor shallow warning",
      "ADV Object.assign extracted clone warning",
      "ADV Object.freeze extracted clone warning",
      "ADV array spread extracted clone warning",
      "ADV conditional clone warning",
      "ADV Function call.call clone warning",
      "ADV mapper holder shared warning",
      "ADV Function call.call slice shallow warning",
      "ADV Function call.call concat shallow warning",
      "ADV awaited structuredClone warning",
      "ADV awaited Array.from warning",
      "ADV generic multi-return warning",
      "ADV comma structuredClone warning",
      "ADV comma Array.from warning",
    ]) {
      assert.match(output, new RegExp(marker.replaceAll(".", "\\."), "u"));
    }
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test("async dropped input and relational dead branches avoid false alarms", () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "mg-i18n-advanced-negative-"));
  const fixture = join(fixtureRoot, "AdvancedNegative.tsx");
  writeFileSync(
    fixture,
    [
      'import { customerWorkflowExactT as realExactT } from "@/lib/i18n/customer-workflow-auth-translations";',
      'async function dropAsync<T>(_value: T) { return { warning: "ECU" }; }',
      'function choose<T>(useInput: boolean, input: T): T | { warning: string } { if (useInput) return input; return { warning: "ECU" }; }',
      'const relational = Array.from(["ECU"], (_value, index) => index < 1 ? "ECU" : "ADV dead relational mapper branch");',
      "export async function AdvancedNegative() {",
      '  const dropped = await dropAsync({ warning: "ADV dropped async input" });',
      '  const chosen = choose(false, { warning: "ADV dropped false branch input" }) as { warning: string };',
      '  return <>{realExactT("en", dropped.warning)} {realExactT("en", chosen.warning)} {realExactT("en", relational[0])}</>;',
      "}",
    ].join("\n"),
    "utf8",
  );
  try {
    const result = spawnSync(
      process.execPath,
      ["node_modules/tsx/dist/cli.mjs", "scripts/check-customer-i18n.ts"],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          I18N_AUDIT_EXTRA_ROOT: fixture,
          I18N_REPORT_SOURCE_GAPS: "1",
        },
      },
    );
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.doesNotMatch(result.stdout, /ADV /u);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test("React state hooks and Promise output remain localized", () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "mg-i18n-react-promise-"));
  const fixture = join(fixtureRoot, "ReactPromiseFlow.tsx");
  writeFileSync(
    fixture,
    [
      'import * as React from "react";',
      'import { useCallback, useMemo, useReducer, useRef, useState as useCustomerState } from "react";',
      'import { customerWorkflowExactT as realExactT } from "@/lib/i18n/customer-workflow-auth-translations";',
      'function useCustomMessage() { return useCustomerState("ADV React custom hook warning")[0]; }',
      "export function CustomerPanel() {",
      '  const payloadReducer = (state: string, action: { type: "put"; payload: string } | { type: "ignore"; payload: string }) => { if (action.type === "put") return action.payload; return state; };',
      "  const ignoredReducer = (state: string, _action: { payload: string }) => state;",
      '  const [stateMessage] = useCustomerState("ADV React useState visible warning");',
      '  const [lazyMessage] = useCustomerState(() => "ADV React lazy useState visible warning");',
      '  const memoMessage = useMemo(() => "ADV React useMemo visible warning", []);',
      '  const refMessage = useRef("ADV React useRef visible warning");',
      '  const [reducerMessage] = useReducer((_state: string, action: string) => action, "ADV React useReducer visible warning");',
      '  const [functionalMessage, setFunctionalMessage] = useCustomerState("ECU");',
      '  const update = () => setFunctionalMessage(() => "ADV React functional setter warning");',
      '  const [aliasedMessage, setAliasedMessage] = useCustomerState("ECU");',
      "  const aliasedSetter = setAliasedMessage;",
      '  const [reducerActionMessage, dispatchReducerAction] = useReducer((_state: string, action: string) => action, "ECU");',
      "  const aliasedDispatch = dispatchReducerAction;",
      '  const [reducerBodyMessage, dispatchReducerBody] = useReducer((_state: string, _action: string) => "ADV React reducer body warning", "ECU");',
      '  const [objectReducerMessage, dispatchObjectReducer] = useReducer(payloadReducer, "ECU");',
      '  const [ignoredReducerMessage, dispatchIgnoredReducer] = useReducer(ignoredReducer, "ECU");',
      '  const directAliasStateMessage = useCustomerState("ADV React alias direct state warning")[0];',
      '  const namespaceStateMessage = React.useState("ADV React namespace state warning")[0];',
      '  const namespaceReducerMessage = React.useReducer((state: string) => state, "ADV React namespace reducer warning")[0];',
      '  const callbackMessage = useCallback(() => "ADV React useCallback warning", [])();',
      "  const customHookMessage = useCustomMessage();",
      '  const updateAll = () => { update(); aliasedSetter(() => "ADV React aliased setter warning"); aliasedDispatch("ADV React reducer action warning"); dispatchReducerBody("ADV React reducer ignored action sentinel"); dispatchObjectReducer({ type: "put", payload: "ADV React reducer object payload warning" }); dispatchIgnoredReducer({ payload: "ADV React reducer ignored payload sentinel" }); };',
      '  return <button onClick={updateAll}>{realExactT("en", stateMessage)} {realExactT("en", lazyMessage)} {realExactT("en", memoMessage)} {realExactT("en", refMessage.current)} {realExactT("en", reducerMessage)} {realExactT("en", functionalMessage)} {realExactT("en", aliasedMessage)} {realExactT("en", reducerActionMessage)} {realExactT("en", reducerBodyMessage)} {realExactT("en", objectReducerMessage)} {realExactT("en", ignoredReducerMessage)} {realExactT("en", directAliasStateMessage)} {realExactT("en", namespaceStateMessage)} {realExactT("en", namespaceReducerMessage)} {realExactT("en", callbackMessage)} {realExactT("en", customHookMessage)}</button>;',
      "}",
      "export async function ServerPanel() {",
      '  const resolved = await Promise.resolve("ADV Promise.resolve visible warning");',
      '  const all = await Promise.all(["ADV Promise.all visible warning"]);',
      '  const thenIdentity = await Promise.resolve("ADV Promise.then identity warning").then((value) => value);',
      '  const thenCallback = await Promise.resolve("ADV Promise.then dropped input sentinel").then(() => "ADV Promise.then callback warning");',
      '  const thenAsyncCallback = await Promise.resolve("ADV Promise.then async dropped input sentinel").then(async () => "ADV Promise.then async callback warning");',
      '  const raced = await Promise.race([Promise.resolve("ADV Promise.race warning")]);',
      '  const anyValue = await Promise.any([Promise.reject("ADV Promise.any rejected sentinel"), Promise.resolve("ADV Promise.any warning")]);',
      '  const settled = await Promise.allSettled([Promise.resolve("ADV Promise.allSettled warning"), Promise.reject("ADV Promise.allSettled rejected sentinel")]);',
      "  const settledValue = (settled[0] as PromiseFulfilledResult<string>).value;",
      '  return <>{realExactT("en", resolved)} {realExactT("en", all[0])} {realExactT("en", thenIdentity)} {realExactT("en", thenCallback)} {realExactT("en", thenAsyncCallback)} {realExactT("en", raced)} {realExactT("en", anyValue)} {realExactT("en", settledValue)}</>;',
      "}",
    ].join("\n"),
    "utf8",
  );
  try {
    const result = spawnSync(
      process.execPath,
      ["node_modules/tsx/dist/cli.mjs", "scripts/check-customer-i18n.ts"],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          I18N_AUDIT_EXTRA_ROOT: fixture,
          I18N_REPORT_SOURCE_GAPS: "1",
        },
      },
    );
    const output = `${result.stdout}\n${result.stderr}`;
    assert.equal(result.status, 1, output);
    for (const marker of [
      "ADV React useState visible warning",
      "ADV React lazy useState visible warning",
      "ADV React useMemo visible warning",
      "ADV React useRef visible warning",
      "ADV React useReducer visible warning",
      "ADV React functional setter warning",
      "ADV React aliased setter warning",
      "ADV React reducer action warning",
      "ADV React reducer body warning",
      "ADV React reducer object payload warning",
      "ADV React alias direct state warning",
      "ADV React namespace state warning",
      "ADV React namespace reducer warning",
      "ADV React useCallback warning",
      "ADV React custom hook warning",
      "ADV Promise.resolve visible warning",
      "ADV Promise.all visible warning",
      "ADV Promise.then identity warning",
      "ADV Promise.then callback warning",
      "ADV Promise.then async callback warning",
      "ADV Promise.race warning",
      "ADV Promise.any warning",
      "ADV Promise.allSettled warning",
    ]) {
      assert.match(output, new RegExp(marker.replaceAll(".", "\\."), "u"));
    }
    for (const marker of [
      "ADV React reducer ignored action sentinel",
      "ADV React reducer ignored payload sentinel",
      "ADV Promise.then dropped input sentinel",
      "ADV Promise.then async dropped input sentinel",
      "ADV Promise.any rejected sentinel",
      "ADV Promise.allSettled rejected sentinel",
    ]) {
      assert.doesNotMatch(
        output,
        new RegExp(marker.replaceAll(".", "\\."), "u"),
      );
    }
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test("React hook dependencies and unrelated object fields are not rendered copy", () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "mg-i18n-react-negative-"));
  const fixture = join(fixtureRoot, "ReactNegative.tsx");
  writeFileSync(
    fixture,
    [
      'import { useMemo, useRef, useState } from "react";',
      'import { customerWorkflowExactT as realExactT } from "@/lib/i18n/customer-workflow-auth-translations";',
      "export function ReactNegative() {",
      '  const memo = useMemo(() => "ECU", ["ADV dependency-only sentinel"]);',
      '  const [state] = useState(() => { const internal = "ADV initializer internal sentinel"; void internal; return "ECU"; });',
      '  const ref = useRef({ warning: "ECU", internal: "ADV ref unrelated sentinel" });',
      '  const [, setState] = useState("ECU");',
      '  const update = () => setState(() => { const internal = "ADV setter internal sentinel"; void internal; return "ECU"; });',
      '  return <button onClick={update}>{realExactT("en", memo)} {realExactT("en", state)} {realExactT("en", ref.current.warning)}</button>;',
      "}",
    ].join("\n"),
    "utf8",
  );
  try {
    const result = spawnSync(
      process.execPath,
      ["node_modules/tsx/dist/cli.mjs", "scripts/check-customer-i18n.ts"],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          I18N_AUDIT_EXTRA_ROOT: fixture,
          I18N_REPORT_SOURCE_GAPS: "1",
        },
      },
    );
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.doesNotMatch(result.stdout, /ADV /u);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test("collection value pipelines remain localized", () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "mg-i18n-collections-"));
  const fixture = join(fixtureRoot, "CollectionFlow.tsx");
  writeFileSync(
    fixture,
    [
      'import { customerWorkflowExactT as realExactT } from "@/lib/i18n/customer-workflow-auth-translations";',
      "export function CollectionFlow() {",
      '  const filtered = ["ADV Array.filter visible warning"].filter(() => true);',
      '  const flattened = ["ADV Array.flatMap visible warning"].flatMap((value) => [value]);',
      '  const objectValues = Object.values({ visible: "ADV Object.values visible warning" });',
      '  const mapValues = [...new Map([["technical-key", "ADV Map.values visible warning"]]).values()];',
      '  const setValues = [...new Set(["ADV Set spread visible warning"])];',
      "  const augmented = new Set<string>();",
      '  augmented.add("ADV Set.add visible warning");',
      "  const augmentedValues = Array.from(augmented);",
      '  const atValue = ["ADV Array.at visible warning", "ADV Array.at unselected sentinel"].at(0) ?? "ECU";',
      '  const shifted = ["ADV Array.shift visible warning", "ADV Array.shift unselected sentinel"].shift() ?? "ECU";',
      '  const popped = ["ADV Array.pop unselected sentinel", "ADV Array.pop visible warning"].pop() ?? "ECU";',
      '  const selectedMapValue = new Map([["hidden", "ADV Map.get unselected sentinel"], ["visible", "ADV Map.get visible warning"]]).get("visible") ?? "ECU";',
      '  const boundMap = new Map([["ADV bound Map key sentinel", "ECU"], ["hidden", "ADV bound Map.get unselected sentinel"], ["visible", "ADV bound Map.get visible warning"]]);',
      '  const boundMapValue = boundMap.get("visible") ?? "ECU";',
      "  const mutableMap = new Map<string, string>();",
      '  mutableMap.set("visible", "ADV Map.set/get visible warning");',
      '  const mutableMapValue = mutableMap.get("visible") ?? "ECU";',
      '  const findRows = [{ visible: false, warning: "ADV find unselected sentinel" }, { visible: true, warning: "ADV find visible warning" }];',
      '  const found = findRows.find((row) => row.visible)?.warning ?? "ECU";',
      '  const booleanFound = ["", "ADV find Boolean visible warning", "ADV find Boolean later sentinel"].find(Boolean) ?? "ECU";',
      '  const booleanFilteredAt = ["ADV filter Boolean at earlier sentinel", "", "ADV filter Boolean at visible warning"].filter(Boolean).at(-1) ?? "ECU";',
      '  const entryValues = Object.entries({ hidden: "ADV entries unselected sentinel", visible: "ADV entries visible warning" }).filter(([key]) => key === "visible").map(([, value]) => value);',
      '  const reduceRows = [{ visible: false, warning: "ADV reduce unselected sentinel" }, { visible: true, warning: "ADV reduce visible warning" }];',
      "  const reduced = reduceRows.reduce<string[]>((out, row) => { if (row.visible) out.push(row.warning); return out; }, []);",
      '  const reducedIdentity = ["ADV reduce identity warning"].reduce((value) => value);',
      '  const zeroParameterReduced = ["ECU", "ECU"].reduce(() => "ADV zero-parameter reduce visible warning");',
      '  const flatValue = [["ADV Array.flat visible warning"]].flat()[0];',
      '  const filterAlias = { nested: { warning: "ECU" } };',
      "  const filterCopies = [filterAlias].filter(() => true);",
      '  filterAlias.nested.warning = "ADV filter post-copy visible warning";',
      '  const flatMapAlias = { nested: { warning: "ECU" } };',
      "  const flatMapCopies = [flatMapAlias].flatMap((value) => [value]);",
      '  flatMapAlias.nested.warning = "ADV flatMap post-copy visible warning";',
      '  const valuesAlias = { nested: { warning: "ECU" } };',
      "  const valuesCopies = Object.values({ order: valuesAlias });",
      '  valuesAlias.nested.warning = "ADV Object.values post-copy visible warning";',
      '  const restSkipped = { nested: { warning: "ECU" } };',
      '  const restSource = { nested: { warning: "ECU" } };',
      "  const restInput = [restSkipped, restSource] as const;",
      "  const [, ...restCopy] = restInput;",
      '  restSkipped.nested.warning = "ADV array rest skipped mutation sentinel";',
      '  restSource.nested.warning = "ADV array rest post-copy visible warning";',
      "  class AssignedBox {",
      "    readonly nested!: { warning: string };",
      "    constructor(value: { nested: { warning: string } }) { Object.assign(this, value); }",
      "  }",
      '  const classSource = { nested: { warning: "ECU" } };',
      "  const classCopy = new AssignedBox(classSource);",
      '  classSource.nested.warning = "ADV class Object.assign post-copy visible warning";',
      '  const detachedSource = { nested: { warning: "ECU" } };',
      "  const detachedCopy = new AssignedBox(detachedSource);",
      '  detachedSource.nested = { warning: "ADV class Object.assign detached sentinel" };',
      '  return <>{realExactT("en", filtered[0])} {realExactT("en", flattened[0])} {realExactT("en", objectValues[0])} {realExactT("en", mapValues[0])} {realExactT("en", setValues[0])} {realExactT("en", augmentedValues[0])} {realExactT("en", atValue)} {realExactT("en", shifted)} {realExactT("en", popped)} {realExactT("en", selectedMapValue)} {realExactT("en", boundMapValue)} {realExactT("en", mutableMapValue)} {realExactT("en", found)} {realExactT("en", booleanFound)} {realExactT("en", booleanFilteredAt)} {realExactT("en", entryValues[0])} {realExactT("en", reduced[0] ?? "ECU")} {realExactT("en", reducedIdentity)} {realExactT("en", zeroParameterReduced)} {realExactT("en", flatValue)} {realExactT("en", filterCopies[0].nested.warning)} {realExactT("en", flatMapCopies[0].nested.warning)} {realExactT("en", valuesCopies[0].nested.warning)} {realExactT("en", restCopy[0].nested.warning)} {realExactT("en", classCopy.nested.warning)} {realExactT("en", detachedCopy.nested.warning)}</>;',
      "}",
    ].join("\n"),
    "utf8",
  );
  try {
    const result = spawnSync(
      process.execPath,
      ["node_modules/tsx/dist/cli.mjs", "scripts/check-customer-i18n.ts"],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          I18N_AUDIT_EXTRA_ROOT: fixture,
          I18N_REPORT_SOURCE_GAPS: "1",
        },
      },
    );
    const output = `${result.stdout}\n${result.stderr}`;
    assert.equal(result.status, 1, output);
    for (const marker of [
      "ADV Array.filter visible warning",
      "ADV Array.flatMap visible warning",
      "ADV Object.values visible warning",
      "ADV Map.values visible warning",
      "ADV Set spread visible warning",
      "ADV Set.add visible warning",
      "ADV Array.at visible warning",
      "ADV Array.shift visible warning",
      "ADV Array.pop visible warning",
      "ADV Map.get visible warning",
      "ADV bound Map.get visible warning",
      "ADV Map.set/get visible warning",
      "ADV find visible warning",
      "ADV find Boolean visible warning",
      "ADV filter Boolean at visible warning",
      "ADV entries visible warning",
      "ADV reduce visible warning",
      "ADV reduce identity warning",
      "ADV zero-parameter reduce visible warning",
      "ADV Array.flat visible warning",
      "ADV filter post-copy visible warning",
      "ADV flatMap post-copy visible warning",
      "ADV Object.values post-copy visible warning",
      "ADV array rest post-copy visible warning",
      "ADV class Object.assign post-copy visible warning",
    ]) {
      assert.match(output, new RegExp(marker.replaceAll(".", "\\."), "u"));
    }
    for (const marker of [
      "ADV Array.at unselected sentinel",
      "ADV Array.shift unselected sentinel",
      "ADV Array.pop unselected sentinel",
      "ADV Map.get unselected sentinel",
      "ADV bound Map.get unselected sentinel",
      "ADV bound Map key sentinel",
      "ADV find unselected sentinel",
      "ADV find Boolean later sentinel",
      "ADV filter Boolean at earlier sentinel",
      "ADV entries unselected sentinel",
      "ADV reduce unselected sentinel",
      "ADV array rest skipped mutation sentinel",
      "ADV class Object.assign detached sentinel",
    ]) {
      assert.doesNotMatch(
        output,
        new RegExp(marker.replaceAll(".", "\\."), "u"),
      );
    }
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test("collection filters and keys do not become rendered copy", () => {
  const fixtureRoot = mkdtempSync(
    join(tmpdir(), "mg-i18n-collections-negative-"),
  );
  const fixture = join(fixtureRoot, "CollectionNegative.tsx");
  writeFileSync(
    fixture,
    [
      'import { customerWorkflowExactT as realExactT } from "@/lib/i18n/customer-workflow-auth-translations";',
      "export function CollectionNegative() {",
      '  const filtered = ["ADV filter false-branch sentinel"].filter(() => false);',
      '  const flattened = ["ADV flatMap dropped sentinel"].flatMap(() => []);',
      '  const objectValues = Object.values({ "ADV Object.values key sentinel": "ECU" });',
      '  const mapValues = [...new Map([["ADV Map key sentinel", "ECU"]]).values()];',
      "  const visible = [...filtered, ...flattened, ...objectValues, ...mapValues];",
      '  return <>{visible.map((value) => <span key={value}>{realExactT("en", value)}</span>)}</>;',
      "}",
    ].join("\n"),
    "utf8",
  );
  try {
    const result = spawnSync(
      process.execPath,
      ["node_modules/tsx/dist/cli.mjs", "scripts/check-customer-i18n.ts"],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          I18N_AUDIT_EXTRA_ROOT: fixture,
          I18N_REPORT_SOURCE_GAPS: "1",
        },
      },
    );
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.doesNotMatch(result.stdout, /ADV /u);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

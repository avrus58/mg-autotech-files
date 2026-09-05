import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { supportedLocales } from "../src/lib/i18nConfig";
import {
  customerWorkflowExactT as privateMetadataExactT,
  customerWorkflowLocaleOrder as privateMetadataLocaleOrder,
  customerWorkflowSourceStrings as privateMetadataSourceStrings,
} from "../src/lib/i18n/customer-workflow-private-metadata-translations";
import {
  buildAuthMetadata,
  buildCustomerDashboardMetadata,
  buildDesktopTurnstileMetadata,
  buildForgotPasswordMetadata,
  buildLoginMetadata,
  buildLogAnalysisStudioMetadata,
  buildMeasurementCompletionMetadata,
  buildNewRequestMetadata,
  buildPaymentCancelMetadata,
  buildPaymentSuccessMetadata,
  buildRegisterMetadata,
  buildResetPasswordMetadata,
  buildWidgetDashboardMetadata,
} from "../src/lib/privatePageMetadata";

const privateMetadataBuilders = [
  { build: buildAuthMetadata, noarchive: false },
  { build: buildCustomerDashboardMetadata, noarchive: false },
  { build: buildDesktopTurnstileMetadata, noarchive: true },
  { build: buildForgotPasswordMetadata, noarchive: false },
  { build: buildLoginMetadata, noarchive: false },
  { build: buildLogAnalysisStudioMetadata, noarchive: false },
  { build: buildMeasurementCompletionMetadata, noarchive: true },
  { build: buildNewRequestMetadata, noarchive: false },
  { build: buildPaymentCancelMetadata, noarchive: true },
  { build: buildPaymentSuccessMetadata, noarchive: true },
  { build: buildRegisterMetadata, noarchive: false },
  { build: buildResetPasswordMetadata, noarchive: false },
  { build: buildWidgetDashboardMetadata, noarchive: false },
] as const;

test("protected customer metadata is complete and localized in every supported language", () => {
  for (const { code } of supportedLocales) {
    for (const { build, noarchive } of privateMetadataBuilders) {
      const metadata = build(code);
      assert.equal(typeof metadata.title, "string", `${code} title`);
      assert.ok(metadata.title, `${code} title must not be empty`);
      assert.equal(typeof metadata.description, "string", `${code} description`);
      assert.ok(metadata.description, `${code} description must not be empty`);
      assert.equal(metadata.alternates, null, `${code} canonical inheritance`);
      assert.equal(metadata.openGraph, null, `${code} Open Graph inheritance`);
      assert.equal(metadata.twitter, null, `${code} Twitter inheritance`);
      assert.deepEqual(metadata.robots, {
        index: false,
        follow: false,
        ...(noarchive ? { noarchive: true } : {}),
      });
    }
  }
});

test("non-English protected metadata never falls back to the English source", () => {
  const english = privateMetadataBuilders.map(({ build }) => build("en"));

  for (const { code } of supportedLocales) {
    if (code === "en") continue;
    privateMetadataBuilders.forEach(({ build }, index) => {
      const localized = build(code);
      assert.notEqual(localized.title, english[index].title, `${code} title fallback`);
      assert.notEqual(
        localized.description,
        english[index].description,
        `${code} description fallback`,
      );
    });
  }
});

test("dashboard runtime metadata catalog stays identical to the server builders", () => {
  const runtimeMetadataBuilders = [
    buildCustomerDashboardMetadata,
    buildLogAnalysisStudioMetadata,
    buildWidgetDashboardMetadata,
  ] as const;
  assert.deepEqual(
    privateMetadataLocaleOrder,
    supportedLocales
      .map(({ code }) => code)
      .filter((code) => code !== "en"),
  );

  for (const build of runtimeMetadataBuilders) {
    const english = build("en");
    if (
      typeof english.title !== "string" ||
      typeof english.description !== "string"
    ) {
      assert.fail("runtime metadata builders must return literal title and description strings");
    }
    const englishTitle = english.title;
    const englishDescription = english.description;
    assert.ok(privateMetadataSourceStrings.includes(englishTitle));
    assert.ok(privateMetadataSourceStrings.includes(englishDescription));

    for (const { code } of supportedLocales) {
      const localized = build(code);
      assert.equal(
        privateMetadataExactT(code, englishTitle),
        localized.title,
        `${code}: ${englishTitle}`,
      );
      assert.equal(
        privateMetadataExactT(code, englishDescription),
        localized.description,
        `${code}: ${englishDescription}`,
      );
    }
  }
});

test("protected routes resolve metadata from the first-paint server locale", () => {
  const routeFiles = [
    "src/app/dashboard/page.tsx",
    "src/app/dashboard/log-analysis/page.tsx",
    "src/app/dashboard/widget/page.tsx",
    "src/app/dashboard/layout.tsx",
    "src/app/login/layout.tsx",
    "src/app/register/layout.tsx",
    "src/app/forgot-password/layout.tsx",
    "src/app/reset-password/layout.tsx",
    "src/app/auth/layout.tsx",
    "src/app/new-request/layout.tsx",
    "src/app/payment/success/layout.tsx",
    "src/app/payment/cancel/layout.tsx",
    "src/app/desktop-auth/turnstile/layout.tsx",
    "src/app/measurement/complete/layout.tsx",
    "src/app/tools/autotuner-log-analyzer/page.tsx",
  ];

  for (const routeFile of routeFiles) {
    const source = fs.readFileSync(path.join(process.cwd(), routeFile), "utf8");
    assert.match(source, /export async function generateMetadata\(\): Promise<Metadata>/u);
    assert.match(source, /await getServerLocale\(\)/u);
    assert.doesNotMatch(source, /export const metadata/u);
  }
});

test("language-neutral vehicle selector metadata cannot inherit English root copy", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "src/app/embed/vehicle-selector/layout.tsx"),
    "utf8",
  );

  assert.match(source, /title: \{ absolute: "MG AutoTech · ECU · TCU" \}/u);
  assert.match(source, /description: "MG AutoTech · ECU · TCU"/u);
  assert.match(source, /alternates: null/u);
  assert.match(source, /openGraph: null/u);
  assert.match(source, /twitter: null/u);
  assert.match(source, /robots: \{ index: false, follow: false \}/u);
});

test("metadata translators stay callable from the server component boundary", () => {
  const authFirstPaintSource = fs.readFileSync(
    path.join(process.cwd(), "src/lib/i18n/auth-page-first-paint.ts"),
    "utf8",
  );

  assert.doesNotMatch(authFirstPaintSource, /^\s*["']use client["'];/u);
});

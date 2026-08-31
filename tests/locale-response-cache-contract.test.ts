import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("request-localized public responses vary by locale inputs at the final response layer", () => {
  const config = readFileSync("next.config.ts", "utf8");

  for (const source of [
    '"/"',
    '"/about"',
    '"/contact"',
    '"/download/:path*"',
    '"/file-service"',
    '"/how-it-works"',
    '"/services"',
    '"/services/:path*"',
    '"/brands/:path*"',
    '"/ecu-platforms/:path*"',
    '"/tools/:path*"',
    '"/widget/:path*"',
    '"/workshop-guides/:path*"',
  ]) {
    assert.match(config, new RegExp(source.replace(/[/*]/gu, "\\$&"), "u"));
  }

  for (const varyToken of [
    "RSC",
    "Next-Router-State-Tree",
    "Next-Router-Prefetch",
    "Next-Router-Segment-Prefetch",
    "Cookie",
    "Accept-Language",
    "Accept-Encoding",
  ]) {
    assert.match(config, new RegExp(`\\b${varyToken}\\b`, "u"), varyToken);
  }
  assert.match(
    config,
    /requestLocalizedPublicSources\.map\(\(source\) => \(\{[\s\S]*?requestLocalizedPublicHeaders/u,
  );
});

test("private localized workspaces remain explicitly uncacheable", () => {
  const config = readFileSync("next.config.ts", "utf8");

  assert.match(
    config,
    /private, no-store, max-age=0, must-revalidate/u,
  );
  for (const source of [
    '"/admin/:path*"',
    '"/dashboard/:path*"',
    '"/login"',
    '"/register"',
    '"/payment/:path*"',
  ]) {
    assert.match(config, new RegExp(source.replace(/[/*]/gu, "\\$&"), "u"));
  }
});

test("fixed and private route metadata cannot inherit the public homepage graph", () => {
  const admin = readFileSync("src/app/admin/layout.tsx", "utf8");
  assert.match(admin, /title: \{ absolute: "MG AutoTech · Admin" \}/u);
  assert.match(admin, /description: null/u);
  assert.match(admin, /alternates: null/u);
  assert.match(admin, /openGraph: null/u);
  assert.match(admin, /twitter: null/u);

  const processingAgreement = readFileSync(
    "src/app/av-vertrag/page.tsx",
    "utf8",
  );
  assert.match(processingAgreement, /alternates: null/u);
  assert.match(processingAgreement, /openGraph: null/u);
  assert.match(processingAgreement, /twitter: null/u);

  for (const route of [
    "agb",
    "datenschutz",
    "impressum",
    "privacy",
    "widerruf",
  ]) {
    const source = readFileSync(`src/app/${route}/page.tsx`, "utf8");
    assert.match(source, /openGraph: null/u, `${route} Open Graph`);
    assert.match(source, /twitter: null/u, `${route} Twitter`);
  }
});

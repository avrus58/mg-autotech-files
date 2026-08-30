import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const projectRoot = path.resolve(process.cwd());

function source(...segments: string[]) {
  return readFileSync(path.join(projectRoot, ...segments), "utf8");
}

test("German and English privacy pages disclose the current hosting and optional measurement stack", () => {
  const german = source("src", "app", "datenschutz", "page.tsx");
  const english = source("src", "app", "privacy", "page.tsx");

  for (const policy of [german, english]) {
    assert.match(policy, /Hostinger/);
    assert.match(policy, /Supabase/);
    assert.match(policy, /Cloudflare/);
    assert.match(policy, /Turnstile/);
    assert.match(policy, /Caddy/);
    assert.match(policy, /Google Analytics/);
    assert.match(policy, /Google Ads/);
    assert.match(policy, /VPS/);
    assert.doesNotMatch(policy, /Vercel/);
  }

  assert.match(german, /standardmäßig deaktiviert/);
  assert.match(german, /Personalisierte Werbung bleibt deaktiviert/);
  assert.match(german, /Suchbegriffe und vollständige Referrer-URLs werden dafür nicht gespeichert/);
  assert.doesNotMatch(german, /kein eigenes Werbe- oder Reichweiten-Tracking/);

  assert.match(english, /disabled by default/);
  assert.match(english, /Personalized advertising remains disabled/);
  assert.match(english, /Search terms and complete referrer URLs are not stored/);
  assert.match(english, /German[\s\S]*Datenschutzerklärung[\s\S]*legally binding version/);
  assert.match(german, /en: absoluteUrl\("\/privacy"\)/);
  assert.match(english, /de: absoluteUrl\("\/datenschutz"\)/);
});

test("public footer and consent surfaces route German and English privacy links consistently", () => {
  const footer = source("src", "components", "Footer.tsx");
  const widget = source("src", "components", "widget", "WidgetSalesPageClient.tsx");
  const analytics = source("src", "components", "analytics", "PublicAnalytics.tsx");
  const robots = source("src", "app", "robots.ts");
  const sitemap = source("src", "app", "sitemap.ts");

  assert.match(footer, /getAnalyticsConsentLocale\(pathname, activeLocale\)/);
  assert.match(footer, /privacyLocale === "de" \? "Datenschutz" : "Privacy"/);
  assert.match(footer, /href: getAnalyticsPrivacyPath\(pathname, activeLocale\)/);
  assert.match(
    widget,
    /href=\{siteLocale === "de" \? "\/datenschutz" : "\/privacy"\}[^>]*>\{widgetSiteT\(siteLocale, "privacy"\)\}</
  );
  assert.match(analytics, /getAnalyticsPrivacyPath\(pathname, activeLocale\)/);
  assert.match(analytics, /href=\{privacyPath\}/);
  assert.match(robots, /"\/privacy"/);
  assert.match(sitemap, /siteUrl\}\/privacy/);
});

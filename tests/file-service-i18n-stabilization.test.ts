import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import { customerPortalLocaleOrder, customerPortalLocaleOverrides, customerPortalTranslations } from "../src/lib/customerPortalTranslations";
import { defaultLocale, supportedLocales } from "../src/lib/i18nConfig";
import {
  languageAlternates,
  localizedPath,
  localizedSeoLocales,
  localizedUrl,
  seoLocales,
} from "../src/lib/seo";

test("English uses one canonical root URL family", () => {
  assert.equal(defaultLocale, "en");
  assert.equal(localizedPath("en"), "/");
  assert.equal(localizedPath("en", "/services/stage-1"), "/services/stage-1");
  assert.equal(localizedUrl("en", "/how-it-works"), "https://file.mgautotech.de/how-it-works");
  assert.deepEqual(
    localizedSeoLocales,
    seoLocales.filter((locale) => locale !== "en")
  );

  const alternates = languageAlternates("/services/stage-1");
  assert.equal(alternates.en, "https://file.mgautotech.de/services/stage-1");
  assert.equal(alternates["x-default"], "https://file.mgautotech.de/services/stage-1");
  assert.equal(alternates.de, "https://file.mgautotech.de/de/services/stage-1");
});

test("legacy English-prefixed URLs permanently redirect to canonical root URLs", () => {
  const nextConfig = readFileSync("next.config.ts", "utf8");
  assert.match(nextConfig, /source:\s*"\/en"[\s\S]*destination:\s*"\/"[\s\S]*permanent:\s*true/u);
  assert.match(nextConfig, /source:\s*"\/en\/:path\*"[\s\S]*destination:\s*"\/:path\*"[\s\S]*permanent:\s*true/u);

  const sitemap = readFileSync("src/app/sitemap.ts", "utf8");
  assert.match(sitemap, /localizedSeoLocales/u);
  assert.doesNotMatch(sitemap, /seoLocales\.flatMap/u);
});

test("critical customer portal translations cover every non-English locale", () => {
  const expectedLocales = supportedLocales
    .map(({ code }) => code)
    .filter((code) => code !== "en");
  assert.deepEqual([...customerPortalLocaleOrder].sort(), expectedLocales.sort());

  for (const [source, translations] of Object.entries(customerPortalTranslations)) {
    assert.equal(translations.length, customerPortalLocaleOrder.length, source);
    translations.forEach((translation, index) => {
      assert.ok(translation.trim(), `${source} is blank for ${customerPortalLocaleOrder[index]}`);
    });
  }

  for (const locale of ["ru", "zh", "sq"] as const) {
    assert.ok(customerPortalLocaleOverrides[locale]?.["File Expert jobs"], locale);
    assert.ok(customerPortalLocaleOverrides[locale]?.["New Password"], locale);
    assert.ok(Object.keys(customerPortalLocaleOverrides[locale] ?? {}).length > 20, locale);
  }
});

test("customer-facing source strings pass the permanent i18n coverage audit", () => {
  const output = execFileSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "scripts/check-customer-i18n.ts"], {
    encoding: "utf8",
  });
  assert.match(output, /Customer i18n coverage passed/u);
});

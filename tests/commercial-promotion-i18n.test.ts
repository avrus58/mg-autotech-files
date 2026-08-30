import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  defaultCreditPromotionLabel,
  localizeCreditPromotionLabel,
} from "../src/lib/i18n/commercial-translations";
import { supportedLocales } from "../src/lib/i18nConfig";

test("the reviewed credit promotion has explicit copy in every site locale", () => {
  const localized = supportedLocales.map(({ code }) =>
    localizeCreditPromotionLabel(code, defaultCreditPromotionLabel)
  );

  assert.equal(localized.length, 12);
  assert.ok(localized.every(Boolean));
  assert.equal(new Set(localized).size, 12);
  assert.match(localizeCreditPromotionLabel("zh", defaultCreditPromotionLabel)!, /额度/);
  assert.match(localizeCreditPromotionLabel("de", defaultCreditPromotionLabel)!, /Guthaben/);
});

test("unreviewed owner copy is preserved in English and fails closed to a generic localized label", () => {
  assert.equal(localizeCreditPromotionLabel("en", "Summer workshop offer"), "Summer workshop offer");
  assert.equal(localizeCreditPromotionLabel("de", "Summer workshop offer"), "Guthabenangebot");
  assert.equal(localizeCreditPromotionLabel("zh", "Summer workshop offer"), "额度优惠");
  assert.equal(localizeCreditPromotionLabel("tr", "   "), null);
});

test("public and authenticated credit offers use the reviewed localization boundary", async () => {
  const [homepage, credits] = await Promise.all([
    readFile("src/components/homepage/HomepageExperience.tsx", "utf8"),
    readFile("src/app/dashboard/credits/page.tsx", "utf8"),
  ]);

  for (const source of [homepage, credits]) {
    assert.match(source, /localizeCreditPromotionLabel\(locale,[\s\S]*?promotionLabel\)/);
  }
  assert.doesNotMatch(homepage, />\{publicCreditQuote\.quote\.promotionLabel\}</);
  assert.doesNotMatch(credits, />\{quote\.promotionLabel\}</);
});

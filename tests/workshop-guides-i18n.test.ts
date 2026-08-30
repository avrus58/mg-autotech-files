import assert from "node:assert/strict";
import test from "node:test";
import { supportedLocales } from "../src/lib/i18nConfig";
import {
  workshopGuideExactTranslations,
  workshopGuideLocaleOrder,
  workshopGuideSourceGroups,
} from "../src/lib/i18n/workshop-guides-translations";

const expectedNonEnglishLocales = supportedLocales
  .map((locale) => locale.code)
  .filter((locale) => locale !== "en");

test("workshop guide catalog covers every article field in every non-English locale", () => {
  assert.deepEqual(
    [...workshopGuideLocaleOrder].sort(),
    [...expectedNonEnglishLocales].sort(),
  );
  assert.deepEqual(workshopGuideSourceGroups.map((group) => group.length), [35, 35, 35, 35, 35]);

  const sourceStrings = [
    ...new Set([
      ...workshopGuideSourceGroups.flat(),
      "ECU & TCU Workshop Knowledge Center",
      "A practical MG AutoTech knowledge center for ECU and TCU file-service preparation, vehicle and controller identification, read methods, service selection and workshop tools.",
    ]),
  ];
  assert.equal(sourceStrings.length, 175);
  assert.deepEqual(Object.keys(workshopGuideExactTranslations).sort(), sourceStrings.sort());

  for (const [source, values] of Object.entries(workshopGuideExactTranslations)) {
    assert.equal(values.length, workshopGuideLocaleOrder.length, source);
    for (const value of values) {
      assert.ok(value.trim().length > 0, source);
      assert.notEqual(value, source, `${source} must not fall back to English`);
    }
  }
});

test("workshop translations retain controller and diagnostic identifiers", () => {
  for (const [source, values] of Object.entries(workshopGuideExactTranslations)) {
    for (const token of ["ECU", "TCU", "OBD", "DTC", "HW", "SW"]) {
      if (!new RegExp(`\\b${token}\\b`).test(source)) continue;
      values.forEach((value, index) => {
        assert.match(
          value,
          new RegExp(`\\b${token}\\b`),
          `${workshopGuideLocaleOrder[index]} lost ${token} in ${source}`,
        );
      });
    }
  }
});

test("workshop locales use native writing systems and diacritics", () => {
  const allFor = (locale: (typeof workshopGuideLocaleOrder)[number]) => {
    const index = workshopGuideLocaleOrder.indexOf(locale);
    return Object.values(workshopGuideExactTranslations).map((values) => values[index]).join(" ");
  };

  assert.match(allFor("de"), /[äöüß]/i);
  assert.match(allFor("tr"), /[çğıİöşü]/);
  assert.match(allFor("nl"), /[ëé]/i);
  assert.match(allFor("fr"), /[àâçéèêëîïôùûüÿœ]/i);
  assert.match(allFor("it"), /[àèéìòù]/i);
  assert.match(allFor("es"), /[áéíñóúü¿¡]/i);
  assert.match(allFor("pt"), /[áâãàçéêíóôõú]/i);
  assert.match(allFor("pl"), /[ąćęłńóśźż]/i);
  assert.match(allFor("ru"), /[А-Яа-яЁё]/);
  assert.match(allFor("zh"), /[\u3400-\u9fff]/);
  assert.match(allFor("sq"), /[ëç]/i);
});

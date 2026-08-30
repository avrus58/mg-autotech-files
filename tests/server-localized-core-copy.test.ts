import assert from "node:assert/strict";
import test from "node:test";
import { localizedSeoFooterCopy } from "../src/components/LocalizedSeoFooter";
import { fileServiceJsonLd, getFileServiceCopy } from "../src/lib/fileServiceI18n";
import { getHowItWorksCopy } from "../src/lib/howItWorksI18n";
import { supportedLocales, type LocaleCode } from "../src/lib/i18nConfig";

const localeCodes = supportedLocales.map(({ code }) => code);
const nonEnglishLocales = localeCodes.filter((locale): locale is Exclude<LocaleCode, "en"> => locale !== "en");

function assertSameShape(reference: unknown, candidate: unknown, path = "copy") {
  if (Array.isArray(reference)) {
    assert.ok(Array.isArray(candidate), `${path} must remain an array`);
    assert.equal(candidate.length, reference.length, `${path} length changed`);
    reference.forEach((value, index) => assertSameShape(value, candidate[index], `${path}[${index}]`));
    return;
  }

  if (reference && typeof reference === "object") {
    assert.ok(candidate && typeof candidate === "object" && !Array.isArray(candidate), `${path} must remain an object`);
    assert.deepEqual(Object.keys(candidate).sort(), Object.keys(reference).sort(), `${path} keys changed`);
    for (const key of Object.keys(reference)) {
      assertSameShape(
        (reference as Record<string, unknown>)[key],
        (candidate as Record<string, unknown>)[key],
        `${path}.${key}`,
      );
    }
    return;
  }

  assert.equal(typeof candidate, typeof reference, `${path} leaf type changed`);
  if (typeof candidate === "string") assert.ok(candidate.trim().length > 0, `${path} must not be blank`);
}

function collectEqualProse(reference: unknown, candidate: unknown, path = "copy", result: string[] = []) {
  if (Array.isArray(reference) && Array.isArray(candidate)) {
    reference.forEach((value, index) => collectEqualProse(value, candidate[index], `${path}[${index}]`, result));
    return result;
  }

  if (reference && candidate && typeof reference === "object" && typeof candidate === "object") {
    for (const key of Object.keys(reference)) {
      collectEqualProse(
        (reference as Record<string, unknown>)[key],
        (candidate as Record<string, unknown>)[key],
        `${path}.${key}`,
        result,
      );
    }
    return result;
  }

  if (
    typeof reference === "string" &&
    candidate === reference &&
    !path.endsWith(".href") &&
    !new Set(["Home", "Services", "Login", "FAQ", "Performance", "TCU", "Catalog"]).has(reference)
  ) {
    result.push(`${path}: ${reference}`);
  }
  return result;
}

test("server-localized core pages have a complete shape for every supported locale", () => {
  const howReference = getHowItWorksCopy("en");
  const fileReference = getFileServiceCopy("en");

  for (const locale of localeCodes) {
    assertSameShape(howReference, getHowItWorksCopy(locale), `howItWorks.${locale}`);
    assertSameShape(fileReference, getFileServiceCopy(locale), `fileService.${locale}`);
    assertSameShape(localizedSeoFooterCopy.en, localizedSeoFooterCopy[locale], `footer.${locale}`);
  }
});

test("non-English server copy does not silently inherit English prose", () => {
  const howReference = getHowItWorksCopy("en");
  const fileReference = getFileServiceCopy("en");
  const englishServiceSchema = fileServiceJsonLd("en")[1] as {
    audience: { audienceType: string };
  };

  for (const locale of nonEnglishLocales) {
    assert.deepEqual(collectEqualProse(howReference, getHowItWorksCopy(locale), `howItWorks.${locale}`), []);
    assert.deepEqual(collectEqualProse(fileReference, getFileServiceCopy(locale), `fileService.${locale}`), []);
    assert.notEqual(localizedSeoFooterCopy[locale].brandLine, localizedSeoFooterCopy.en.brandLine);
    assert.notEqual(localizedSeoFooterCopy[locale].widget, localizedSeoFooterCopy.en.widget);
    assert.notEqual(localizedSeoFooterCopy[locale].country, localizedSeoFooterCopy.en.country);
    const localizedServiceSchema = fileServiceJsonLd(locale)[1] as {
      audience: { audienceType: string };
    };
    assert.notEqual(
      localizedServiceSchema.audience.audienceType,
      englishServiceSchema.audience.audienceType,
      `fileService.${locale} JSON-LD audience leaked English prose`,
    );
  }
});

test("localized prose uses native diacritics instead of legacy ASCII transliteration", () => {
  const serialized = (locale: LocaleCode) => JSON.stringify({
    how: getHowItWorksCopy(locale),
    file: getFileServiceCopy(locale),
    footer: localizedSeoFooterCopy[locale],
  });

  const tokenGuard = (tokens: string[]) => new RegExp(
    `(?:^|[^A-Za-zÀ-žА-Яа-яЁё一-鿿])(?:${tokens.join("|")})(?:$|[^A-Za-zÀ-žА-Яа-яЁё一-鿿])`,
    "i",
  );

  assert.doesNotMatch(serialized("de"), tokenGuard(["fuer", "ueber", "oeffentliche", "pruefen", "geschuetzt", "waehlen", "erklaeren", "unterstuetzt"]));
  assert.doesNotMatch(serialized("tr"), tokenGuard(["musteri", "guvenli", "yukle", "arac", "surec", "gonder", "odeme", "acik", "calisir"]));
  assert.doesNotMatch(serialized("fr"), tokenGuard(["securise", "demarrer"]));
  assert.doesNotMatch(serialized("pl"), tokenGuard(["uslug", "plikow", "warsztatow", "zgloszenie", "dziala"]));
  assert.doesNotMatch(serialized("pt"), tokenGuard(["servico", "ficheiros sem seguranca"]));
  assert.doesNotMatch(serialized("sq"), tokenGuard(["te dhenat", "sherbim", "kerkese"]));
});

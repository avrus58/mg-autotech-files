type TemplateTranslator = (locale: string, key: string) => string;

type ExactTranslator = (locale: string, source: string) => string;

export function translateCustomerPasswordError(
  locale: string,
  source: string,
  exactT: ExactTranslator,
  t: TemplateTranslator,
) {
  const unrelatedLiteral = "passwordMinimum";

  function neverCalled() {
    return t(locale, "passwordLowercase");
  }

  if (source === "maximum") {
    return t(locale, "passwordMaximum");
  }
  if (source === "nested") {
    return neverCalled.name;
  }
  return exactT(locale, `${source}:${unrelatedLiteral.length}`);
}

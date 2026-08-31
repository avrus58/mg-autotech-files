import { defaultLocale, type LocaleCode } from "@/lib/i18nConfig";

export type RuntimeTranslationCatalog = {
  exact: Record<LocaleCode, Record<string, string>>;
  supplementalExact: Record<LocaleCode, Record<string, string>>;
  terms: Record<LocaleCode, Record<string, string>>;
  canonicalSources: Record<string, string>;
  metadataCanonicalSources?: Record<string, string>;
};

export type CanonicalSourceAccumulator = {
  ambiguous: Set<string>;
  lookup: Record<string, string>;
  sources: Set<string>;
};

export function createCanonicalSourceAccumulator(): CanonicalSourceAccumulator {
  return {
    ambiguous: new Set<string>(),
    lookup: {},
    sources: new Set<string>(),
  };
}

function normalizedCatalogValue(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function registerCanonicalSource(
  accumulator: CanonicalSourceAccumulator,
  source: string,
) {
  const normalizedSource = normalizedCatalogValue(source);
  if (!normalizedSource) return;

  const existing = accumulator.lookup[normalizedSource];
  if (existing && existing !== normalizedSource) {
    delete accumulator.lookup[normalizedSource];
    accumulator.ambiguous.add(normalizedSource);
  }
  accumulator.sources.add(normalizedSource);
}

export function registerCanonicalVariant(
  accumulator: CanonicalSourceAccumulator,
  source: string,
  variant: string,
) {
  const normalizedSource = normalizedCatalogValue(source);
  const normalizedVariant = normalizedCatalogValue(variant);
  if (
    !normalizedSource ||
    !normalizedVariant ||
    normalizedSource === normalizedVariant ||
    accumulator.ambiguous.has(normalizedVariant)
  ) {
    return;
  }

  if (accumulator.sources.has(normalizedVariant)) {
    delete accumulator.lookup[normalizedVariant];
    accumulator.ambiguous.add(normalizedVariant);
    return;
  }

  const existing = accumulator.lookup[normalizedVariant];
  if (existing && existing !== normalizedSource) {
    delete accumulator.lookup[normalizedVariant];
    accumulator.ambiguous.add(normalizedVariant);
    return;
  }

  accumulator.lookup[normalizedVariant] = normalizedSource;
}

export function translateRuntimeExactText(
  value: string,
  locale: LocaleCode,
  catalog: RuntimeTranslationCatalog,
  scope: "content" | "metadata" = "content",
) {
  const leading = value.match(/^\s*/)?.[0] ?? "";
  const trailing = value.match(/\s*$/)?.[0] ?? "";
  const normalized = normalizedCatalogValue(value);

  if (!normalized) return value;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(normalized)) return value;

  // Next.js appends the product suffix to route metadata at runtime. Resolve
  // only the complete title stem and keep the audited brand suffix literal.
  const brandedTitleSuffix = " | MG AutoTech";
  const hasBrandedTitleSuffix = normalized.endsWith(brandedTitleSuffix);
  const currentSource = hasBrandedTitleSuffix
    ? normalized.slice(0, -brandedTitleSuffix.length)
    : normalized;
  const canonicalSource =
    (scope === "metadata"
      ? catalog.metadataCanonicalSources?.[currentSource]
      : undefined) ??
    catalog.canonicalSources[currentSource] ?? currentSource;
  const preservedSuffix = hasBrandedTitleSuffix ? brandedTitleSuffix : "";

  if (locale === defaultLocale) {
    if (canonicalSource === currentSource) return value;
    return `${leading}${canonicalSource}${preservedSuffix}${trailing}`;
  }

  const exact =
    catalog.supplementalExact[locale]?.[canonicalSource] ??
    catalog.exact[locale]?.[canonicalSource];
  if (exact) return `${leading}${exact}${preservedSuffix}${trailing}`;

  const terms = catalog.terms[locale] ?? {};
  const term =
    terms[canonicalSource] ??
    Object.entries(terms).find(
      ([source]) => source.toLowerCase() === canonicalSource.toLowerCase(),
    )?.[1];

  if (term) return `${leading}${term}${preservedSuffix}${trailing}`;
  return value;
}

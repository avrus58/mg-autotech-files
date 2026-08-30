import type { LocaleCode } from "@/lib/i18nConfig";

export const defaultCreditPromotionLabel =
  "Limited time -20% on all credit purchases";

const defaultCreditPromotionLabels = {
  en: defaultCreditPromotionLabel,
  nl: "Tijdelijk: 20% korting op alle tegoedaankopen",
  de: "Nur für kurze Zeit: 20 % Rabatt auf alle Guthabenkäufe",
  fr: "Offre limitée : -20 % sur tous les achats de crédits",
  it: "Per un periodo limitato: -20% su tutti gli acquisti di crediti",
  ru: "Ограниченное время: скидка 20% на все покупки баллов",
  es: "Por tiempo limitado: 20 % de descuento en todas las compras de créditos",
  tr: "Sınırlı süre: tüm kredi alımlarında %20 indirim",
  pt: "Por tempo limitado: 20% de desconto em todas as compras de créditos",
  zh: "限时：所有额度购买享八折优惠",
  pl: "Tylko przez ograniczony czas: 20% rabatu na wszystkie zakupy punktów",
  sq: "Për një kohë të kufizuar: 20% zbritje në të gjitha blerjet e krediteve",
} as const satisfies Record<LocaleCode, string>;

const genericCreditPromotionLabels = {
  en: "Credit offer",
  nl: "Tegoedaanbieding",
  de: "Guthabenangebot",
  fr: "Offre de crédits",
  it: "Offerta crediti",
  ru: "Специальное предложение",
  es: "Oferta de créditos",
  tr: "Kredi kampanyası",
  pt: "Oferta de créditos",
  zh: "额度优惠",
  pl: "Oferta punktów",
  sq: "Ofertë kreditesh",
} as const satisfies Record<LocaleCode, string>;

/**
 * Commercial labels are owner-authored data, not product UI copy. We translate
 * the reviewed built-in campaign exactly. For a later custom campaign we keep
 * the owner's wording in English, but use a truthful localized generic label
 * elsewhere rather than guessing a translation of commercial copy.
 */
export function localizeCreditPromotionLabel(
  locale: LocaleCode,
  value: string | null | undefined
) {
  const label = value?.trim();
  if (!label) return null;
  if (label === defaultCreditPromotionLabel) {
    return defaultCreditPromotionLabels[locale];
  }
  return locale === "en" ? label : genericCreditPromotionLabels[locale];
}

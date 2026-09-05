type LocaleCode =
  | "en"
  | "de"
  | "tr"
  | "nl"
  | "fr"
  | "it"
  | "ru"
  | "es"
  | "pt"
  | "zh"
  | "pl"
  | "sq";

const localized: Record<LocaleCode, { title: string }> = {
  en: { title: "English title" },
  de: { title: "English title" },
  tr: { title: "English title" },
  nl: { title: "English title" },
  fr: { title: "English title" },
  it: { title: "English title" },
  ru: { title: "English title" },
  es: { title: "English title" },
  pt: { title: "English title" },
  zh: { title: "English title" },
  pl: { title: "English title" },
  sq: { title: "English title" },
};

export { localized };

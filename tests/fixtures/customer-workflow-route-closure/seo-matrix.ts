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

type Copy = { description: (name: string) => string };

const localized: Record<LocaleCode, Copy> = {
  en: { description: (name) => `${name} localized English metadata` },
  de: { description: (name) => `${name} lokalisierte deutsche Metadaten` },
  tr: { description: (name) => `${name} yerelleştirilmiş Türkçe metadata` },
  nl: { description: (name) => `${name} gelokaliseerde Nederlandse metadata` },
  fr: { description: (name) => `${name} métadonnées françaises localisées` },
  it: { description: (name) => `${name} metadati italiani localizzati` },
  ru: { description: (name) => `${name} локализованные метаданные` },
  es: { description: (name) => `${name} metadatos localizados` },
  pt: { description: (name) => `${name} metadados localizados` },
  zh: { description: (name) => `${name} 本地化元数据` },
  pl: { description: (name) => `${name} zlokalizowane metadane` },
  sq: { description: (name) => `${name} metadata të lokalizuara` },
};

const outside = {
  description: () => "Outside raw metadata copy",
};

export { localized, outside };

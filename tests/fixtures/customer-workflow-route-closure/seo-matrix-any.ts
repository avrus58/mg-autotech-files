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

const localized: Record<LocaleCode, any> = {
  en: { title: "English title" },
  de: { title: "Deutscher Titel" },
  tr: { title: "Türkçe başlık" },
  nl: { title: "Nederlandse titel" },
  fr: { title: "Titre français" },
  it: { title: "Titolo italiano" },
  ru: { title: "Русский заголовок" },
  es: { title: "Título español" },
  pt: { title: "Título português" },
  zh: { title: "中文标题" },
  pl: { title: "Polski tytuł" },
  sq: { title: "Titull shqip" },
};

export { localized };

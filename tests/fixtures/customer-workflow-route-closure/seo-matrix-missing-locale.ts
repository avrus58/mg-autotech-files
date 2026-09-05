type LocaleCode = "en" | "de";

// @ts-expect-error This negative fixture intentionally omits a supported locale.
const localized: Record<LocaleCode, { title: string }> = {
  en: { title: "English title" },
};

export { localized };

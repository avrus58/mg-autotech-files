import type { LocaleCode } from "../../../src/lib/i18nConfig";

function localizeFixture(_locale: LocaleCode) {
  return "Unrelated local copy";
}

export function RuntimeFunctionSpoof({ locale }: { locale: LocaleCode }) {
  return <p>{localizeFixture(locale)}</p>;
}

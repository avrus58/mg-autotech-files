import type { LocaleCode } from "../../../src/lib/i18nConfig";
import { localizeFixture } from "./runtime-function-provider";

export function RuntimeFunctionConsumer({ locale }: { locale: LocaleCode }) {
  return <p>{localizeFixture(locale)}</p>;
}

import { customerWorkflowT } from "../../../src/lib/i18n/customer-workflow-request-translations";
import type { LocaleCode } from "../../../src/lib/i18nConfig";

export function localizeFixture(locale: LocaleCode) {
  return customerWorkflowT(locale, "creditsCount", { count: 1 });
}

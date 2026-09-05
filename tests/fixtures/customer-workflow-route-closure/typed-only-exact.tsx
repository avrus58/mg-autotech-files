import { customerWorkflowExactT } from "@/lib/i18n/customer-workflow-auth-translations";
import type { LocaleCode } from "@/lib/i18nConfig";

export function TypedOnlyExact(locale: LocaleCode) {
  return <p>{customerWorkflowExactT(locale, "Back")}</p>;
}

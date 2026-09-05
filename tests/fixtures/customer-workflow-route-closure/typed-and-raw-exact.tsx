import { customerWorkflowExactT } from "@/lib/i18n/customer-workflow-auth-translations";
import type { LocaleCode } from "@/lib/i18nConfig";

export function TypedAndRawExact(locale: LocaleCode) {
  return (
    <div>
      <p>{customerWorkflowExactT(locale, "Back")}</p>
      <p>Back</p>
    </div>
  );
}

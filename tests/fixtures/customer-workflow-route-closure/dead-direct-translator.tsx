import { customerWorkflowExactT } from "@/lib/i18n/customer-workflow-auth-translations";
import type { LocaleCode } from "@/lib/i18nConfig";

function passthrough(value: string, _callback: () => string) {
  return value;
}

export function DeadDirectTranslator(locale: LocaleCode) {
  function dead() {
    return customerWorkflowExactT(locale, "Back");
  }

  const shown = passthrough("Visible result", dead);
  return <p>{shown}</p>;
}

import { customerWorkflowExactT } from "@/lib/i18n/customer-workflow-auth-translations";
import type { LocaleCode } from "@/lib/i18nConfig";

const transportCopy = {
  title: "Back",
} as const;

function rawCopy() {
  return transportCopy.title;
}

export function ManualExactDerivedRaw({ locale }: { locale: LocaleCode }) {
  return (
    <section>
      <p>{customerWorkflowExactT(locale, transportCopy.title)}</p>
      <p>{rawCopy()}</p>
    </section>
  );
}

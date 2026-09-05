import { customerWorkflowT } from "../../../src/lib/i18n/customer-workflow-request-translations";
import type { LocaleCode } from "../../../src/lib/i18nConfig";

function buildClipboardSummary(count: number, locale: LocaleCode) {
  return customerWorkflowT(locale, "creditsCount", { count });
}

function deadClipboardSummary(locale: LocaleCode) {
  return customerWorkflowT(locale, "selectedCount", { count: 1 });
}

export function ClipboardSummary({ locale }: { locale: LocaleCode }) {
  const summary = buildClipboardSummary(1, locale);
  deadClipboardSummary(locale);

  return (
    <button onClick={() => navigator.clipboard.writeText(summary)}>Copy</button>
  );
}

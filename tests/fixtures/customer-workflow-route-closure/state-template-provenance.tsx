import { useState } from "react";
import {
  customerWorkflowT,
  type CustomerWorkflowTranslationKey,
} from "../../../src/lib/i18n/customer-workflow-request-translations";
import type { LocaleCode } from "../../../src/lib/i18nConfig";

type Notice = {
  template: CustomerWorkflowTranslationKey;
  values: Record<string, string | number>;
};

export function StateTemplateProvenance({ locale }: { locale: LocaleCode }) {
  const [notice, setNotice] = useState<Notice | null>(null);

  return (
    <div>
      <button
        type="button"
        onClick={() =>
          setNotice({ template: "creditsCount", values: { count: 1 } })
        }
      >
        Set notice
      </button>
      {notice ? (
        <p>{customerWorkflowT(locale, notice.template, notice.values)}</p>
      ) : null}
    </div>
  );
}

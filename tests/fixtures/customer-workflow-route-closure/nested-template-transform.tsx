import { customerWorkflowT } from "../../../src/lib/i18n/customer-workflow-orders-translations";
import type { LocaleCode } from "../../../src/lib/i18nConfig";

export function NestedTemplateTransform({ locale }: { locale: LocaleCode }) {
  return (
    <p>
      {customerWorkflowT(locale, "createSimilarRequest", {
        vehicle: `${customerWorkflowT(locale, "thisVehicle", {})}`.trim(),
      })}
    </p>
  );
}

export function DeadNestedTemplateTransform({
  locale,
}: {
  locale: LocaleCode;
}) {
  console.log(
    `${customerWorkflowT(locale, "selectedCount" as never, { count: 1 })}`.trim(),
  );
  return null;
}

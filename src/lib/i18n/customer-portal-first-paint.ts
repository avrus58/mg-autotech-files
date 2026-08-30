import type { LocaleCode } from "@/lib/i18nConfig";
import { customerWorkflowExactTranslations } from "@/lib/i18n/customer-workflow-portal-common-translations";
import { createCustomerWorkflowClientTranslators } from "@/lib/i18n/customer-workflow-client-runtime";

const customerPortalFirstPaintTranslators =
  createCustomerWorkflowClientTranslators(
    customerWorkflowExactTranslations,
    [] as const,
  );

/** Keep protected-route loading and recovery HTML localized before hydration. */
export function customerPortalFirstPaintT(
  locale: LocaleCode,
  source: string,
) {
  return customerPortalFirstPaintTranslators.exactT(locale, source);
}

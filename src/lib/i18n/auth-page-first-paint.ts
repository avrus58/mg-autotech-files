import type { LocaleCode } from "@/lib/i18nConfig";
import { customerWorkflowExactTranslations as authDomExactTranslations } from "@/lib/i18n/customer-workflow-auth-dom-translations";
import { customerWorkflowExactTranslations as authRuntimeExactTranslations } from "@/lib/i18n/customer-workflow-auth-translations";
import { createCustomerWorkflowClientTranslators } from "@/lib/i18n/customer-workflow-client-runtime";

const authPageFirstPaintTranslators = createCustomerWorkflowClientTranslators(
  {
    ...authRuntimeExactTranslations,
    ...authDomExactTranslations,
  },
  [] as const,
);

/**
 * Localizes auth-page copy during React's server render. The same generated
 * catalog is used by the post-hydration DOM safety net, so first paint and
 * later locale changes cannot disagree.
 */
export function authPageFirstPaintT(locale: LocaleCode, source: string) {
  return authPageFirstPaintTranslators.exactT(locale, source);
}

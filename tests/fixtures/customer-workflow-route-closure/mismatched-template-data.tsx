import { customerWorkflowT } from "@/lib/i18n/customer-workflow-credits-translations";
import type { LocaleCode } from "@/lib/i18nConfig";

const packages = [
  {
    id: "credits_10",
    description: "50 credits for regular file-service work.",
  },
] as const;

const packageDescriptionKeys = {
  credits_10: "creditPackageDescription10",
} as const;

export function MismatchedTemplateData(locale: LocaleCode) {
  return packages.map((item) => (
    <p key={item.id}>
      {customerWorkflowT(locale, packageDescriptionKeys[item.id])}
    </p>
  ));
}

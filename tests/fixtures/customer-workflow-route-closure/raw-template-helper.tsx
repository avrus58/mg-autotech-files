import { customerWorkflowT } from "@/lib/i18n/customer-workflow-credits-translations";
import type { LocaleCode } from "@/lib/i18nConfig";

const packages = [
  {
    id: "credits_10",
    description: "10 credits for occasional file-service work.",
  },
] as const;

const packageDescriptionKeys = {
  credits_10: "creditPackageDescription10",
} as const;

function packageDescription({ description }: (typeof packages)[number]) {
  return description;
}

export function RawTemplateHelper(locale: LocaleCode) {
  return packages.map((item) => (
    <div key={item.id}>
      <p>{customerWorkflowT(locale, packageDescriptionKeys[item.id])}</p>
      <span>{packageDescription(item)}</span>
    </div>
  ));
}

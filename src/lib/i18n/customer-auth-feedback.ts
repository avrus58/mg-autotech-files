import type { LocaleCode } from "@/lib/i18nConfig";
import {
  customerPasswordErrorT,
  customerWorkflowExactT,
} from "@/lib/i18n/customer-workflow-auth-translations";

export type CustomerAuthFeedback =
  | { kind: "password-validation"; source: string }
  | { kind: "exact"; source: string }
  | { kind: "safe-raw"; text: string };

export function customerAuthFeedbackT(
  locale: LocaleCode,
  feedback: CustomerAuthFeedback | null,
) {
  if (!feedback) return "";

  if (feedback.kind === "password-validation") {
    return customerPasswordErrorT(locale, feedback.source);
  }

  if (feedback.kind === "exact") {
    return customerWorkflowExactT(locale, feedback.source);
  }

  return feedback.text;
}

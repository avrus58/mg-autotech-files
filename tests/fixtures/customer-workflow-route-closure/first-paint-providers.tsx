import { authPageFirstPaintT as authPaint } from "@/lib/i18n/auth-page-first-paint";
import { customerPortalFirstPaintT as portalPaint } from "@/lib/i18n/customer-portal-first-paint";
import { customerWorkflowExactT } from "@/lib/i18n/customer-workflow-security-translations";
import type { LocaleCode } from "@/lib/i18nConfig";

const authFirstPaint = (locale: LocaleCode, source: string) =>
  authPaint(locale, source);
const portalFirstPaint = (locale: LocaleCode, source: string) =>
  portalPaint(locale, source);
const primaryPaint = (locale: LocaleCode, source: string) =>
  customerWorkflowExactT(locale, source);

export function FirstPaintProviders({ locale }: { locale: LocaleCode }) {
  return (
    <>
      <p>{authFirstPaint(locale, "Back")}</p>
      <p>{portalFirstPaint(locale, "Settings")}</p>
      <p>{primaryPaint(locale, "Try again")}</p>
    </>
  );
}

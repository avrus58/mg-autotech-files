import type { Metadata } from "next";
import type { LocaleCode } from "@/lib/i18nConfig";
import { authPageFirstPaintT } from "@/lib/i18n/auth-page-first-paint";
import {
  createCustomerWorkflowClientTranslators,
} from "@/lib/i18n/customer-workflow-client-runtime";
import { customerWorkflowExactT as authExactT } from "@/lib/i18n/customer-workflow-auth-translations";
import { customerWorkflowExactT as creditsExactT } from "@/lib/i18n/customer-workflow-credits-translations";
import { customerWorkflowExactT as overviewExactT } from "@/lib/i18n/customer-workflow-overview-translations";
import { customerWorkflowExactTranslations as portalCommonExactTranslations } from "@/lib/i18n/customer-workflow-portal-common-translations";
import { customerWorkflowExactTranslations as requestDomExactTranslations } from "@/lib/i18n/customer-workflow-request-dom-translations";
import { logStudioT } from "@/lib/i18n/log-analysis-studio-translations";
import { widgetSiteT } from "@/lib/i18n/widget-site-translations";

const privateRobots = {
  index: false,
  follow: false,
} as const;

const privateFirstPaintTranslators = createCustomerWorkflowClientTranslators(
  {
    ...portalCommonExactTranslations,
    ...requestDomExactTranslations,
  },
  [] as const,
);

function privateFirstPaintT(locale: LocaleCode, source: string) {
  return privateFirstPaintTranslators.exactT(locale, source);
}

function buildPrivateMetadata(
  title: string,
  description: string,
  extraRobots: Record<string, boolean> = {},
): Metadata {
  return {
    title,
    description,
    alternates: null,
    openGraph: null,
    twitter: null,
    robots: {
      ...privateRobots,
      ...extraRobots,
    },
  };
}

export function buildLoginMetadata(locale: LocaleCode): Metadata {
  return buildPrivateMetadata(
    authPageFirstPaintT(locale, "Customer Login"),
    authPageFirstPaintT(
      locale,
      "Access your file service dashboard and continue your ECU tuning requests.",
    ),
  );
}

export function buildRegisterMetadata(locale: LocaleCode): Metadata {
  return buildPrivateMetadata(
    authPageFirstPaintT(locale, "Create Account"),
    authPageFirstPaintT(
      locale,
      "A guided setup for private customers and professional workshops.",
    ),
  );
}

export function buildForgotPasswordMetadata(locale: LocaleCode): Metadata {
  return buildPrivateMetadata(
    authPageFirstPaintT(locale, "Forgot password?"),
    authPageFirstPaintT(
      locale,
      "Enter your account e-mail and we will send a secure password reset link.",
    ),
  );
}

export function buildResetPasswordMetadata(locale: LocaleCode): Metadata {
  return buildPrivateMetadata(
    authPageFirstPaintT(locale, "Set new password"),
    authPageFirstPaintT(
      locale,
      "Choose a new password for your MG AutoTech customer account.",
    ),
  );
}

export function buildAuthMetadata(locale: LocaleCode): Metadata {
  return buildPrivateMetadata(
    authPageFirstPaintT(locale, "Secure customer access"),
    privateFirstPaintT(
      locale,
      "Your file requests, credits, messages and completed files are protected inside your MG AutoTech account.",
    ),
  );
}

export function buildCustomerDashboardMetadata(locale: LocaleCode): Metadata {
  return buildPrivateMetadata(
    overviewExactT(locale, "Customer Dashboard"),
    overviewExactT(
      locale,
      "Secure MG AutoTech customer dashboard for file requests, credits and deliveries.",
    ),
  );
}

export function buildLogAnalysisStudioMetadata(locale: LocaleCode): Metadata {
  return buildPrivateMetadata(
    logStudioT(locale, "studioTitle"),
    logStudioT(locale, "studioMetaDescription"),
  );
}

export function buildWidgetDashboardMetadata(locale: LocaleCode): Metadata {
  return buildPrivateMetadata(
    widgetSiteT(locale, "widgetDashboardMetaTitle"),
    widgetSiteT(locale, "widgetDashboardMetaDescription"),
  );
}

export function buildNewRequestMetadata(locale: LocaleCode): Metadata {
  return buildPrivateMetadata(
    privateFirstPaintT(locale, "New File Request"),
    privateFirstPaintT(
      locale,
      "Select vehicle information, choose the required software solution, upload your original file and submit the request to MG AutoTech.",
    ),
  );
}

export function buildPaymentSuccessMetadata(locale: LocaleCode): Metadata {
  return buildPrivateMetadata(
    creditsExactT(locale, "Payment successful"),
    creditsExactT(
      locale,
      "Payment is still being reconciled securely. Checking again...",
    ),
    { noarchive: true },
  );
}

export function buildPaymentCancelMetadata(locale: LocaleCode): Metadata {
  return buildPrivateMetadata(
    creditsExactT(locale, "Payment cancelled"),
    creditsExactT(
      locale,
      "The payment was cancelled. No credits were added and you were not charged by MG AutoTech through this checkout flow.",
    ),
    { noarchive: true },
  );
}

export function buildDesktopTurnstileMetadata(locale: LocaleCode): Metadata {
  return buildPrivateMetadata(
    authExactT(locale, "Secure desktop login"),
    privateFirstPaintT(
      locale,
      "Your account remains protected. Check your connection and try the secure session check again.",
    ),
    { noarchive: true },
  );
}

export function buildMeasurementCompletionMetadata(locale: LocaleCode): Metadata {
  return buildPrivateMetadata(
    authExactT(locale, "Finishing securely"),
    privateFirstPaintT(
      locale,
      "Your account remains protected. Check your connection and try the secure session check again.",
    ),
    { noarchive: true },
  );
}

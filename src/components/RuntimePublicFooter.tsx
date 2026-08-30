import { Footer } from "@/components/Footer";
import { exactTranslations } from "@/lib/i18n";
import { supportedLocales, type LocaleCode } from "@/lib/i18nConfig";
import {
  runtimePublicT,
  type RuntimePublicScope,
} from "@/lib/i18n/runtime-public";

const footerSources = [
  "File Service",
  "Workshop",
  "ECU / TCU File Service",
  "Professional ECU and TCU file service platform for customers, workshops and partners. Upload files, buy credits, track orders and download completed files online.",
  "Services Overview",
  "Stage 1 Tuning",
  "Stage 2 File Service",
  "Stage 3 Custom Calibration",
  "Audi ECU Software",
  "TCU Tuning",
  "ECU File Check",
  "EGR / AGR OFF",
  "DPF OFF",
  "AdBlue OFF",
  "DTC OFF",
  "File Service Hub",
  "How It Works",
  "Vehicle Brands",
  "ECU Platforms",
  "Workshop Tools",
  "Workshop Guides",
  "Vehicle Widget",
  "Windows App Beta",
  "Upload File",
  "Buy Credits",
  "Dashboard",
  "Customer Dashboard",
  "Credit Prices",
  "Login",
  "Register",
  "About MG AutoTech",
  "Contact",
  "Privacy",
  "AGB",
  "Email MG AutoTech",
  "WhatsApp MG AutoTech",
  "Services",
  "Platform",
  "Legal",
  "Germany",
  ", Germany",
  "Secure customer dashboard and private file workflow.",
  "Ready to upload a file?",
  "Start Request",
  "© 2026 MG AutoTech. All rights reserved.",
  "Professional ECU / TCU File Service Platform.",
  "Hello MG AutoTech, I need help with a file service request.",
] as const;

export function runtimePublicFooterExact(
  locale: LocaleCode,
  scopes: readonly RuntimePublicScope[] = ["core"]
) {
  return Object.fromEntries(
    footerSources.map((source) => {
      const scoped = runtimePublicT(locale, source, scopes);
      return [
        source,
        scoped !== source
          ? scoped
          : exactTranslations[locale]?.[source] ?? source,
      ];
    })
  );
}

export function runtimePublicFooterWhatsAppMessage(locale: LocaleCode) {
  return runtimePublicT(
    locale,
    "Hello MG AutoTech, I need help with a file service request.",
    ["core"]
  );
}

export function runtimePublicFooterWhatsAppMessages() {
  return Object.fromEntries(
    supportedLocales.map(({ code }) => [
      code,
      runtimePublicFooterWhatsAppMessage(code),
    ])
  ) as Record<LocaleCode, string>;
}

export function RuntimePublicFooter({
  locale,
  scopes = ["core"],
  variant,
}: {
  locale: LocaleCode;
  scopes?: readonly RuntimePublicScope[];
  variant?: "default" | "homepage";
}) {
  const exact = runtimePublicFooterExact(locale, scopes);

  return (
    <Footer
      variant={variant}
      initialLocalization={{ locale, exact }}
      whatsappMessages={runtimePublicFooterWhatsAppMessages()}
    />
  );
}

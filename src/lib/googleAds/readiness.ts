import type {
  GrowthCustomerSuccessReport,
  GrowthPerformanceRow,
  GrowthReportRange,
} from "@/lib/growth/types";
import {
  isValidGoogleAdsConversionLabel,
  isValidGoogleAdsId,
  isValidGoogleAnalyticsMeasurementId,
} from "@/lib/publicAnalytics";
import { googleAdsLanguageDestinations } from "@/lib/googleAds/campaignLinks";

export type AdsConfigurationStatus = {
  analyticsMeasurement: boolean;
  googleAdsTag: boolean;
  registrationConversion: boolean;
  requestConversion: boolean;
  purchaseConversion: boolean;
  consentModeV2: true;
  personalizedAdvertising: false;
  configurationComplete: boolean;
};

export type AdsDeliveryVerification = {
  status: "external_verification_required";
  label: "Google Ads delivery not verified";
  detail: string;
  sourceOfTruth: "google_ads_and_tag_assistant";
};

export type AdsLandingPageReadiness = {
  path: string;
  intent: string;
  campaignRole: "primary" | "supporting";
  conversionPath: "/register" | "/new-request";
  status: "ready_for_review";
};

export type AdsMeasurementHealthStatus =
  | "configuration_required"
  | "awaiting_consented_traffic"
  | "traffic_observed"
  | "requests_observed"
  | "verified_revenue_observed";

export type AdsMeasurementHealth = {
  status: AdsMeasurementHealthStatus;
  label: string;
  detail: string;
  consentedVisitors: number;
  registrations: number;
  requests: number;
  payingCustomers: number;
};

export type AdsPerformanceReport = {
  generatedAt: string;
  range: GrowthReportRange;
  configuration: AdsConfigurationStatus;
  accountActions: string[];
  measurementPolicy: {
    primaryConversion: "verified_purchase";
    secondaryConversion: "verified_request";
    observationConversion: "verified_registration";
    rawClickIdsStored: false;
    customerIdentifiersExported: false;
  };
  deliveryVerification: AdsDeliveryVerification;
  measurementHealth: AdsMeasurementHealth;
  paidSources: GrowthPerformanceRow[];
  campaigns: GrowthPerformanceRow[];
  landingPages: AdsLandingPageReadiness[];
  languageDestinations: typeof googleAdsLanguageDestinations;
  externalAccountChecks: string[];
  limitations: string[];
};

export function getAdsConfigurationStatus(): AdsConfigurationStatus {
  const analyticsMeasurement = isValidGoogleAnalyticsMeasurementId(
    process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID
  );
  const googleAdsTag = isValidGoogleAdsId(process.env.NEXT_PUBLIC_GOOGLE_ADS_ID);
  const registrationConversion = isValidGoogleAdsConversionLabel(
    process.env.NEXT_PUBLIC_GOOGLE_ADS_REGISTRATION_LABEL
  );
  const requestConversion = isValidGoogleAdsConversionLabel(
    process.env.NEXT_PUBLIC_GOOGLE_ADS_REQUEST_LABEL
  );
  const purchaseConversion = isValidGoogleAdsConversionLabel(
    process.env.NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL
  );

  return {
    analyticsMeasurement,
    googleAdsTag,
    registrationConversion,
    requestConversion,
    purchaseConversion,
    consentModeV2: true,
    personalizedAdvertising: false,
    configurationComplete:
      analyticsMeasurement && googleAdsTag && registrationConversion && requestConversion && purchaseConversion,
  };
}

function safeCount(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

export function buildAdsMeasurementHealth(input: {
  configuration: AdsConfigurationStatus;
  consentedVisitors: number;
  registrations: number;
  requests: number;
  payingCustomers: number;
}): AdsMeasurementHealth {
  const metrics = {
    consentedVisitors: safeCount(input.consentedVisitors),
    registrations: safeCount(input.registrations),
    requests: safeCount(input.requests),
    payingCustomers: safeCount(input.payingCustomers),
  };

  if (!input.configuration.configurationComplete) {
    return {
      ...metrics,
      status: "configuration_required",
      label: "Configuration required",
      detail: "One or more public measurement controls are not configured yet.",
    };
  }
  if (!metrics.consentedVisitors) {
    return {
      ...metrics,
      status: "awaiting_consented_traffic",
      label: "Configured, waiting for visitors",
      detail: "The website measurement settings are complete, but no consented visit has been recorded in this range.",
    };
  }
  if (!metrics.requests) {
    return {
      ...metrics,
      status: "traffic_observed",
      label: "Website traffic recorded",
      detail: "Consented visits are arriving. No verified file request is linked to this range yet.",
    };
  }
  if (!metrics.payingCustomers) {
    return {
      ...metrics,
      status: "requests_observed",
      label: "File requests recorded",
      detail: "Verified file requests are recorded. A verified payment has not appeared in this range yet.",
    };
  }
  return {
    ...metrics,
    status: "verified_revenue_observed",
    label: "Website revenue recorded",
    detail: "The website recorded file requests and verified payments. This does not yet confirm that Google Ads received the conversion signal.",
  };
}

export const adsLandingPages: AdsLandingPageReadiness[] = [
  {
    path: "/services/stage-1",
    intent: "Stage 1 tuning file service for workshops",
    campaignRole: "primary",
    conversionPath: "/new-request",
    status: "ready_for_review",
  },
  {
    path: "/file-service",
    intent: "Online ECU and TCU file service",
    campaignRole: "primary",
    conversionPath: "/new-request",
    status: "ready_for_review",
  },
  {
    path: "/ecu-platforms/transmission-control-units",
    intent: "TCU and gearbox file-service context",
    campaignRole: "supporting",
    conversionPath: "/new-request",
    status: "ready_for_review",
  },
  {
    path: "/how-it-works",
    intent: "File-service workflow and trust validation",
    campaignRole: "supporting",
    conversionPath: "/register",
    status: "ready_for_review",
  },
];

function paidSource(row: GrowthPerformanceRow) {
  return /(?:^|\s\/\s)(?:cpc|ppc|paid|paid_search)$/i.test(row.label);
}

export function buildAdsPerformanceReport(
  growth: GrowthCustomerSuccessReport
): AdsPerformanceReport {
  const configuration = getAdsConfigurationStatus();
  const measurementHealth = buildAdsMeasurementHealth({
    configuration,
    consentedVisitors: growth.funnel.consentedVisitors,
    registrations: growth.funnel.registrations,
    requests: growth.funnel.orders,
    payingCustomers: growth.funnel.payingCustomers,
  });
  const accountActions: string[] = [];
  if (!configuration.googleAdsTag) {
    accountActions.push("Configure the public Google Ads tag ID for the production domain.");
  }
  if (!configuration.registrationConversion) {
    accountActions.push("Create and configure the verified registration conversion label.");
  }
  if (!configuration.requestConversion) {
    accountActions.push("Create and configure the verified request conversion label.");
  }
  if (!configuration.purchaseConversion) {
    accountActions.push("Create and configure the verified payment conversion label.");
  }
  if (!configuration.analyticsMeasurement) {
    accountActions.push("Configure GA4 public measurement before comparing paid and organic journeys.");
  }
  if (measurementHealth.status === "awaiting_consented_traffic") {
    accountActions.push("Validate one complete consented browser journey before activating paid campaign spend.");
  }

  return {
    generatedAt: growth.generatedAt,
    range: growth.range,
    configuration,
    accountActions,
    measurementPolicy: {
      primaryConversion: "verified_purchase",
      secondaryConversion: "verified_request",
      observationConversion: "verified_registration",
      rawClickIdsStored: false,
      customerIdentifiersExported: false,
    },
    deliveryVerification: {
      status: "external_verification_required",
      label: "Google Ads delivery not verified",
      detail:
        "Website results are visible, but Google Ads has not confirmed receiving the conversion signals yet. Check Google Ads diagnostics and Tag Assistant.",
      sourceOfTruth: "google_ads_and_tag_assistant",
    },
    measurementHealth,
    paidSources: growth.bySource.filter(paidSource),
    campaigns: growth.byCampaign.filter((row) => row.key !== "unlabelled"),
    landingPages: adsLandingPages,
    languageDestinations: googleAdsLanguageDestinations,
    externalAccountChecks: [
      "Use the dedicated MG AutoTech File Service Ads account and keep unrelated local-business conversions out of this campaign.",
      "Confirm account access, billing, country, currency, time zone and owner-approved daily budget before enabling spend.",
      "Verify direct website conversion roles: payment Primary, request Secondary and registration observation-only.",
      "Run Tag Assistant for Necessary only, Analytics only and Accept all before campaign activation.",
      "Match campaign language, geographic targeting, ad copy and the final landing-page language.",
      "Review policy-sensitive service groups separately; do not reuse unsupported performance, timing or legality claims.",
    ],
    limitations: [
      "Ad spend, impression share and auction data require a separate read-only Google Ads account connection and are not inferred here.",
      "Campaign attribution includes only visitors who granted optional analytics consent.",
      "A campaign row without verified revenue is not treated as unprofitable until click and spend data are connected.",
      "Service-specific campaigns still require an account-level Google Ads policy and legal review before launch.",
      "A queued browser conversion is not proof of receipt; Google Ads diagnostics and Tag Assistant remain the external source of truth.",
    ],
  };
}

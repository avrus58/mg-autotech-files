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

export type AdsConfigurationStatus = {
  analyticsMeasurement: boolean;
  googleAdsTag: boolean;
  registrationConversion: boolean;
  requestConversion: boolean;
  purchaseConversion: boolean;
  consentModeV2: true;
  personalizedAdvertising: false;
  readyForVerifiedMeasurement: boolean;
};

export type AdsLandingPageReadiness = {
  path: string;
  intent: string;
  campaignRole: "primary" | "supporting";
  conversionPath: "/register" | "/new-request";
  status: "ready_for_review";
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
  paidSources: GrowthPerformanceRow[];
  campaigns: GrowthPerformanceRow[];
  landingPages: AdsLandingPageReadiness[];
  limitations: string[];
};

export function getAdsConfigurationStatus(): AdsConfigurationStatus {
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
    analyticsMeasurement: isValidGoogleAnalyticsMeasurementId(
      process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID
    ),
    googleAdsTag,
    registrationConversion,
    requestConversion,
    purchaseConversion,
    consentModeV2: true,
    personalizedAdvertising: false,
    readyForVerifiedMeasurement:
      googleAdsTag && registrationConversion && requestConversion && purchaseConversion,
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
    paidSources: growth.bySource.filter(paidSource),
    campaigns: growth.byCampaign.filter((row) => row.key !== "unlabelled"),
    landingPages: adsLandingPages,
    limitations: [
      "Ad spend, impression share and auction data require a separate read-only Google Ads account connection and are not inferred here.",
      "Campaign attribution includes only visitors who granted optional analytics consent.",
      "A campaign row without verified revenue is not treated as unprofitable until click and spend data are connected.",
      "Service-specific campaigns still require an account-level Google Ads policy and legal review before launch.",
    ],
  };
}

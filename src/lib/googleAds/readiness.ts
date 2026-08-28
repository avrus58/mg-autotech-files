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
  attributionSigning: boolean;
  distinctConversionLabels: boolean;
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

export type AdsExternalLaunchGate = {
  key:
    | "english_privacy_google_disclosure"
    | "google_ads_data_protection_contact"
    | "edge_query_log_controls"
    | "turnaround_claim_evidence"
    | "uk_ie_emissions_clearance"
    | "daily_budget_overdelivery_acceptance"
    | "same_origin_google_tag_decision"
    | "post_deploy_conversion_receipt"
    | "action_time_ads_assets_and_edits";
  title: string;
  detail: string;
  status: "manual_unverified";
};

export type AdsMeasurementHealthStatus =
  | "report_incomplete"
  | "configuration_required"
  | "awaiting_consented_traffic"
  | "traffic_observed"
  | "requests_observed"
  | "verified_revenue_observed";

export type AdsMeasurementSourceReadiness = Pick<
  GrowthCustomerSuccessReport["sources"],
  "coreBusiness" | "attribution" | "customerClassification"
>;

export type AdsMeasurementHealth = {
  status: AdsMeasurementHealthStatus;
  label: string;
  detail: string;
  consentedVisitors: number;
  registrations: number;
  requests: number;
  payingCustomers: number;
  metricsAvailable: boolean;
  sourceReadiness: AdsMeasurementSourceReadiness;
};

export type AdsPerformanceReport = {
  generatedAt: string;
  range: GrowthReportRange;
  configuration: AdsConfigurationStatus;
  accountActions: string[];
  measurementPolicy: {
    primaryConversions: readonly ["verified_request", "verified_purchase"];
    observationConversion: "verified_registration";
    applicationRetainsRawClickIds: false;
    customerIdentifiersExported: false;
  };
  deliveryVerification: AdsDeliveryVerification;
  measurementHealth: AdsMeasurementHealth;
  paidSources: GrowthPerformanceRow[];
  campaigns: GrowthPerformanceRow[];
  landingPages: AdsLandingPageReadiness[];
  languageDestinations: typeof googleAdsLanguageDestinations;
  externalLaunchGates: AdsExternalLaunchGate[];
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
  const attributionSecret = process.env.GROWTH_ATTRIBUTION_HMAC_SECRET?.trim() ?? "";
  const protectedSecrets = [
    process.env.GROWTH_ATTRIBUTION_LEGACY_HMAC_SECRET,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    process.env.UPLOAD_INTEGRITY_SECRET,
    process.env.CUSTOMER_DEVICE_HMAC_SECRET,
    process.env.FILE_EXPERT_ANALYZER_TOKEN,
    process.env.REQUEST_NETWORK_PROXY_SECRET,
    process.env.SECURITY_RATE_LIMIT_SALT,
    process.env.WIDGET_SESSION_SECRET,
    process.env.WIDGET_IP_HASH_SALT,
    process.env.STRIPE_SECRET_KEY,
    process.env.STRIPE_WEBHOOK_SECRET,
    process.env.STRIPE_WIDGET_WEBHOOK_SECRET,
    process.env.RESEND_API_KEY,
    process.env.RESEND_WEBHOOK_SECRET,
    process.env.OPENAI_API_KEY,
    process.env.LOCAL_AI_API_KEY,
    process.env.VLLM_API_KEY,
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
    process.env.UPSTASH_REDIS_REST_TOKEN,
    process.env.KV_REST_API_TOKEN,
  ]
    .map((value) => value?.trim() ?? "")
    .filter(Boolean);
  const attributionSigning =
    attributionSecret.length >= 32 &&
    attributionSecret.length <= 512 &&
    !protectedSecrets.includes(attributionSecret);
  const conversionLabels = [
    process.env.NEXT_PUBLIC_GOOGLE_ADS_REGISTRATION_LABEL,
    process.env.NEXT_PUBLIC_GOOGLE_ADS_REQUEST_LABEL,
    process.env.NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL,
  ].map((label) => label?.trim() ?? "");
  const distinctConversionLabels =
    registrationConversion &&
    requestConversion &&
    purchaseConversion &&
    new Set(conversionLabels).size === conversionLabels.length;

  return {
    analyticsMeasurement,
    googleAdsTag,
    registrationConversion,
    requestConversion,
    purchaseConversion,
    attributionSigning,
    distinctConversionLabels,
    consentModeV2: true,
    personalizedAdvertising: false,
    configurationComplete:
      analyticsMeasurement &&
      googleAdsTag &&
      registrationConversion &&
      requestConversion &&
      purchaseConversion &&
      attributionSigning &&
      distinctConversionLabels,
  };
}

function safeCount(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

export function buildAdsMeasurementHealth(input: {
  configuration: AdsConfigurationStatus;
  sourceReadiness: AdsMeasurementSourceReadiness;
  consentedVisitors: number;
  registrations: number;
  requests: number;
  payingCustomers: number;
}): AdsMeasurementHealth {
  const reportComplete = Object.values(input.sourceReadiness).every(
    (status) => status === "ready"
  );
  const metrics = {
    consentedVisitors: safeCount(input.consentedVisitors),
    registrations: safeCount(input.registrations),
    requests: safeCount(input.requests),
    payingCustomers: safeCount(input.payingCustomers),
  };

  if (!reportComplete) {
    const unavailable = ([
      ["Core business", input.sourceReadiness.coreBusiness],
      ["Attribution", input.sourceReadiness.attribution],
      ["Customer classification", input.sourceReadiness.customerClassification],
    ] as const)
      .filter(([, status]) => status !== "ready")
      .map(([source, status]) => `${source}: ${status.replaceAll("_", " ")}`)
      .join(", ");
    return {
      consentedVisitors: 0,
      registrations: 0,
      requests: 0,
      payingCustomers: 0,
      metricsAvailable: false,
      sourceReadiness: input.sourceReadiness,
      status: "report_incomplete",
      label: "Report incomplete — do not activate ads",
      detail: `Required evidence is unavailable (${unavailable}). Partial customer, request or revenue totals are withheld until every required source is ready.`,
    };
  }

  if (!input.configuration.configurationComplete) {
    return {
      ...metrics,
      metricsAvailable: true,
      sourceReadiness: input.sourceReadiness,
      status: "configuration_required",
      label: "Configuration required",
      detail: "One or more public measurement controls are not configured yet.",
    };
  }
  if (!metrics.consentedVisitors) {
    return {
      ...metrics,
      metricsAvailable: true,
      sourceReadiness: input.sourceReadiness,
      status: "awaiting_consented_traffic",
      label: "Configured, waiting for visitors",
      detail: "The website measurement settings are complete, but no consented visit has been recorded in this range.",
    };
  }
  if (!metrics.requests) {
    return {
      ...metrics,
      metricsAvailable: true,
      sourceReadiness: input.sourceReadiness,
      status: "traffic_observed",
      label: "Website traffic recorded",
      detail: "Consented visits are arriving. No verified file request is linked to this range yet.",
    };
  }
  if (!metrics.payingCustomers) {
    return {
      ...metrics,
      metricsAvailable: true,
      sourceReadiness: input.sourceReadiness,
      status: "requests_observed",
      label: "File requests recorded",
      detail: "Verified file requests are recorded. A verified payment has not appeared in this range yet.",
    };
  }
  return {
    ...metrics,
    metricsAvailable: true,
    sourceReadiness: input.sourceReadiness,
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
    path: "/services/stage-2",
    intent: "Stage 2 tuning file service for workshops",
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
    path: "/services/ecu-file-check",
    intent: "ECU file check before a customer request",
    campaignRole: "primary",
    conversionPath: "/new-request",
    status: "ready_for_review",
  },
  {
    path: "/ecu-platforms",
    intent: "ECU platform library and compatibility context",
    campaignRole: "supporting",
    conversionPath: "/new-request",
    status: "ready_for_review",
  },
  {
    path: "/services/tcu-tuning",
    intent: "TCU and gearbox file-service requests",
    campaignRole: "primary",
    conversionPath: "/new-request",
    status: "ready_for_review",
  },
  {
    path: "/how-it-works",
    intent: "File-service workflow and trust validation",
    campaignRole: "supporting",
    conversionPath: "/new-request",
    status: "ready_for_review",
  },
];

export const adsExternalLaunchGates: AdsExternalLaunchGate[] = [
  {
    key: "english_privacy_google_disclosure",
    title: "English privacy, Google disclosure and consent version",
    detail:
      "Publish owner/legal-approved English information that reflects current VPS hosting, explains optional Google Analytics and Ads processing, prominently links Google's Business Data Responsibility information, and records whether the material change requires a new consent-version prompt.",
    status: "manual_unverified",
  },
  {
    key: "google_ads_data_protection_contact",
    title: "Google Ads data protection contact",
    detail:
      "Supply and verify the responsible data protection contact in the exact Google Ads account before activation.",
    status: "manual_unverified",
  },
  {
    key: "edge_query_log_controls",
    title: "Edge query-log controls",
    detail:
      "Verify the live Cloudflare and Caddy query redaction, retention and access controls for initial tagged landing requests.",
    status: "manual_unverified",
  },
  {
    key: "turnaround_claim_evidence",
    title: "Turnaround claim evidence",
    detail:
      "The owner must substantiate the current 15-30 minute, 30 minute and same-day statements across actual operating conditions, or approve neutral wording before Ads uses those pages.",
    status: "manual_unverified",
  },
  {
    key: "uk_ie_emissions_clearance",
    title: "UK and Ireland emissions clearance",
    detail:
      "Record qualified UK and Irish legal review plus Google destination-policy clearance for the complete crawlable destination, including emissions-related services.",
    status: "manual_unverified",
  },
  {
    key: "daily_budget_overdelivery_acceptance",
    title: "Daily budget overdelivery acceptance",
    detail:
      "The owner must explicitly accept possible Google daily-budget overdelivery and that the scheduled pause rule is a delayed backstop rather than a real-time hard cap.",
    status: "manual_unverified",
  },
  {
    key: "same_origin_google_tag_decision",
    title: "Same-origin Google-tag trust decision",
    detail:
      "Record the owner's decision to accept the documented same-origin trust boundary or authorize and verify a separate-origin, server-side or offline conversion design.",
    status: "manual_unverified",
  },
  {
    key: "post_deploy_conversion_receipt",
    title: "Post-deploy conversion receipt",
    detail:
      "After the matching deployment, use a fresh browser, Tag Assistant and network evidence to confirm consent behavior and an authorized test conversion receipt before spend.",
    status: "manual_unverified",
  },
  {
    key: "action_time_ads_assets_and_edits",
    title: "Action-time Ads assets and account edits",
    detail:
      "At action time, re-check the exact campaign identity, destinations, assets, policy notices and owner authorization before saving any live-account edit; asset rights and required AI-origin disclosures remain manual.",
    status: "manual_unverified",
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
    sourceReadiness: {
      coreBusiness: growth.sources.coreBusiness,
      attribution: growth.sources.attribution,
      customerClassification: growth.sources.customerClassification,
    },
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
  if (!configuration.attributionSigning) {
    accountActions.push("Configure a dedicated growth attribution signing secret before release.");
  }
  if (!configuration.distinctConversionLabels) {
    accountActions.push("Use a distinct Google Ads conversion label for registration, request and purchase.");
  }
  if (measurementHealth.status === "awaiting_consented_traffic") {
    accountActions.push("Validate one complete consented browser journey before activating paid campaign spend.");
  }
  if (measurementHealth.status === "report_incomplete") {
    accountActions.push("Do not activate paid campaign spend until core business, attribution and customer-classification sources all report ready.");
  }

  return {
    generatedAt: growth.generatedAt,
    range: growth.range,
    configuration,
    accountActions,
    measurementPolicy: {
      primaryConversions: ["verified_request", "verified_purchase"],
      observationConversion: "verified_registration",
      applicationRetainsRawClickIds: false,
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
    paidSources: measurementHealth.metricsAvailable
      ? growth.bySource.filter(paidSource)
      : [],
    campaigns: measurementHealth.metricsAvailable
      ? growth.byCampaign.filter((row) => row.key !== "unlabelled")
      : [],
    landingPages: adsLandingPages,
    languageDestinations: googleAdsLanguageDestinations,
    externalLaunchGates: adsExternalLaunchGates,
    externalAccountChecks: [
      "Use the dedicated MG AutoTech File Service Ads account and keep unrelated local-business conversions out of this campaign.",
      "Confirm account access, billing, country, currency, time zone and owner-approved daily budget before enabling spend.",
      "Verify direct website conversion roles: request Primary / Every, payment Primary / Every and registration Secondary / One. For the initial Search campaign, use a campaign-specific request goal and exclude purchase bidding until verified delivery is proven.",
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
      "Ads outcome totals are withheld whenever a required business, attribution or customer-classification source is incomplete.",
    ],
  };
}

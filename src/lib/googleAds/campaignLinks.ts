import { supportedLocales, type LocaleCode } from "@/lib/i18nConfig";
import { getLocalizedPublicPath } from "@/lib/i18nRoutes";
import { siteUrl } from "@/lib/seo";
import { normalizeGoogleAdsCampaignToken } from "@/lib/googleAds/campaignTokens";

export const googleAdsDestinationDefinitions = [
  { key: "stage1", label: "Stage 1 file service", path: "/services/stage-1" },
  {
    key: "stage2",
    label: "Stage 2 file service (English only)",
    path: "/services/stage-2",
    locale: "en",
  },
  {
    key: "ecu_file_check",
    label: "ECU file check (English only)",
    path: "/services/ecu-file-check",
    locale: "en",
  },
  {
    key: "ecu_platforms",
    label: "ECU platform library (English only)",
    path: "/ecu-platforms",
    locale: "en",
  },
  {
    key: "tcu",
    label: "TCU file service (English only)",
    path: "/services/tcu-tuning",
    locale: "en",
  },
  { key: "file_service", label: "ECU / TCU file service", path: "/file-service" },
  { key: "how_it_works", label: "How the workflow works", path: "/how-it-works" },
] as const;

export type GoogleAdsDestinationKey = (typeof googleAdsDestinationDefinitions)[number]["key"];

export const googleAdsUkIeAuditedSitelinkKeys = [
  "stage1",
  "stage2",
  "ecu_file_check",
  "ecu_platforms",
  "tcu",
  "how_it_works",
] as const satisfies readonly GoogleAdsDestinationKey[];

export type GoogleAdsLanguageDestination = {
  locale: LocaleCode;
  language: string;
  paths: Partial<Record<GoogleAdsDestinationKey, string>>;
};

export const googleAdsLanguageDestinations: GoogleAdsLanguageDestination[] = supportedLocales.map(
  ({ code, name }) => ({
    locale: code,
    language: name,
    paths: Object.fromEntries(
      googleAdsDestinationDefinitions
        .filter((destination) => !("locale" in destination) || destination.locale === code)
        .map((destination) => [
          destination.key,
          "locale" in destination
            ? destination.path
            : getLocalizedPublicPath(destination.path, code),
        ])
    ) as Partial<Record<GoogleAdsDestinationKey, string>>,
  })
);

export function googleAdsDestinationSupportsLocale(
  destination: GoogleAdsDestinationKey,
  locale: LocaleCode
) {
  return Boolean(
    googleAdsLanguageDestinations.find((item) => item.locale === locale)?.paths[destination]
  );
}

export function buildGoogleAdsCampaignUrl(input: {
  locale: LocaleCode;
  destination: GoogleAdsDestinationKey;
  campaign: string;
}) {
  const campaign = normalizeGoogleAdsCampaignToken(input.campaign);
  if (!campaign) return null;

  const language = googleAdsLanguageDestinations.find((item) => item.locale === input.locale);
  const path = language?.paths[input.destination];
  if (!path) return null;

  const url = new URL(path, siteUrl);
  url.searchParams.set("utm_source", "google");
  url.searchParams.set("utm_medium", "cpc");
  url.searchParams.set("utm_campaign", campaign);

  return url.toString();
}

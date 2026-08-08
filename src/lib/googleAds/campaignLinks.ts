import { supportedLocales, type LocaleCode } from "@/lib/i18nConfig";
import { localizedPath, siteUrl } from "@/lib/seo";

export const googleAdsDestinationDefinitions = [
  { key: "stage1", label: "Stage 1 file service", path: "/services/stage-1" },
  { key: "file_service", label: "ECU / TCU file service", path: "/file-service" },
  { key: "how_it_works", label: "How the workflow works", path: "/how-it-works" },
] as const;

export type GoogleAdsDestinationKey = (typeof googleAdsDestinationDefinitions)[number]["key"];

export type GoogleAdsLanguageDestination = {
  locale: LocaleCode;
  language: string;
  paths: Record<GoogleAdsDestinationKey, string>;
};

const campaignTokenPattern = /^[a-z0-9][a-z0-9_-]{2,63}$/;

export const googleAdsLanguageDestinations: GoogleAdsLanguageDestination[] = supportedLocales.map(
  ({ code, name }) => ({
    locale: code,
    language: name,
    paths: Object.fromEntries(
      googleAdsDestinationDefinitions.map((destination) => [
        destination.key,
        localizedPath(code, destination.path),
      ])
    ) as Record<GoogleAdsDestinationKey, string>,
  })
);

function cleanCampaignToken(value: string) {
  const token = value.trim().toLowerCase();
  return campaignTokenPattern.test(token) ? token : null;
}

export function buildGoogleAdsCampaignUrl(input: {
  locale: LocaleCode;
  destination: GoogleAdsDestinationKey;
  campaign: string;
  creative?: string | null;
}) {
  const campaign = cleanCampaignToken(input.campaign);
  if (!campaign) return null;

  const language = googleAdsLanguageDestinations.find((item) => item.locale === input.locale);
  const path = language?.paths[input.destination];
  if (!path) return null;

  const url = new URL(path, siteUrl);
  url.searchParams.set("utm_source", "google");
  url.searchParams.set("utm_medium", "cpc");
  url.searchParams.set("utm_campaign", campaign);

  if (input.creative?.trim()) {
    const creative = cleanCampaignToken(input.creative);
    if (!creative) return null;
    url.searchParams.set("utm_content", creative);
  }

  return url.toString();
}

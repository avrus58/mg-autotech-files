const googleAdsCampaignNamespaces = [
  "file_service",
  "stage1",
  "stage2",
  "tcu",
  "ecu_file_check",
  "ecu_platforms",
  "how_it_works",
] as const;

const marketOrLanguageSegment = /^[a-z]{2}$/;

/**
 * Keep first-party campaign attribution inside the business-owned naming
 * scheme. The suffix is deliberately limited to two-letter market/language
 * segments (for example `file_service_uk_ie_en`) so arbitrary names, account
 * references and other query-string values cannot become persisted labels.
 */
export function normalizeGoogleAdsCampaignToken(
  value: string | null | undefined
) {
  if (!value) return null;
  const token = value.trim().toLowerCase();
  if (token.length < 3 || token.length > 64) return null;

  for (const namespace of googleAdsCampaignNamespaces) {
    const prefix = `${namespace}_`;
    if (!token.startsWith(prefix)) continue;
    const suffixSegments = token.slice(prefix.length).split("_");
    return suffixSegments.length > 0 &&
      suffixSegments.length <= 4 &&
      suffixSegments.every((segment) => marketOrLanguageSegment.test(segment))
      ? token
      : null;
  }

  return null;
}

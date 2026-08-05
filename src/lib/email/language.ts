import type { TransactionalEmailLanguage } from "@/lib/email/types";
import { supportedLocales } from "@/lib/i18nConfig";

export const defaultTransactionalEmailLanguage: TransactionalEmailLanguage = "en";

export const supportedTransactionalEmailLanguages = supportedLocales.map(
  ({ code }) => code
) as TransactionalEmailLanguage[];

const supportedLanguages = new Set<TransactionalEmailLanguage>(
  supportedTransactionalEmailLanguages
);

function normalizeCandidate(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase().split(",")[0]?.split(/[-_]/)[0];
  return normalized && supportedLanguages.has(normalized as TransactionalEmailLanguage)
    ? (normalized as TransactionalEmailLanguage)
    : null;
}

export function normalizeTransactionalEmailLanguage(
  ...candidates: unknown[]
): TransactionalEmailLanguage {
  for (const candidate of candidates) {
    const normalized = normalizeCandidate(candidate);
    if (normalized) return normalized;
  }
  return defaultTransactionalEmailLanguage;
}

export function resolveTransactionalEmailLanguageFromMetadata(
  metadata: unknown
): TransactionalEmailLanguage {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return defaultTransactionalEmailLanguage;
  }

  const record = metadata as Record<string, unknown>;
  return normalizeTransactionalEmailLanguage(
    record.email_language,
    record.preferred_language,
    record.locale,
    record.language
  );
}

export function resolveTransactionalEmailLanguageFromCookie(
  cookieHeader: string | null | undefined
): TransactionalEmailLanguage {
  if (!cookieHeader) return defaultTransactionalEmailLanguage;

  const locale = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("mg_locale="))
    ?.slice("mg_locale=".length);

  try {
    return normalizeTransactionalEmailLanguage(locale ? decodeURIComponent(locale) : null);
  } catch {
    return defaultTransactionalEmailLanguage;
  }
}

export function resolveBrowserTransactionalEmailLanguage(input: {
  storedLocale?: string | null;
  cookieHeader?: string | null;
  browserLocale?: string | null;
}) {
  const cookieLanguage = input.cookieHeader && /(?:^|;\s*)mg_locale=/.test(input.cookieHeader)
    ? resolveTransactionalEmailLanguageFromCookie(input.cookieHeader)
    : null;

  return normalizeTransactionalEmailLanguage(
    input.storedLocale,
    cookieLanguage,
    input.browserLocale
  );
}

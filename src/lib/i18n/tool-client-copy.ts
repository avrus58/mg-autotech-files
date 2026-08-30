import type { LocaleCode } from "@/lib/i18nConfig";
import { publicToolsTranslations } from "@/lib/i18n/public-tools-translations";
import { publicSurfaceExactT } from "@/lib/i18n/public-surface-types";
import {
  ecuReadAdvisorCopyKeys,
  fileReadinessCopyKeys,
  performanceCalculatorCopyKeys,
  publicLogSnapshotCopyKeys,
  requestBriefCopyKeys,
  type EcuReadAdvisorCopy,
  type FileReadinessCopy,
  type PerformanceCalculatorCopy,
  type PublicLogSnapshotCopy,
  type RequestBriefCopy,
} from "@/lib/i18n/tool-client-copy-keys";

function buildToolCopy<const Key extends string>(
  locale: LocaleCode,
  keys: readonly Key[]
) {
  return Object.fromEntries(
    keys.map((source) => [
      source,
      publicSurfaceExactT(locale, source, publicToolsTranslations),
    ])
  ) as Record<Key, string>;
}

export function buildFileReadinessCopy(locale: LocaleCode): FileReadinessCopy {
  return buildToolCopy(locale, fileReadinessCopyKeys);
}

export function buildEcuReadAdvisorCopy(locale: LocaleCode): EcuReadAdvisorCopy {
  return buildToolCopy(locale, ecuReadAdvisorCopyKeys);
}

export function buildPerformanceCalculatorCopy(
  locale: LocaleCode
): PerformanceCalculatorCopy {
  return buildToolCopy(locale, performanceCalculatorCopyKeys);
}

export function buildRequestBriefCopy(locale: LocaleCode): RequestBriefCopy {
  return buildToolCopy(locale, requestBriefCopyKeys);
}

export function buildPublicLogSnapshotCopy(
  locale: LocaleCode
): PublicLogSnapshotCopy {
  return buildToolCopy(locale, publicLogSnapshotCopyKeys);
}

import { logStudioAnalysisErrorT as logStudioT } from "../../../src/lib/i18n/log-analysis-studio-translations";
import type { LocaleCode } from "../../../src/lib/i18nConfig";

export function wrongImportedExport(locale: LocaleCode) {
  return { title: logStudioT(locale, "studioTitle") };
}

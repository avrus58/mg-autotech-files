import { HomepageExperience } from "@/components/homepage/HomepageExperience";
import { buildHomepageTranslationCatalog } from "@/lib/homepageTranslationCatalog";
import { buildPublicLogSnapshotCopy } from "@/lib/i18n/tool-client-copy";
import type { LocaleCode } from "@/lib/i18nConfig";

export function renderRootHomepage(locale: LocaleCode) {
  return (
    <HomepageExperience
      locale={locale}
      publicLogSnapshotCopy={buildPublicLogSnapshotCopy(locale)}
      translationCatalog={buildHomepageTranslationCatalog(locale)}
    />
  );
}

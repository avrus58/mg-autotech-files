import { HomepageExperience } from "@/components/homepage/HomepageExperience";
import { ServerLocaleBoundary } from "@/components/ServerLocaleBoundary";
import { buildHomepageTranslationCatalog } from "@/lib/homepageTranslationCatalog";
import { buildPublicLogSnapshotCopy } from "@/lib/i18n/tool-client-copy";
import type { LocaleCode } from "@/lib/i18nConfig";
import { buildSiteIdentityJsonLd } from "@/lib/seo";

export function renderRootHomepage(locale: LocaleCode) {
  return (
    <ServerLocaleBoundary locale={locale}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildSiteIdentityJsonLd(locale)),
        }}
      />
      <HomepageExperience
        locale={locale}
        publicLogSnapshotCopy={buildPublicLogSnapshotCopy(locale)}
        translationCatalog={buildHomepageTranslationCatalog(locale)}
      />
    </ServerLocaleBoundary>
  );
}

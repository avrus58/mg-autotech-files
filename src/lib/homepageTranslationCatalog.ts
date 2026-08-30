import { getFileServiceCopy } from "@/lib/fileServiceI18n";
import { homepageExperienceExactTranslations } from "@/lib/homepageExperienceTranslations";
import { homepageHeroCopy } from "@/lib/homepageHeroI18n";
import type { HomepageTranslationCatalog } from "@/lib/homepageLocalization";
import { seoUiCopy } from "@/lib/seo-ui";
import { homeSeo } from "@/lib/seo";
import type { LocaleCode } from "@/lib/i18nConfig";

const homepageHeroIntroSource =
  "Upload original ECU/TCU files, select your service, track your order and download the completed file directly through the secure MG AutoTech customer portal.";

/**
 * Builds the exact catalog serialized into the homepage Flight payload.
 *
 * Keep this deliberately scoped. The global public/customer dictionaries are
 * server resources and must never be passed wholesale through a client
 * component just to translate this page.
 */
export function buildHomepageTranslationCatalog(
  locale: LocaleCode,
): HomepageTranslationCatalog | undefined {
  if (locale === "en") return undefined;

  const fileServiceCopy = getFileServiceCopy(locale);
  const heroCopy = homepageHeroCopy[locale];
  const uiCopy = seoUiCopy[locale];

  return {
    exact: {
      ...homepageExperienceExactTranslations[locale],
      [homepageHeroIntroSource]: homeSeo[locale].intro,
      "Custom ECU & TCU": heroCopy.customTitle,
      "Tuning Files": heroCopy.tuningFiles,
      "Secure Portal": heroCopy.securePortal,
      "Fast Handling": heroCopy.fastHandling,
      "Workshop Ready": heroCopy.workshopReady,
      "File Service": fileServiceCopy.nav.fileService,
      Online: uiCopy.online,
      Platform: uiCopy.platform,
      Legal: uiCopy.legal,
      Contact: uiCopy.contact,
      "Secure customer dashboard and private file workflow.":
        uiCopy.secureAccount,
      "Ready to upload a file?": uiCopy.readyTitle,
      "All rights reserved.": uiCopy.rights,
      "© 2026 MG AutoTech. All rights reserved.":
        `© 2026 MG AutoTech. ${uiCopy.rights}`,
    },
    terms: {},
  };
}

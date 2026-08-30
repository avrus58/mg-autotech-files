import { gzipSync } from "node:zlib";
import { buildHomepageTranslationCatalog } from "../src/lib/homepageTranslationCatalog";
import { supportedLocales } from "../src/lib/i18nConfig";

const maximumRawBytes = 28 * 1024;
const maximumGzipBytes = 12 * 1024;

const rows = supportedLocales
  .filter(({ code }) => code !== "en")
  .map(({ code: locale }) => {
    const catalog = buildHomepageTranslationCatalog(locale);
    if (!catalog) {
      throw new Error(`Localized homepage catalog is missing for ${locale}.`);
    }

    const serialized = Buffer.from(JSON.stringify(catalog), "utf8");
    return {
      locale,
      rawBytes: serialized.byteLength,
      gzipBytes: gzipSync(serialized).byteLength,
    };
  });

console.log(
  JSON.stringify(
    {
      route: "/[locale]",
      payload: "serialized HomepageExperience localization Flight prop",
      budgetRawKb: maximumRawBytes / 1024,
      budgetGzipKb: maximumGzipBytes / 1024,
      locales: rows.map((row) => ({
        locale: row.locale,
        rawKb: Number((row.rawBytes / 1024).toFixed(1)),
        gzipKb: Number((row.gzipBytes / 1024).toFixed(1)),
      })),
    },
    null,
    2,
  ),
);

const oversized = rows.filter(
  (row) => row.rawBytes > maximumRawBytes || row.gzipBytes > maximumGzipBytes,
);

if (oversized.length > 0) {
  throw new Error(
    `Localized homepage Flight catalog exceeded its payload budget: ${oversized
      .map(
        (row) =>
          `${row.locale} (${(row.rawBytes / 1024).toFixed(1)} KiB raw / ${(row.gzipBytes / 1024).toFixed(1)} KiB gzip)`,
      )
      .join(", ")}`,
  );
}

import sitemap from "../src/app/sitemap";
import {
  canonicalIndexingUrls,
  indexNowKeyPath,
  submitIndexNowUrls,
} from "../src/lib/searchEngineIndexing";
import { siteUrl } from "../src/lib/seo";

async function main() {
  const submit = process.argv.includes("--submit");
  const urls = canonicalIndexingUrls(sitemap());

  if (!urls.length) {
    throw new Error("The public sitemap did not produce any canonical URLs.");
  }

  if (!submit) {
    console.log(JSON.stringify({
      mode: "dry_run",
      host: new URL(siteUrl).hostname,
      keyLocation: `${siteUrl}${indexNowKeyPath}`,
      publicUrlCount: urls.length,
      privateUrlsIncluded: false,
    }, null, 2));
    return;
  }

  const result = await submitIndexNowUrls({ urls });
  console.log(JSON.stringify({
    mode: "submitted",
    ...result,
  }, null, 2));
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "IndexNow submission failed.");
  process.exitCode = 1;
});

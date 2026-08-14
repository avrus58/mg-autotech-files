import type { Metadata } from "next";
import { siteUrl } from "@/lib/seo";

export const indexNowKey = "53478ab4be7faddc91a14935b2b35013051e4dfc9bb31c4a";
export const indexNowKeyPath = `/${indexNowKey}.txt`;
export const indexNowEndpoint = "https://api.indexnow.org/indexnow";

const blockedPublicPathPrefixes = [
  "/admin",
  "/api",
  "/auth",
  "/dashboard",
  "/embed",
  "/forgot-password",
  "/login",
  "/new-request",
  "/payment",
  "/register",
  "/reset-password",
] as const;

type VerificationEnvironment = Readonly<Record<string, string | undefined>>;

export type SearchEngineVerificationReadiness = {
  bing: boolean;
  yandex: boolean;
  baidu: boolean;
  naver: boolean;
};

export type IndexNowSubmissionResult = {
  submittedUrlCount: number;
  batchCount: number;
  responseStatuses: number[];
};

function verificationToken(value: string | undefined) {
  const normalized = value?.trim() ?? "";
  return /^[a-zA-Z0-9._-]{6,160}$/.test(normalized) ? normalized : null;
}

export function getSearchEngineVerificationReadiness(
  environment: VerificationEnvironment = process.env
): SearchEngineVerificationReadiness {
  return {
    bing: Boolean(verificationToken(environment.BING_SITE_VERIFICATION)),
    yandex: Boolean(verificationToken(environment.YANDEX_SITE_VERIFICATION)),
    baidu: Boolean(verificationToken(environment.BAIDU_SITE_VERIFICATION)),
    naver: Boolean(verificationToken(environment.NAVER_SITE_VERIFICATION)),
  };
}

export function buildSearchEngineVerification(
  environment: VerificationEnvironment = process.env
): Metadata["verification"] {
  const bing = verificationToken(environment.BING_SITE_VERIFICATION);
  const yandex = verificationToken(environment.YANDEX_SITE_VERIFICATION);
  const baidu = verificationToken(environment.BAIDU_SITE_VERIFICATION);
  const naver = verificationToken(environment.NAVER_SITE_VERIFICATION);
  const other: Record<string, string> = {};

  if (bing) other["msvalidate.01"] = bing;
  if (baidu) other["baidu-site-verification"] = baidu;
  if (naver) other["naver-site-verification"] = naver;

  if (!yandex && Object.keys(other).length === 0) return undefined;

  return {
    ...(yandex ? { yandex } : {}),
    ...(Object.keys(other).length ? { other } : {}),
  };
}

export function isPublicIndexableUrl(value: string) {
  try {
    const expectedSite = new URL(siteUrl);
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.hostname !== expectedSite.hostname ||
      url.port ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      return false;
    }

    return !blockedPublicPathPrefixes.some(
      (prefix) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`)
    );
  } catch {
    return false;
  }
}

export function canonicalIndexingUrls(entries: ReadonlyArray<{ url: string }>) {
  const urls = entries
    .map((entry) => entry.url)
    .filter(isPublicIndexableUrl)
    .map((url) => new URL(url).toString());

  return [...new Set(urls)].sort((left, right) => left.localeCompare(right));
}

export function buildIndexNowPayload(urls: readonly string[]) {
  const safeUrls = canonicalIndexingUrls(urls.map((url) => ({ url })));
  if (!safeUrls.length) throw new Error("No public canonical URLs are available for IndexNow.");
  if (safeUrls.length > 10_000) throw new Error("IndexNow accepts at most 10,000 URLs per request.");

  const host = new URL(siteUrl).hostname;
  return {
    host,
    key: indexNowKey,
    keyLocation: `${siteUrl}${indexNowKeyPath}`,
    urlList: safeUrls,
  };
}

export function splitIndexNowBatches(urls: readonly string[], batchSize = 10_000) {
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 10_000) {
    throw new Error("IndexNow batch size must be between 1 and 10,000.");
  }

  const safeUrls = canonicalIndexingUrls(urls.map((url) => ({ url })));
  const batches: string[][] = [];
  for (let index = 0; index < safeUrls.length; index += batchSize) {
    batches.push(safeUrls.slice(index, index + batchSize));
  }
  return batches;
}

export async function submitIndexNowUrls(input: {
  urls: readonly string[];
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<IndexNowSubmissionResult> {
  const batches = splitIndexNowBatches(input.urls);
  if (!batches.length) throw new Error("No public canonical URLs are available for IndexNow.");

  const responseStatuses: number[] = [];
  for (const batch of batches) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), input.timeoutMs ?? 8_000);
    try {
      const response = await (input.fetchImpl ?? fetch)(indexNowEndpoint, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify(buildIndexNowPayload(batch)),
        cache: "no-store",
        redirect: "error",
        signal: controller.signal,
      });
      responseStatuses.push(response.status);
      if (response.status !== 200 && response.status !== 202) {
        throw new Error(`IndexNow rejected the notification with HTTP ${response.status}.`);
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    submittedUrlCount: batches.reduce((total, batch) => total + batch.length, 0),
    batchCount: batches.length,
    responseStatuses,
  };
}

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  buildGoogleAdsCampaignUrl,
  googleAdsDestinationDefinitions,
  googleAdsDestinationSupportsLocale,
  googleAdsLanguageDestinations,
} from "../src/lib/googleAds/campaignLinks";
import { supportedLocales } from "../src/lib/i18nConfig";
import { publicServiceSlugs } from "../src/lib/seo";
import { serviceIntentGuideSlugs } from "../src/lib/serviceIntentGuides";
import {
  buildNewRequestPath,
  getPublicServiceRequestIntent,
  getRequestIntentSelection,
  parseRequestIntent,
  type RequestIntent,
} from "../src/lib/requestIntent";
import { createRequestCompletionConsentHandoff } from "../src/lib/requestCompletionConsent";
import type { MeasurementConsentSnapshot } from "../src/lib/publicAnalytics";

function projectFile(...segments: string[]) {
  return readFileSync(resolve(process.cwd(), ...segments), "utf8");
}

test("allowlisted public service intents resolve only to existing request services", () => {
  const expected: Record<
    string,
    { intent: RequestIntent; main: string; extras: readonly string[] }
  > = {
    "stage-1": { intent: "stage_1", main: "stage_1", extras: [] },
    "stage-2": { intent: "stage_2", main: "stage_2", extras: [] },
    "stage-3": { intent: "stage_3", main: "stage_3", extras: [] },
    "tcu-tuning": { intent: "tcu_stage_1", main: "tcu_stage_1", extras: [] },
    "ecu-file-check": { intent: "file_check", main: "only_options", extras: ["file_check"] },
    "dpf-off": { intent: "dpf_off", main: "only_options", extras: ["dpf_off"] },
    "egr-off": { intent: "egr_off", main: "only_options", extras: ["egr_off"] },
    "adblue-off": { intent: "adblue_off", main: "only_options", extras: ["adblue_off"] },
    "dtc-off": { intent: "dtc_off", main: "only_options", extras: ["dtc_off"] },
  };

  for (const [slug, expectation] of Object.entries(expected)) {
    const intent = getPublicServiceRequestIntent(slug);
    assert.equal(intent, expectation.intent);
    assert.equal(buildNewRequestPath(intent), `/new-request?intent=${expectation.intent}`);
    const selection = getRequestIntentSelection(expectation.intent);
    assert.equal(selection.mainServiceId, expectation.main);
    assert.deepEqual(selection.extraServiceIds, expectation.extras);
  }

  assert.equal(getRequestIntentSelection("tcu_stage_1").mainServiceId, "tcu_stage_1");
  assert.equal(parseRequestIntent("tcu_stage_1"), "tcu_stage_1");
  assert.equal(parseRequestIntent("stage_3"), "stage_3");
  assert.equal(parseRequestIntent("../../dashboard/credits"), null);
  assert.equal(getPublicServiceRequestIntent("unknown-service"), null);
  assert.equal(buildNewRequestPath(null), "/new-request");
});

test("Google Ads exposes the real TCU landing only for its English page", () => {
  const url = buildGoogleAdsCampaignUrl({
    locale: "en",
    destination: "tcu",
    campaign: "tcu_uk_ie",
  });

  assert.ok(url);
  const parsed = new URL(url);
  assert.equal(parsed.pathname, "/services/tcu-tuning");
  assert.equal(parsed.searchParams.get("utm_source"), "google");
  assert.equal(parsed.searchParams.get("utm_medium"), "cpc");
  assert.equal(parsed.searchParams.get("utm_campaign"), "tcu_uk_ie");
  assert.equal(parsed.searchParams.has("utm_content"), false);
  assert.equal(googleAdsDestinationSupportsLocale("tcu", "en"), true);
  assert.equal(googleAdsDestinationSupportsLocale("tcu", "de"), false);
  assert.equal(
    googleAdsLanguageDestinations.find((item) => item.locale === "de")?.paths.tcu,
    undefined
  );
  assert.equal(
    buildGoogleAdsCampaignUrl({
      locale: "de",
      destination: "tcu",
      campaign: "tcu_de",
    }),
    null
  );
});

test("every Google Ads language destination resolves to an existing route contract", () => {
  const localizedStaticPaths = new Set(["/file-service", "/how-it-works"]);
  const localizedServicePaths = new Set(
    publicServiceSlugs.map((slug) => `/services/${slug}`)
  );
  const canonicalPaths = new Set([
    "/ecu-platforms",
    ...localizedStaticPaths,
    ...localizedServicePaths,
    ...serviceIntentGuideSlugs.map((slug) => `/services/${slug}`),
  ]);
  const localeCodes = new Set(supportedLocales.map(({ code }) => code));

  assert.equal(googleAdsLanguageDestinations.length, supportedLocales.length);

  for (const language of googleAdsLanguageDestinations) {
    assert.equal(localeCodes.has(language.locale), true, language.locale);

    for (const destination of googleAdsDestinationDefinitions) {
      const path = language.paths[destination.key];
      const explicitlySupportedLocale =
        !("locale" in destination) || destination.locale === language.locale;

      if (!explicitlySupportedLocale) {
        assert.equal(path, undefined, `${language.locale}:${destination.key}`);
        assert.equal(
          googleAdsDestinationSupportsLocale(
            destination.key,
            language.locale
          ),
          false,
          `${language.locale}:${destination.key}`
        );
        assert.equal(
          buildGoogleAdsCampaignUrl({
            locale: language.locale,
            destination: destination.key,
            campaign: `${destination.key}_uk`,
          }),
          null,
          `${language.locale}:${destination.key}`
        );
        continue;
      }

      assert.ok(path, `${language.locale}:${destination.key}`);
      assert.equal(
        googleAdsDestinationSupportsLocale(
          destination.key,
          language.locale
        ),
        true,
        `${language.locale}:${destination.key}`
      );
      const localePrefix =
        language.locale === "en" ? "" : `/${language.locale}`;
      const localizedSuffix =
        localePrefix && path.startsWith(`${localePrefix}/`)
          ? path.slice(localePrefix.length)
          : null;

      if (localizedSuffix !== null) {
        assert.equal(
          localizedStaticPaths.has(localizedSuffix) ||
            localizedServicePaths.has(localizedSuffix),
          true,
          `${language.locale}:${destination.key}:${path}`
        );
      } else {
        assert.equal(
          canonicalPaths.has(path),
          true,
          `${language.locale}:${destination.key}:${path}`
        );
      }

      const campaign = `${destination.key}_uk`;
      const url = buildGoogleAdsCampaignUrl({
        locale: language.locale,
        destination: destination.key,
        campaign,
      });
      assert.ok(url, `${language.locale}:${destination.key}`);
      const parsed = new URL(url);
      assert.equal(parsed.pathname, path);
      assert.equal(parsed.searchParams.get("utm_source"), "google");
      assert.equal(parsed.searchParams.get("utm_medium"), "cpc");
      assert.equal(parsed.searchParams.get("utm_campaign"), campaign);
    }

    assert.equal(
      language.paths.stage2,
      language.locale === "en" ? "/services/stage-2" : undefined
    );
    assert.equal(
      language.paths.ecu_file_check,
      language.locale === "en" ? "/services/ecu-file-check" : undefined
    );
    assert.equal(
      language.paths.stage1,
      language.locale === "en"
        ? "/services/stage-1"
        : `/${language.locale}/services/stage-1`
    );
  }
});

test("the broad ECU/TCU landing offers direct request entry without removing service choice", () => {
  const page = projectFile("src", "app", "file-service", "page.tsx");
  const localizedPage = projectFile("src", "app", "[locale]", "file-service", "page.tsx");

  assert.match(page, /id="request-route"/);
  assert.match(page, /href="\/new-request"[\s\S]*data-acquisition-primary-cta/);
  assert.match(page, /href="#request-route"[\s\S]*Choose service first/);
  assert.match(page, /title: "Custom ECU Calibration"[\s\S]*href: "\/services"/);
  assert.match(localizedPage, /id="request-route"/);
  assert.match(localizedPage, /href="#request-route"/);
  assert.doesNotMatch(localizedPage, /href="\/new-request"/);
});

test("private request start is first-party only and tied to the first form interaction", () => {
  const page = projectFile("src", "app", "new-request", "page.tsx");
  const analytics = projectFile("src", "lib", "publicAnalytics.ts");

  assert.match(
    page,
    /const markRequestStarted = \(\) => \{[\s\S]*if \(requestStartTrackedRef\.current\) return;[\s\S]*requestStartTrackedRef\.current = true[\s\S]*window\.crypto\.randomUUID\(\)[\s\S]*growthStartDelivery\.begin\([\s\S]*growthExpectedUserIdRef\.current/
  );
  assert.match(
    page,
    /const retryStartedJourneyAfterConsent = \(\) => \{[\s\S]*growthStartDelivery\.begin\([\s\S]*growthExpectedUserIdRef\.current[\s\S]*window\.addEventListener\([\s\S]*measurementConsentChangedEvent[\s\S]*retryStartedJourneyAfterConsent/
  );
  assert.match(page, /onChangeCapture=\{markRequestStarted\}/);
  assert.match(page, /onClick=\{\(\) => \{[\s\S]*markRequestStarted\(\);[\s\S]*setMainService\(service\.id\)/);
  assert.match(page, /const toggleExtra = \(id: string\) => \{\s*markRequestStarted\(\)/);
  assert.doesNotMatch(
    page,
    /trackRequestStarted|requestStartAnalyticsRecordedRef/
  );
  assert.doesNotMatch(analytics, /export function trackRequestStarted/);
  assert.doesNotMatch(page, /const meaningfulStart = Boolean/);
});

test("completed request waits for a consent choice, flushes a grant once, then navigates", async () => {
  let snapshot: MeasurementConsentSnapshot = {
    preferences: {
      analytics: false,
      advertising: false,
      version: "consent-mode-v2",
      updatedAt: new Date(0).toISOString(),
    },
    source: "none",
    needsDecision: true,
  };
  let flushes = 0;
  let firstPartyFlushes = 0;
  let navigations = 0;
  const continueAfterConsent = createRequestCompletionConsentHandoff({
    readConsent: () => snapshot,
    flushConsentedFirstParty: async () => {
      firstPartyFlushes += 1;
    },
    flushVerifiedConversions: async () => {
      flushes += 1;
    },
    navigate: () => {
      navigations += 1;
    },
    timeoutMs: 20,
  });

  assert.equal(await continueAfterConsent(false), false);
  assert.equal(flushes, 0);
  assert.equal(firstPartyFlushes, 0);
  assert.equal(navigations, 0);

  snapshot = {
    ...snapshot,
    preferences: { ...snapshot.preferences, analytics: true },
    source: "v2",
    needsDecision: false,
  };
  assert.equal(await continueAfterConsent(true), true);
  assert.equal(flushes, 1);
  assert.equal(firstPartyFlushes, 1);
  assert.equal(navigations, 1);
  assert.equal(await continueAfterConsent(true), false);
  assert.equal(flushes, 1);
  assert.equal(firstPartyFlushes, 1);
  assert.equal(navigations, 1);
});

test("Necessary-only continues without measurement and a hanging grant remains bounded", async () => {
  const necessarySnapshot: MeasurementConsentSnapshot = {
    preferences: {
      analytics: false,
      advertising: false,
      version: "consent-mode-v2",
      updatedAt: new Date().toISOString(),
    },
    source: "v2",
    needsDecision: false,
  };
  let necessaryFlushes = 0;
  let necessaryFirstPartyFlushes = 0;
  let necessaryNavigations = 0;
  const continueNecessary = createRequestCompletionConsentHandoff({
    readConsent: () => necessarySnapshot,
    flushConsentedFirstParty: async () => {
      necessaryFirstPartyFlushes += 1;
    },
    flushVerifiedConversions: async () => {
      necessaryFlushes += 1;
    },
    navigate: () => {
      necessaryNavigations += 1;
    },
  });

  assert.equal(await continueNecessary(true), true);
  assert.equal(necessaryFlushes, 0);
  assert.equal(necessaryFirstPartyFlushes, 0);
  assert.equal(necessaryNavigations, 1);

  let boundedNavigations = 0;
  const continueHangingGrant = createRequestCompletionConsentHandoff({
    readConsent: () => ({
      ...necessarySnapshot,
      preferences: { ...necessarySnapshot.preferences, advertising: true },
    }),
    flushVerifiedConversions: () => new Promise(() => undefined),
    navigate: () => {
      boundedNavigations += 1;
    },
    timeoutMs: 5,
  });
  assert.equal(await continueHangingGrant(true), true);
  assert.equal(boundedNavigations, 1);

  let failOpenNavigations = 0;
  const continueWithoutConsentUi = createRequestCompletionConsentHandoff({
    readConsent: () => ({
      ...necessarySnapshot,
      source: "none",
      needsDecision: true,
    }),
    flushVerifiedConversions: () => new Promise(() => undefined),
    navigate: () => {
      failOpenNavigations += 1;
    },
  });
  assert.equal(await continueWithoutConsentUi(false), false);
  assert.equal(failOpenNavigations, 0);
  assert.equal(await continueWithoutConsentUi(true), true);
  assert.equal(failOpenNavigations, 1);
  assert.equal(await continueWithoutConsentUi(true), false);
  assert.equal(failOpenNavigations, 1);
});

test("new request holds only when consent UI is available and always has a bounded escape", () => {
  const page = projectFile("src", "app", "new-request", "page.tsx");
  const completion = page.match(
    /requestSubmissionRef\.current = null;[\s\S]*?window\.location\.assign\("\/dashboard"\);/,
  )?.[0] ?? "";

  assert.match(completion, /const completionConsent = readMeasurementConsentSnapshot\(\)[\s\S]*?const consentChoiceAvailable = requestCompletionConsentIsAvailable\([\s\S]*?window\.location\.hostname/);
  assert.match(completion, /setAwaitingConsentAfterSuccess\(true\);\s*return;/);
  assert.match(page, /window\.addEventListener\(measurementConsentChangedEvent, handleConsentChoice\)/);
  assert.match(page, /flushVerifiedConversions: flushPendingVerifiedConversions/);
  assert.match(page, /isApprovedAnalyticsHost\(hostname\)[\s\S]*?NEXT_PUBLIC_GOOGLE_ANALYTICS_ID[\s\S]*?NEXT_PUBLIC_GOOGLE_ADS_ID/);
  assert.match(page, /requestCompletionConsentFailOpenMs = 15_000/);
  assert.match(page, /window\.setTimeout\(\(\) => \{\s*void continueAfterConsent\(true\)/);
  assert.match(page, /requestCompletionContinueRef\.current\(\);[\s\S]*?window\.location\.assign\("\/dashboard"\);[\s\S]*?Back to dashboard/);
  assert.match(page, /disabled=\{awaitingConsentAfterSuccess \|\| submitting/);
  assert.match(page, /pendingGrowthRequestCreatedRef = useRef/);
  assert.match(page, /!requestJourneyRecorded[\s\S]*completionConsent\.needsDecision[\s\S]*pendingGrowthRequestCreatedRef\.current = \{/);
  assert.match(page, /flushConsentedFirstParty: async \(\) => \{[\s\S]*recordGrowthRequestCreated\([\s\S]*pending\.orderId[\s\S]*pending\.attemptId/);
  assert.match(page, /navigate: \(\) => \{[\s\S]*pendingGrowthRequestCreatedRef\.current = null;[\s\S]*window\.location\.assign\("\/dashboard"\)/);
  assert.doesNotMatch(page, /localStorage[\s\S]{0,160}pendingGrowthRequestCreated/);
});

test("confirmed payment survives a late consent choice and crosses the completion bridge once", () => {
  const page = projectFile("src", "app", "payment", "success", "page.tsx");

  assert.match(
    page,
    /trackPurchaseCompleted\([\s\S]*?const completionConsent = readMeasurementConsentSnapshot\(\)[\s\S]*?paymentCompletionConsentIsAvailable\([\s\S]*?setAwaitingConsentAfterSuccess\(true\)/
  );
  assert.match(
    page,
    /createRequestCompletionConsentHandoff\(\{[\s\S]*?flushVerifiedConversions: flushPendingVerifiedConversions[\s\S]*?replaceWithPendingMeasurementCompletion\(destination\)/
  );
  assert.match(
    page,
    /window\.addEventListener\(measurementConsentChangedEvent, handleConsentChoice\)[\s\S]*?window\.removeEventListener\([\s\S]*?measurementConsentChangedEvent/
  );
  assert.match(page, /paymentCompletionConsentFailOpenMs = 15_000/);
  assert.match(
    page,
    /window\.setTimeout\(\(\) => \{\s*void continueAfterConsent\(true\)/
  );
  assert.match(
    page,
    /paymentCompletionDestinationRef\.current = destination[\s\S]*?paymentCompletionContinueRef\.current/
  );
  assert.match(page, /continueToPrivateDestination\(event, "\/dashboard"\)/);
  assert.match(
    page,
    /continueToPrivateDestination\(event, "\/dashboard\/credits"\)/
  );
  assert.doesNotMatch(
    page,
    /localStorage[\s\S]{0,160}paymentCompletionDestinationRef/
  );
});

test("insufficient-credit recovery preserves the form and upload copy matches validation", () => {
  const page = projectFile("src", "app", "new-request", "page.tsx");
  const refreshSource =
    page.match(/async function refreshCreditBalance\(\) \{[\s\S]*?\r?\n  \}\r?\n\r?\n  function validateCreditAccess/)?.[0] ?? "";

  assert.match(page, /href="\/dashboard\/credits"[\s\S]*target="_blank"[\s\S]*rel="noopener noreferrer"/);
  assert.match(page, /refreshing \? "Loading\.\.\." : "Refresh"/);
  assert.match(page, /className="mb-4 lg:hidden"/);
  assert.match(page, /className="mt-4 hidden lg:block"/);
  assert.match(refreshSource, /getLatestCustomerProfile\(user\.id\)/);
  assert.match(refreshSource, /setCustomerProfile\(latestProfile\)/);
  assert.doesNotMatch(refreshSource, /setSelectedFile|setNotes|setMainService|setSelectedExtras/);

  assert.match(
    page,
    /allowedRequestFileExtensions\.join\(", "\)[\s\S]*Max[\s\S]*32 MB/
  );
  assert.doesNotMatch(page, /Supported later:[\s\S]*diagnostic reports and screenshots/);
  assert.match(page, /accept="\.bin,\.ori,\.mod,\.frf,\.hex,\.zip,\.sgo"/);
  assert.match(page, /const maxRequestFileSize = 32 \* 1024 \* 1024/);
});

test("public CTA intent survives auth and prices stay on the localized public page", () => {
  const servicePage = projectFile("src", "app", "[locale]", "services", "[slug]", "page.tsx");
  const defaultServicePage = projectFile("src", "app", "services", "[slug]", "page.tsx");
  const serviceIntentPage = projectFile("src", "components", "ServiceIntentPage.tsx");
  const accessBoundary = projectFile(
    "src",
    "app",
    "new-request",
    "NewRequestAccessBoundary.tsx"
  );
  const requestPage = projectFile("src", "app", "new-request", "page.tsx");
  const platformPage = projectFile("src", "app", "ecu-platforms", "[slug]", "page.tsx");
  const adsClient = projectFile("src", "app", "admin", "ads-performance", "AdsPerformanceClient.tsx");

  assert.match(servicePage, /localizedPath\(locale, "\/#prices"\)/);
  assert.doesNotMatch(servicePage, /labels\.navPrices[\s\S]{0,180}dashboard\/credits/);
  assert.match(servicePage, /buildNewRequestPath\(getPublicServiceRequestIntent\(slug\)\)/);
  assert.match(defaultServicePage, /buildNewRequestPath\([\s\S]*?getPublicServiceRequestIntent\(service\.slug\)/);
  assert.match(defaultServicePage, /buildAuthEntryPath\("\/register", requestHref\)/);
  assert.equal((defaultServicePage.match(/href=\{requestHref\}/g) ?? []).length, 2);
  assert.equal((defaultServicePage.match(/href=\{registrationHref\}/g) ?? []).length, 1);
  assert.match(serviceIntentPage, /buildNewRequestPath\([\s\S]*?getPublicServiceRequestIntent\(guide\.slug\)/);
  assert.match(serviceIntentPage, /href=\{requestHref\}/);
  assert.match(accessBoundary, /parseRequestIntent\(searchParams\.get\("intent"\)\)/);
  assert.match(accessBoundary, /<BrowserAuthBoundary[\s\S]*nextPath=\{nextPath\}/);
  assert.match(accessBoundary, /<RegistrationCountryBoundary nextPath=\{nextPath\}>/);
  assert.match(requestPage, /const initialRequestIntent = parseRequestIntent\(searchParams\.get\("intent"\)\)/);
  assert.match(requestPage, /initialRequestSelection\?\.mainServiceId \?\? "stage_1"/);
  assert.match(requestPage, /initialRequestSelection \? \[\.\.\.initialRequestSelection\.extraServiceIds\] : \[\]/);
  assert.match(platformPage, /guide\.slug === "transmission-control-units"[\s\S]*buildNewRequestPath\("tcu_stage_1"\)/);
  assert.match(adsClient, /disabled=\{!googleAdsDestinationSupportsLocale\(item\.key, campaignLocale\)\}/);
});

test("every public service intent maps only to a real request-form service id", () => {
  const requestPage = projectFile("src", "app", "new-request", "page.tsx");
  for (const intent of [
    "stage_1",
    "stage_2",
    "stage_3",
    "tcu_stage_1",
    "dpf_off",
    "egr_off",
    "adblue_off",
    "dtc_off",
    "file_check",
  ] as RequestIntent[]) {
    const selection = getRequestIntentSelection(intent);
    assert.match(requestPage, new RegExp(`id: "${selection.mainServiceId}"`), intent);
    for (const extra of selection.extraServiceIds) {
      assert.match(requestPage, new RegExp(`id: "${extra}"`), `${intent}:${extra}`);
    }
  }
});

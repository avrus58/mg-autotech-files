import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function source(...segments: string[]) {
  return readFileSync(resolve(process.cwd(), ...segments), "utf8");
}

test("homepage keeps heavy public runtimes outside the initial client entry", () => {
  const homepage = source("src", "components", "homepage", "HomepageExperience.tsx");

  assert.doesNotMatch(homepage, /from "framer-motion"/);
  assert.doesNotMatch(homepage, /from "@\/lib\/supabaseClient"/);
  assert.match(homepage, /DeferredPerformanceTools/);
  assert.match(homepage, /import\("@\/components\/HomepageSessionBridge"\)/);
  assert.match(homepage, /import\("@\/components\/OnlineStatus"\)/);
  assert.match(homepage, /requestIdleCallback/);
  assert.doesNotMatch(
    homepage,
    /useState\(\(\) =>\s*getWorkloadSnapshot\(getGermanyNow\(\)\)\)/
  );
  assert.doesNotMatch(homepage, /WorkloadSnapshot|getWorkloadSnapshot|Average response/);
});

test("large translation catalogs are loaded only for runtime-translated routes", () => {
  const switcher = source("src", "components", "LanguageSwitcher.tsx");
  const config = source("src", "lib", "i18nConfig.ts");

  assert.match(switcher, /from "@\/lib\/i18nConfig"/);
  assert.match(switcher, /import\("@\/lib\/i18n"\)/);
  assert.doesNotMatch(
    switcher,
    /import \{[\s\S]*exactTranslations[\s\S]*\} from "@\/lib\/i18n"/
  );
  assert.match(switcher, /getPathLocale\(pathname\)/);
  assert.match(config, /export const supportedLocales/);
});

test("private notifications stay out of public pages and heavy tools remain deferred", () => {
  const layout = source("src", "app", "layout.tsx");
  const publicAnalyticsRuntime = source(
    "src",
    "components",
    "analytics",
    "PublicAnalyticsRuntime.tsx"
  );
  const notifications = source(
    "src",
    "components",
    "CustomerNotificationsRuntime.tsx"
  );
  const tools = source(
    "src",
    "components",
    "tools",
    "DeferredPerformanceTools.tsx"
  );
  const styles = source("src", "app", "globals.css");

  assert.match(layout, /CustomerNotificationsRuntime/);
  assert.match(layout, /PublicAnalyticsRuntime/);
  assert.doesNotMatch(
    layout,
    /from "@\/components\/analytics\/PublicAnalytics"/
  );
  assert.match(
    publicAnalyticsRuntime,
    /dynamic\([\s\S]*?import\("@\/components\/analytics\/PublicAnalytics"\)[\s\S]*?ssr: false/
  );
  assert.match(notifications, /isCustomerNotificationRuntimePath/);
  assert.doesNotMatch(
    notifications,
    /requestIdleCallback|setTimeout|useEffect|useState/
  );
  assert.match(tools, /IntersectionObserver/);
  assert.match(tools, /PublicLogSnapshot/);
  assert.doesNotMatch(
    tools,
    /import\("@\/components\/tools\/PerformanceTools"\)/
  );
  assert.match(styles, /\.homepage-deferred-section\s*{[\s\S]*?content-visibility: visible/);
  assert.doesNotMatch(styles, /contain-intrinsic-size:\s*auto\s+(?:760|980)px/);
});

test("a build-time homepage JavaScript budget guards future regressions", () => {
  const script = source("scripts", "check-web-performance.mjs");
  const localizedPayloadScript = source(
    "scripts",
    "check-homepage-localization-payload.ts",
  );
  const packageJson = JSON.parse(source("package.json")) as {
    scripts?: Record<string, string>;
  };

  assert.equal(
    packageJson.scripts?.["check:performance"],
    "node scripts/check-web-performance.mjs && tsx scripts/check-homepage-localization-payload.ts && node scripts/check-prerender-coverage.mjs",
  );
  assert.match(script, /80 \* 1024/);
  assert.match(script, /supabase-js/);
  assert.match(script, /motionValue/);
  assert.match(script, /panelV2Translations/);
  assert.match(script, /forbiddenPublicSnapshotDependencies/);
  assert.match(script, /@\/lib\/logAnalysisStudio/);
  assert.match(script, /@\/lib\/performanceReport/);
  assert.match(script, /mg-public-datalog-snapshot/);
  assert.match(script, /log-analysis-studio-v1/);
  assert.match(script, /forbiddenPublicSnapshotRuntime/);
  assert.match(script, /publicSnapshotWorkerMaximumRawBytes = 12 \* 1024/);
  assert.match(script, /oversizedPublicWorkers/);
  assert.match(script, /globalThis\.__RSC_MANIFEST\["\/page"\]/);
  assert.match(script, /clientModules/);
  assert.match(script, /static\\\/chunks\\\/app\\\/layout-/);
  assert.match(localizedPayloadScript, /buildHomepageTranslationCatalog/);
  assert.match(localizedPayloadScript, /serialized HomepageExperience localization Flight prop/);
  assert.match(localizedPayloadScript, /maximumRawBytes = 28 \* 1024/);
  assert.match(localizedPayloadScript, /maximumGzipBytes = 12 \* 1024/);
  assert.match(localizedPayloadScript, /gzipSync/);
});

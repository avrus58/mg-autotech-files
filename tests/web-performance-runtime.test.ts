import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function source(...segments: string[]) {
  return readFileSync(resolve(process.cwd(), ...segments), "utf8");
}

test("homepage keeps heavy public runtimes outside the initial client entry", () => {
  const homepage = source("src", "app", "page.tsx");

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
  assert.match(homepage, /useState<WorkloadSnapshot>\(\s*initialWorkloadSnapshot/);
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

test("notifications and heavy tools are deferred without destabilizing homepage layout", () => {
  const layout = source("src", "app", "layout.tsx");
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
  assert.match(notifications, /isCustomerWorkspace/);
  assert.match(notifications, /requestIdleCallback/);
  assert.match(tools, /IntersectionObserver/);
  assert.match(tools, /PerformanceTools/);
  assert.match(styles, /\.homepage-deferred-section\s*{[\s\S]*?content-visibility: visible/);
  assert.doesNotMatch(styles, /contain-intrinsic-size:\s*auto\s+(?:760|980)px/);
});

test("a build-time homepage JavaScript budget guards future regressions", () => {
  const script = source("scripts", "check-web-performance.mjs");
  const packageJson = JSON.parse(source("package.json")) as {
    scripts?: Record<string, string>;
  };

  assert.equal(
    packageJson.scripts?.["check:performance"],
    "node scripts/check-web-performance.mjs"
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
});

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import {
  buildDesktopServiceSummary,
  calculateDesktopRequestCredits,
  customerSafeDesktopOrderSelect,
  desktopUploadSessionIdFor,
  isValidSha256,
  normalizeDesktopIdempotencyKey,
  validateDesktopCreditAccess,
  validateDesktopUploadFile,
} from "../src/lib/desktopUpload/contracts";
import { compareDesktopVersions } from "../src/lib/desktopUpload/appCheck";
import {
  createIdempotencyKey,
  safeUploadPayload,
  sha256ArrayBuffer,
  validateUploadFile,
} from "../apps/customer-uploader/src/validation";
import { desktopModules, resolveEnabledModules } from "../apps/customer-uploader/src/modules/registry";

type DesktopEnvChecker = {
  main(options?: {
    argv?: string[];
    envFilePaths?: string[];
    fsModule?: {
      existsSync(path: string): boolean;
      readFileSync(path: string, encoding: BufferEncoding): string;
    };
    processEnv?: Record<string, string | undefined>;
    log?(message?: string): void;
    error?(message?: string): void;
  }): number;
};

async function loadDesktopEnvChecker() {
  return (await import(pathToFileURL(resolve(process.cwd(), "apps/customer-uploader/scripts/check-env.mjs")).href)) as DesktopEnvChecker;
}

test("desktop upload file validation accepts safe ECU files and rejects unsafe files", () => {
  assert.deepEqual(validateDesktopUploadFile({ fileName: "BMW_EDC17_ORI.bin", fileSize: 1024 }), { ok: true });
  assert.equal(validateDesktopUploadFile({ fileName: "notes.txt", fileSize: 1024 }).ok, false);
  assert.equal(validateDesktopUploadFile({ fileName: "empty.bin", fileSize: 0 }).ok, false);
  assert.equal(validateDesktopUploadFile({ fileName: "large.bin", fileSize: 33 * 1024 * 1024 }).ok, false);

  assert.deepEqual(validateUploadFile({ name: "Mercedes_MEVD_ORI.mod", size: 2048 } as File), { ok: true });
  assert.equal(validateUploadFile({ name: "tool.exe", size: 2048 } as File).ok, false);
});

test("desktop SHA-256 helper calculates deterministic local fingerprint", async () => {
  const input = new TextEncoder().encode("mg-autotech-upload-assistant").buffer;
  const expected = createHash("sha256").update(Buffer.from(input)).digest("hex");
  assert.equal(await sha256ArrayBuffer(input), expected);
});

test("desktop idempotency and safe payload helpers avoid unsafe request data", () => {
  const generated = createIdempotencyKey();
  assert.match(generated, /^desktop-/);
  assert.match(generated, /^[a-zA-Z0-9._-]+$/);
  assert.equal(normalizeDesktopIdempotencyKey(" desktop abc/../bad "), "desktopabc..bad");
  assert.equal(desktopUploadSessionIdFor(" desktop abc/../bad "), "desktop-upload-desktopabc..bad");

  const payload = safeUploadPayload({
    note: "x".repeat(1500),
    nested: { value: "ok" },
  });
  assert.equal(payload.note.length, 1000);
  assert.equal(payload.nested.value, "ok");
});

test("desktop service pricing and summary are computed server-side from known options", () => {
  assert.equal(calculateDesktopRequestCredits("stage_1", ["dpf_off", "egr_off", "dpf_off"]), 22);
  assert.equal(buildDesktopServiceSummary("stage_1", ["dpf_off"]), "Stage 1 + DPF Removal");
  assert.throws(() => calculateDesktopRequestCredits("stage_1", ["not_real"]));
  assert.equal(validateDesktopCreditAccess({ credit_balance: 30, account_status: "active" }, 22), null);
  assert.match(validateDesktopCreditAccess({ credit_balance: null, account_status: "active" }, 22) ?? "", /credit balance could not be verified/i);
  assert.match(validateDesktopCreditAccess({ credit_balance: 1, account_status: "active" }, 22) ?? "", /credit balance could not be verified/i);
  assert.match(validateDesktopCreditAccess({ credit_balance: 30, account_status: "blocked" }, 1) ?? "", /not active/i);
});

test("desktop app-check supports version control without customer secrets", async () => {
  const previousMin = process.env.DESKTOP_APP_MIN_VERSION;
  const previousLatest = process.env.DESKTOP_APP_LATEST_VERSION;
  const previousMaintenance = process.env.DESKTOP_APP_MAINTENANCE_MODE;
  const previousUpdateUrl = process.env.DESKTOP_APP_UPDATE_URL;
  const previousNotesUrl = process.env.DESKTOP_APP_RELEASE_NOTES_URL;
  const previousModules = process.env.DESKTOP_APP_ALLOWED_MODULES;
  const route = await import("../src/app/api/desktop/app-check/route");
  try {
    process.env.DESKTOP_APP_MIN_VERSION = "0.1.0";
    process.env.DESKTOP_APP_LATEST_VERSION = "0.2.0";
    process.env.DESKTOP_APP_MAINTENANCE_MODE = "false";
    process.env.DESKTOP_APP_UPDATE_URL = "https://file.mgautotech.de/downloads/uploader.exe";
    process.env.DESKTOP_APP_RELEASE_NOTES_URL = "http://unsafe.example.com/release-notes";
    process.env.DESKTOP_APP_ALLOWED_MODULES = "file_upload,request_history";
    const response = await route.GET(new Request("http://localhost/api/desktop/app-check?app_version=0.1.0&platform=win32&installation_id=install-123456789&build_channel=stable&session_status=anonymous"));
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.server_ok, true);
    assert.equal(body.update_required, false);
    assert.equal(body.update_available, true);
    assert.equal(body.latest_version, "0.2.0");
    assert.equal(body.update_url, "https://file.mgautotech.de/downloads/uploader.exe");
    assert.equal(body.release_notes_url, null);
    assert.deepEqual(body.allowed_modules, ["file_upload", "request_history"]);
    assert.equal(body.received.build_channel, "stable");
    assert.equal(JSON.stringify(body).includes("service_role"), false);
    assert.equal(compareDesktopVersions("1.2.0", "1.1.9"), 1);
  } finally {
    if (previousMin === undefined) delete process.env.DESKTOP_APP_MIN_VERSION;
    else process.env.DESKTOP_APP_MIN_VERSION = previousMin;
    if (previousLatest === undefined) delete process.env.DESKTOP_APP_LATEST_VERSION;
    else process.env.DESKTOP_APP_LATEST_VERSION = previousLatest;
    if (previousMaintenance === undefined) delete process.env.DESKTOP_APP_MAINTENANCE_MODE;
    else process.env.DESKTOP_APP_MAINTENANCE_MODE = previousMaintenance;
    if (previousUpdateUrl === undefined) delete process.env.DESKTOP_APP_UPDATE_URL;
    else process.env.DESKTOP_APP_UPDATE_URL = previousUpdateUrl;
    if (previousNotesUrl === undefined) delete process.env.DESKTOP_APP_RELEASE_NOTES_URL;
    else process.env.DESKTOP_APP_RELEASE_NOTES_URL = previousNotesUrl;
    if (previousModules === undefined) delete process.env.DESKTOP_APP_ALLOWED_MODULES;
    else process.env.DESKTOP_APP_ALLOWED_MODULES = previousModules;
  }
});

test("desktop app-check forced update blocks old versions", async () => {
  const previousMin = process.env.DESKTOP_APP_MIN_VERSION;
  const route = await import("../src/app/api/desktop/app-check/route");
  try {
    process.env.DESKTOP_APP_MIN_VERSION = "1.0.0";
    const response = await route.GET(new Request("http://localhost/api/desktop/app-check?app_version=0.1.0&installation_id=install-123456789"));
    const body = await response.json();
    assert.equal(body.update_required, true);
  } finally {
    if (previousMin === undefined) delete process.env.DESKTOP_APP_MIN_VERSION;
    else process.env.DESKTOP_APP_MIN_VERSION = previousMin;
  }
});

test("desktop module registry exposes only safe enabled customer modules", () => {
  const enabled = resolveEnabledModules(["file_upload", "request_history", "support", "diagnostics_future", "dtc_tools_future", "tuning_tools_future"]);
  assert.deepEqual(enabled.map((module) => module.id), ["file_upload", "request_history", "support"]);
  const betaVisible = resolveEnabledModules(["dtc_tools_beta_visible"]);
  assert.deepEqual(betaVisible.map((module) => module.id), ["dtc_tools_beta_visible"]);
  assert.equal(betaVisible[0]?.comingSoon, true);
  assert.equal(betaVisible[0]?.buttonLabel, "Coming Soon");
  const futureModules = desktopModules.filter((module) => module.id.includes("future"));
  assert.ok(futureModules.length >= 2);
  for (const desktopModule of futureModules) {
    assert.equal(desktopModule.customerVisible, false);
    assert.equal(desktopModule.enabledByDefault, false);
    assert.doesNotMatch(`${desktopModule.name} ${desktopModule.description}`, /patching enabled|MOD output enabled|checksum correction enabled/i);
  }
});

test("desktop DTC Tools beta card is visible but cannot start DTC processing", () => {
  const app = readFileSync(resolve(process.cwd(), "apps/customer-uploader/src/App.tsx"), "utf8");
  const registry = readFileSync(resolve(process.cwd(), "apps/customer-uploader/src/modules/registry.ts"), "utf8");
  const styles = readFileSync(resolve(process.cwd(), "apps/customer-uploader/src/styles.css"), "utf8");

  assert.match(registry, /dtc_tools_beta_visible/);
  assert.match(registry, /Beta \/ Coming Soon/);
  assert.match(registry, /Prepare DTC requests faster with guided code entry and file submission/);
  assert.match(app, /DtcComingSoonModal/);
  assert.match(app, /DTC Tools - Coming Soon/);
  assert.match(app, /No file modification is performed in this version/);
  assert.match(app, /setDtcInfoOpen\(true\)/);
  assert.match(styles, /beta-badge/);
  assert.match(styles, /modal-backdrop/);
  assert.doesNotMatch(app, /\/api\/dtc|\/api\/desktop\/dtc|dtc-upload|dtcUpload|createDtc|DTC request created/i);
  assert.doesNotMatch(app, /checksum|byte patch|binary patch|DTC OFF file/i);
});

test("desktop customer order select excludes admin-only and private fields", () => {
  const select = customerSafeDesktopOrderSelect();
  for (const forbidden of [
    "internal_notes",
    "admin_notes",
    "risk_flags",
    "audit",
    "raw",
    "hex",
    "source_reference",
    "confidence_score",
    "private_sample",
  ]) {
    assert.equal(select.includes(forbidden), false);
  }
});

test("desktop APIs require customer auth and scope data to the authenticated customer", () => {
  const files = [
    "src/app/api/desktop/bootstrap/route.ts",
    "src/app/api/desktop/requests/route.ts",
    "src/app/api/desktop/upload-session/route.ts",
    "src/app/api/desktop/requests/finalize/route.ts",
  ];

  for (const file of files) {
    const source = readFileSync(resolve(process.cwd(), file), "utf8");
    assert.match(source, /requireApiUser\(request\)/);
    assert.match(source, /requireDesktopAppAllowed\(request\)/);
    assert.doesNotMatch(source, /requireStaffPermission\(/);
    assert.doesNotMatch(source, /\/api\/admin/);
  }

  const listRoute = readFileSync(resolve(process.cwd(), "src/app/api/desktop/requests/route.ts"), "utf8");
  const finalizeRoute = readFileSync(resolve(process.cwd(), "src/app/api/desktop/requests/finalize/route.ts"), "utf8");
  assert.match(listRoute, /\.eq\("customer_id", auth\.user\.id\)/);
  assert.match(finalizeRoute, /\.eq\("customer_id", auth\.user\.id\)/);
  assert.match(finalizeRoute, /expectedPath = uploadPathFor\(auth\.user\.id/);
  assert.match(finalizeRoute, /parsed\.data\.upload\.path !== expectedPath/);
  assert.match(finalizeRoute, /parsed\.data\.uploadSessionId !== desktopUploadSessionIdFor/);
  assert.match(finalizeRoute, /validateDesktopCreditAccess/);

  const uploadSessionRoute = readFileSync(resolve(process.cwd(), "src/app/api/desktop/upload-session/route.ts"), "utf8");
  assert.match(uploadSessionRoute, /service: z\.object/);
  assert.match(uploadSessionRoute, /calculateDesktopRequestCredits/);
  assert.match(uploadSessionRoute, /validateDesktopCreditAccess/);
});

test("anonymous users cannot call desktop customer APIs", async () => {
  const bootstrap = await import("../src/app/api/desktop/bootstrap/route");
  const requests = await import("../src/app/api/desktop/requests/route");
  const uploadSession = await import("../src/app/api/desktop/upload-session/route");
  const finalize = await import("../src/app/api/desktop/requests/finalize/route");

  assert.equal((await bootstrap.GET(new Request("http://localhost/api/desktop/bootstrap"))).status, 401);
  assert.equal((await requests.GET(new Request("http://localhost/api/desktop/requests"))).status, 401);
  assert.equal((await uploadSession.POST(new Request("http://localhost/api/desktop/upload-session", { method: "POST", body: "{}" }))).status, 401);
  assert.equal((await finalize.POST(new Request("http://localhost/api/desktop/requests/finalize", { method: "POST", body: "{}" }))).status, 401);
});

test("desktop app does not expose admin routes or raw binary internals", () => {
  const appSource = [
    "apps/customer-uploader/src/App.tsx",
    "apps/customer-uploader/src/api.ts",
    "apps/customer-uploader/src/validation.ts",
    "apps/customer-uploader/src/i18n/en.ts",
  ].map((file) => readFileSync(resolve(process.cwd(), file), "utf8")).join("\n");

  assert.doesNotMatch(appSource, /\/api\/admin/);
  assert.doesNotMatch(appSource, /service_role/i);
  assert.doesNotMatch(appSource, /approved_for_learning/i);
  assert.doesNotMatch(appSource, /raw_hex|hex_preview|byte_patch/i);
  assert.match(appSource, /Checking MG AutoTech server/);
  assert.match(appSource, /Checking for updates/);
  assert.match(appSource, /This application requires an active internet connection/);
  assert.doesNotMatch(appSource, /\b(Kunde|Fahrzeug|Passwort|Zurueck|Anfrage|Datei|Notizen|Bitte|auswaehlen|oeffnen|verfuegbar|Pruefen|Senden)\b/);
  assert.equal(isValidSha256("a".repeat(64)), true);
  assert.equal(isValidSha256("not-a-hash"), false);
});

test("desktop app source blocks offline continuation and sends app verification headers", () => {
  const app = readFileSync(resolve(process.cwd(), "apps/customer-uploader/src/App.tsx"), "utf8");
  const api = readFileSync(resolve(process.cwd(), "apps/customer-uploader/src/api.ts"), "utf8");
  const main = readFileSync(resolve(process.cwd(), "apps/customer-uploader/electron/main.ts"), "utf8");
  const preload = readFileSync(resolve(process.cwd(), "apps/customer-uploader/electron/preload.ts"), "utf8");

  assert.match(app, /gate === "server_unavailable"/);
  assert.match(app, /gate === "configuration_missing"/);
  assert.match(app, /getDesktopConfigurationStatus/);
  assert.doesNotMatch(app, /^const supabase = createSupabaseBrowserClient\(\);$/m);
  assert.match(app, /en\.creditUnavailable/);
  assert.match(app, /verifyOnline\(session\)/);
  assert.match(app, /resolveEnabledModules/);
  assert.match(api, /x-mg-desktop-app-version/);
  assert.match(api, /x-mg-desktop-installation-id/);
  assert.match(api, /x-mg-desktop-build-channel/);
  assert.match(api, /persistSession:\s*false/);
  assert.match(api, /update_available/);
  assert.match(main, /installation-id\.txt/);
  assert.match(main, /randomUUID/);
  assert.match(main, /electron-updater/);
  assert.match(main, /autoDownload = false/);
  assert.match(main, /Menu\.setApplicationMenu\(null\)/);
  assert.match(preload, /checkNativeUpdate/);
  assert.match(preload, /openAppDataFolder/);
});

test("desktop premium UI keeps local history, diagnostics and messages customer-safe", () => {
  const app = readFileSync(resolve(process.cwd(), "apps/customer-uploader/src/App.tsx"), "utf8");
  const api = readFileSync(resolve(process.cwd(), "apps/customer-uploader/src/api.ts"), "utf8");
  const styles = readFileSync(resolve(process.cwd(), "apps/customer-uploader/src/styles.css"), "utf8");
  const globalTypes = readFileSync(resolve(process.cwd(), "apps/customer-uploader/src/global.d.ts"), "utf8");

  assert.match(app, /Local history only\. Server status is verified online/);
  assert.match(app, /Copy Diagnostic Info/);
  assert.match(app, /tokens, raw file content or private storage paths/);
  assert.match(app, /Customer-visible messages/);
  assert.match(app, /\/api\/requests\/\$\{encodeURIComponent\(requestId\)\}\/messages/);
  assert.match(app, /Retry-safe upload\. True chunked resume is not enabled yet/);
  assert.match(app, /ActiveSubmission/);
  assert.match(app, /uploadSession/);
  assert.match(app, /desktopUploadEnabled/);
  assert.match(api, /bytesPerSecond/);
  assert.match(api, /etaSeconds/);
  assert.match(globalTypes, /vehicleSummary/);
  assert.match(globalTypes, /serviceSummary/);
  assert.match(styles, /dashboard-grid/);
  assert.match(styles, /history-table/);
  assert.doesNotMatch(app, /localPath|absolutePath|storage_path|admin_notes|internal_notes|source_reference|confidence_score/);
});

test("desktop build validates public Vite env and renders missing-config screen instead of crashing", () => {
  const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), "apps/customer-uploader/package.json"), "utf8"));
  const envExamplePath = resolve(process.cwd(), "apps/customer-uploader/.env.example");
  const envExample = readFileSync(envExamplePath, "utf8");
  const checkEnv = readFileSync(resolve(process.cwd(), "apps/customer-uploader/scripts/check-env.mjs"), "utf8");
  const viteConfig = readFileSync(resolve(process.cwd(), "apps/customer-uploader/vite.config.ts"), "utf8");
  const api = readFileSync(resolve(process.cwd(), "apps/customer-uploader/src/api.ts"), "utf8");
  const app = readFileSync(resolve(process.cwd(), "apps/customer-uploader/src/App.tsx"), "utf8");
  const strings = readFileSync(resolve(process.cwd(), "apps/customer-uploader/src/i18n/en.ts"), "utf8");

  assert.equal(existsSync(envExamplePath), true);
  assert.match(envExample, /VITE_SUPABASE_URL=/);
  assert.match(envExample, /VITE_SUPABASE_ANON_KEY=/);
  assert.match(envExample, /VITE_API_BASE_URL=https:\/\/file\.mgautotech\.de/);
  assert.doesNotMatch(envExample, /SERVICE_ROLE|SECRET|PASSWORD/i);
  assert.match(packageJson.scripts["check-env"], /scripts\/check-env\.mjs/);
  assert.match(packageJson.scripts.build, /npm run check-env/);
  assert.match(packageJson.scripts.dev, /npm run check-env/);
  assert.match(checkEnv, /Missing desktop app environment variables/);
  assert.match(checkEnv, /NEXT_PUBLIC_SUPABASE_URL/);
  assert.match(checkEnv, /Never put the service-role key into the desktop app/);
  assert.match(viteConfig, /NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  assert.match(viteConfig, /https:\/\/file\.mgautotech\.de/);
  assert.doesNotMatch(viteConfig, /NEXT_PUBLIC_SITE_URL/);
  assert.match(viteConfig, /Object\.entries\(desktopEnv\)/);
  assert.match(viteConfig, /import\.meta\.env\.\$\{key\}/);
  assert.match(api, /getDesktopConfigurationStatus/);
  assert.match(api, /Application configuration is missing/);
  assert.match(app, /configuration_missing/);
  assert.match(strings, /Please reinstall the app or contact MG AutoTech support/);
  assert.doesNotMatch(`${api}\n${app}`, /Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY/);
});

test("desktop env checker schema-only reports the public contract without reading env files", async () => {
  const checker = await loadDesktopEnvChecker();
  const fsCalls: string[] = [];
  const lines: string[] = [];
  const failingFs = {
    existsSync(path: string) {
      fsCalls.push(`existsSync:${path}`);
      throw new Error("schema-only must not check env file existence");
    },
    readFileSync(path: string) {
      fsCalls.push(`readFileSync:${path}`);
      throw new Error("schema-only must not read env files");
    },
  };

  const exitCode = checker.main({
    argv: ["--schema-only"],
    envFilePaths: [".env", ".env.local", "apps/customer-uploader/.env", "apps/customer-uploader/.env.local"],
    fsModule: failingFs,
    processEnv: {},
    log: (message = "") => lines.push(message),
  });

  const output = lines.join("\n");
  assert.equal(exitCode, 0);
  assert.deepEqual(fsCalls, []);
  assert.match(output, /Desktop app environment schema-only contract/);
  assert.match(output, /REQ\s+VITE_SUPABASE_URL/);
  assert.match(output, /REQ\s+VITE_SUPABASE_ANON_KEY/);
  assert.match(output, /DEFAULT\s+VITE_API_BASE_URL=https:\/\/file\.mgautotech\.de/);
  assert.match(output, /Never put the service-role key or server secrets into the desktop app/);
  assert.match(output, /No environment files were read/);
});

test("desktop env checker default mode keeps env file fallback behavior", async () => {
  const checker = await loadDesktopEnvChecker();
  const lines: string[] = [];
  const errors: string[] = [];
  const envSources = new Map([
    [
      "root.env.local",
      [
        "NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY=public-anon-key",
      ].join("\n"),
    ],
    ["app.env.local", "VITE_API_BASE_URL=https://file.mgautotech.de"],
  ]);

  const exitCode = checker.main({
    argv: [],
    envFilePaths: ["root.env", "root.env.local", "app.env", "app.env.local"],
    fsModule: {
      existsSync: (path: string) => envSources.has(path),
      readFileSync: (path: string) => envSources.get(path) ?? "",
    },
    processEnv: {},
    log: (message = "") => lines.push(message),
    error: (message = "") => errors.push(message),
  });

  assert.equal(exitCode, 0);
  assert.deepEqual(errors, []);
  assert.match(lines.join("\n"), /Desktop app environment looks ready/);
});

test("desktop env checker schema-only CLI succeeds without requiring env files", () => {
  const output = execFileSync(process.execPath, ["apps/customer-uploader/scripts/check-env.mjs", "--schema-only"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.match(output, /Desktop app environment schema-only contract/);
  assert.match(output, /REQ\s+VITE_SUPABASE_ANON_KEY/);
  assert.match(output, /No environment files were read/);
});

test("desktop package is signing-ready, per-user and installer-friendly", () => {
  const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), "apps/customer-uploader/package.json"), "utf8"));
  const packageScript = readFileSync(resolve(process.cwd(), "apps/customer-uploader/scripts/package-win.mjs"), "utf8");
  const gitignore = readFileSync(resolve(process.cwd(), ".gitignore"), "utf8");
  const iconPath = resolve(process.cwd(), "apps/customer-uploader/build/icon.ico");

  assert.equal(packageJson.build.appId, "de.mgautotech.fileuploadassistant");
  assert.equal(packageJson.author, "MG AutoTech");
  assert.equal(existsSync(iconPath), true);
  assert.equal(JSON.stringify(packageJson.build).includes("requireAdministrator"), false);
  assert.equal(packageJson.build.icon, "build/icon.ico");
  assert.equal(packageJson.build.win.icon, "build/icon.ico");
  assert.equal(packageJson.build.files.includes("build/icon.ico"), true);
  assert.equal(packageJson.build.nsis.installerIcon, "build/icon.ico");
  assert.equal(packageJson.build.nsis.uninstallerIcon, "build/icon.ico");
  assert.equal(packageJson.build.nsis.installerHeaderIcon, "build/icon.ico");
  assert.equal(packageJson.build.nsis.perMachine, false);
  assert.match(packageScript, /WINDOWS_CERTIFICATE_FILE/);
  assert.match(packageScript, /WINDOWS_CERTIFICATE_PASSWORD/);
  assert.match(gitignore, /\*\.pfx/);
  assert.match(gitignore, /\*\.p12/);
  assert.match(readFileSync(resolve(process.cwd(), "apps/customer-uploader/electron/main.ts"), "utf8"), /setAppUserModelId|icon:\s*getIconPath/);
});

test("desktop distribution docs cover signing, updates and false-positive process", () => {
  for (const file of [
    "docs/desktop-app-security-and-distribution.md",
    "docs/desktop-app-update-system.md",
    "docs/windows-defender-false-positive-checklist.md",
  ]) {
    const source = readFileSync(resolve(process.cwd(), file), "utf8");
    assert.match(source, /code signing|signed|SmartScreen|Defender|update/i);
    assert.doesNotMatch(source, /disable Windows Defender|bypass detection|evade antivirus/i);
  }
});

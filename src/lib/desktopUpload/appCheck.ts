import { NextResponse } from "next/server";

export const desktopAppCurrentVersion = "0.2.1";
export const desktopUploadProtocolMinimumVersion = "0.2.0";
export const desktopAppDefaultPlatform = "win32";

export type DesktopClientInfo = {
  appVersion: string;
  platform: string;
  installationId: string;
  buildChannel: string;
  sessionStatus: string;
};

export type DesktopAppCheckPayload = {
  server_ok: true;
  minimum_supported_version: string;
  latest_version: string;
  update_required: boolean;
  update_available: boolean;
  update_url: string | null;
  release_notes_url: string | null;
  maintenance_mode: boolean;
  desktop_upload_enabled: boolean;
  message_en: string | null;
  allowed_modules: string[];
};

function envFlag(name: string, defaultValue: boolean) {
  const value = process.env[name];
  if (value == null || value === "") return defaultValue;
  return value.toLowerCase() === "true" || value === "1" || value.toLowerCase() === "yes";
}

export function compareDesktopVersions(left: string, right: string) {
  const a = left.split(".").map((part) => Number.parseInt(part, 10) || 0);
  const b = right.split(".").map((part) => Number.parseInt(part, 10) || 0);
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    if ((a[index] ?? 0) > (b[index] ?? 0)) return 1;
    if ((a[index] ?? 0) < (b[index] ?? 0)) return -1;
  }
  return 0;
}

export function normalizeDesktopInstallationId(value: string | null | undefined) {
  return (value ?? "").trim().replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 96);
}

export function readDesktopClientInfo(request: Request): DesktopClientInfo {
  const url = new URL(request.url);
  return {
    appVersion: (request.headers.get("x-mg-desktop-app-version") || url.searchParams.get("app_version") || "").trim(),
    platform: (request.headers.get("x-mg-desktop-platform") || url.searchParams.get("platform") || desktopAppDefaultPlatform).trim().slice(0, 40),
    installationId: normalizeDesktopInstallationId(request.headers.get("x-mg-desktop-installation-id") || url.searchParams.get("installation_id")),
    buildChannel: (request.headers.get("x-mg-desktop-build-channel") || url.searchParams.get("build_channel") || "stable").trim().slice(0, 40),
    sessionStatus: (request.headers.get("x-mg-desktop-session-status") || url.searchParams.get("session_status") || "anonymous").trim().slice(0, 40),
  };
}

function safeHttpsUrl(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const mgControlled = host === "mgautotech.de" || host.endsWith(".mgautotech.de");
    return url.protocol === "https:" && mgControlled ? url.toString() : null;
  } catch {
    return null;
  }
}

function allowedDesktopModules() {
  const value = process.env.DESKTOP_APP_ALLOWED_MODULES || "file_upload,request_history";
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

export function getDesktopAppCheckPayload(info: Pick<DesktopClientInfo, "appVersion">): DesktopAppCheckPayload {
  const configuredMinimum = process.env.DESKTOP_APP_MIN_VERSION || desktopUploadProtocolMinimumVersion;
  const minimum = compareDesktopVersions(configuredMinimum, desktopUploadProtocolMinimumVersion) < 0
    ? desktopUploadProtocolMinimumVersion
    : configuredMinimum;
  const configuredLatest = process.env.DESKTOP_APP_LATEST_VERSION || desktopAppCurrentVersion;
  const latest = compareDesktopVersions(configuredLatest, minimum) < 0
    ? minimum
    : configuredLatest;
  const maintenance = envFlag("DESKTOP_APP_MAINTENANCE_MODE", false);
  const enabled = envFlag("DESKTOP_APP_UPLOAD_ENABLED", envFlag("DESKTOP_UPLOAD_ENABLED", true));
  const hasVersion = info.appVersion.length > 0;
  const updateRequired = hasVersion ? compareDesktopVersions(info.appVersion, minimum) < 0 : false;
  const updateAvailable = hasVersion ? compareDesktopVersions(info.appVersion, latest) < 0 : false;

  return {
    server_ok: true,
    minimum_supported_version: minimum,
    latest_version: latest,
    update_required: updateRequired,
    update_available: updateAvailable,
    update_url: safeHttpsUrl(process.env.DESKTOP_APP_UPDATE_URL),
    release_notes_url: safeHttpsUrl(process.env.DESKTOP_APP_RELEASE_NOTES_URL),
    maintenance_mode: maintenance,
    desktop_upload_enabled: enabled,
    message_en: process.env.DESKTOP_APP_MESSAGE_EN || null,
    allowed_modules: allowedDesktopModules(),
  };
}

export function desktopAppBlockReason(payload: DesktopAppCheckPayload) {
  if (!payload.desktop_upload_enabled) return { status: 403, error: "Desktop upload is currently disabled." };
  if (payload.update_required) {
    return {
      status: 426,
      error: "This version of the MG AutoTech application is no longer supported. Please install the latest version.",
    };
  }
  if (payload.maintenance_mode) {
    return {
      status: 503,
      error: "Maintenance mode is active. Please try again later.",
    };
  }
  return null;
}

export function requireDesktopAppAllowed(request: Request) {
  const info = readDesktopClientInfo(request);
  if (!info.appVersion) {
    return {
      ok: false as const,
      info,
      response: NextResponse.json({ error: "Desktop app version is required." }, { status: 400 }),
    };
  }
  if (!info.installationId || info.installationId.length < 12) {
    return {
      ok: false as const,
      info,
      response: NextResponse.json({ error: "Desktop installation id is required." }, { status: 400 }),
    };
  }

  const payload = getDesktopAppCheckPayload(info);
  const block = desktopAppBlockReason(payload);
  if (block) {
    return {
      ok: false as const,
      info,
      response: NextResponse.json({ error: block.error, app: payload }, { status: block.status }),
    };
  }

  return { ok: true as const, info, app: payload };
}

import { getDesktopAppCheckPayload } from "@/lib/desktopUpload/appCheck";

export type DesktopSigningStatus = "unsigned_internal_beta" | "signed_beta" | "signed_release";

function envFlag(name: string, fallback = false) {
  const value = process.env[name];
  if (!value) return fallback;
  return ["true", "1", "yes", "on"].includes(value.toLowerCase());
}

function signingStatus(): DesktopSigningStatus {
  const value = process.env.DESKTOP_APP_SIGNING_STATUS;
  if (value === "signed_beta" || value === "signed_release") return value;
  return "unsigned_internal_beta";
}

function releaseChannel() {
  const value = process.env.DESKTOP_APP_RELEASE_CHANNEL;
  return value === "stable" ? "stable" : "beta";
}

export function getDesktopReleaseReadiness(appVersion = "") {
  const app = getDesktopAppCheckPayload({ appVersion });
  const signing = signingStatus();
  const publicDownloadEnabled = envFlag("DESKTOP_APP_PUBLIC_DOWNLOAD_ENABLED", false);
  const cleanWindowsTested = envFlag("DESKTOP_APP_CLEAN_WINDOWS_TESTED", false);
  const defenderTested = envFlag("DESKTOP_APP_DEFENDER_TESTED", false);
  const hostedUpdateFeed = Boolean(app.update_url && app.release_notes_url);
  const releaseReady =
    signing === "signed_release" &&
    cleanWindowsTested &&
    defenderTested &&
    hostedUpdateFeed;

  return {
    app,
    channel: releaseChannel(),
    signingStatus: signing,
    publicDownloadEnabled: publicDownloadEnabled && releaseReady,
    internalBeta: true,
    releaseReady,
    checks: [
      { key: "version_gate", label: "Server version gate", complete: Boolean(app.minimum_supported_version && app.latest_version) },
      { key: "upload_gate", label: "Server upload gate", complete: app.desktop_upload_enabled && !app.maintenance_mode },
      { key: "signed", label: "Windows code signing", complete: signing !== "unsigned_internal_beta" },
      { key: "clean_windows", label: "Clean Windows validation", complete: cleanWindowsTested },
      { key: "defender", label: "Defender / SmartScreen review", complete: defenderTested },
      { key: "update_feed", label: "MG-controlled HTTPS update feed", complete: hostedUpdateFeed },
    ],
  };
}

export function projectPublicDesktopRelease(appVersion = "") {
  const release = getDesktopReleaseReadiness(appVersion);
  return {
    version: release.app.latest_version,
    minimum_supported_version: release.app.minimum_supported_version,
    channel: release.channel,
    required: release.app.update_required,
    update_available: release.app.update_available,
    release_notes_url: release.app.release_notes_url,
    download_enabled: release.publicDownloadEnabled,
    download_url: release.publicDownloadEnabled ? release.app.update_url : null,
    status: release.publicDownloadEnabled ? "available" : "selected_beta_only",
  };
}

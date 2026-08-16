import { createClient, type Session } from "@supabase/supabase-js";

export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "https://file.mgautotech.de";
export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
export const desktopAppVersion = import.meta.env.VITE_APP_VERSION || "0.2.0";
export const desktopPlatform = "win32";
export const desktopBuildChannel = import.meta.env.VITE_APP_BUILD_CHANNEL || "stable";

let installationId = "";

export type DesktopProfile = {
  id: string;
  email: string | null;
  customer_id: string | null;
  full_name: string | null;
  company_name: string | null;
  phone: string | null;
  credit_balance: number | string | null;
  account_status: string | null;
};

export type DesktopRequest = {
  id: string;
  vehicle_brand: string | null;
  vehicle_model: string | null;
  vehicle_generation: string | null;
  vehicle_engine: string | null;
  service_type: string | null;
  credits_required: number | string | null;
  status: string | null;
  uploaded_file_name: string | null;
  created_at: string;
};

export type ServiceCatalog = {
  primary: Array<{ id: string; title: string; credits: number; description?: string }>;
  extraCategories: Array<{
    id: string;
    title: string;
    description: string;
    services: Array<{ id: string; title: string; credits: number; description?: string }>;
  }>;
};

export type AppCheckPayload = {
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

export type BootstrapPayload = {
  profile: DesktopProfile;
  requests: DesktopRequest[];
  services: ServiceCatalog;
  limits: { maxFileSize: number; allowedExtensions: string[] };
  app?: AppCheckPayload;
};

export type DesktopConfigurationStatus = {
  ok: boolean;
  missing: string[];
};

export type CustomerVisibleMessage = {
  id: string;
  request_id: string;
  sender_role: "admin" | "customer" | string;
  message: string;
  created_at: string;
};

export type UploadProgressSnapshot = {
  loadedBytes: number;
  totalBytes: number;
  percent: number;
  bytesPerSecond: number | null;
  etaSeconds: number | null;
};

export function setDesktopInstallationId(value: string) {
  installationId = value;
}

export function getDesktopInstallationId() {
  return installationId;
}

function desktopHeaders(session?: Session | null) {
  if (!installationId) {
    throw new Error("Desktop installation verification is not ready. Please restart the application.");
  }
  return {
    "Content-Type": "application/json",
    "x-mg-desktop-app-version": desktopAppVersion,
    "x-mg-desktop-platform": desktopPlatform,
    "x-mg-desktop-build-channel": desktopBuildChannel,
    "x-mg-desktop-session-status": session ? "authenticated" : "anonymous",
    "x-mg-desktop-installation-id": installationId,
    ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
  };
}

export function getDesktopConfigurationStatus(): DesktopConfigurationStatus {
  const missing = [
    ["VITE_SUPABASE_URL", supabaseUrl],
    ["VITE_SUPABASE_ANON_KEY", supabaseAnonKey],
    ["VITE_API_BASE_URL", apiBaseUrl],
  ].filter(([, value]) => !String(value || "").trim()).map(([key]) => key);

  return { ok: missing.length === 0, missing };
}

export function createSupabaseBrowserClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Application configuration is missing. Please reinstall the app or contact MG AutoTech support.");
  }
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export async function checkDesktopApp(session?: Session | null): Promise<AppCheckPayload> {
  const response = await fetch(`${apiBaseUrl}/api/desktop/app-check`, {
    method: "GET",
    headers: desktopHeaders(session),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Server check failed with ${response.status}`);
  return data as AppCheckPayload;
}

export function assertAppCheckAllowsWork(app: AppCheckPayload) {
  if (app.update_required) {
    throw new Error("This version of the MG AutoTech application is no longer supported. Please install the latest version.");
  }
  if (app.maintenance_mode) {
    throw new Error("Maintenance mode is active. Please try again later.");
  }
  if (!app.desktop_upload_enabled) {
    throw new Error(app.message_en || "Desktop upload is currently disabled.");
  }
}

export async function apiFetch<T>(path: string, session: Session, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      ...desktopHeaders(session),
      ...(init?.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed with ${response.status}`);
  return data as T;
}

export async function uploadToPrivateStorage(input: {
  signedUploadUrl: string;
  file: File;
  contentType: string;
  onProgress(progress: UploadProgressSnapshot): void;
}) {
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const startedAt = performance.now();
    const emitProgress = (loadedBytes: number, totalBytes: number) => {
      const elapsedSeconds = Math.max((performance.now() - startedAt) / 1000, 0.001);
      const bytesPerSecond = loadedBytes > 0 ? loadedBytes / elapsedSeconds : null;
      const remainingBytes = Math.max(totalBytes - loadedBytes, 0);
      input.onProgress({
        loadedBytes,
        totalBytes,
        percent: totalBytes > 0 ? Math.round((loadedBytes / totalBytes) * 100) : 0,
        bytesPerSecond,
        etaSeconds: bytesPerSecond && bytesPerSecond > 0 ? Math.round(remainingBytes / bytesPerSecond) : null,
      });
    };

    xhr.open("PUT", input.signedUploadUrl);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("content-type", input.contentType || "application/octet-stream");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) emitProgress(event.loaded, event.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        emitProgress(input.file.size, input.file.size);
        resolve();
      } else if (xhr.status === 409) {
        emitProgress(input.file.size, input.file.size);
        resolve();
      } else {
        reject(new Error(`Upload failed with ${xhr.status}: ${xhr.responseText || xhr.statusText}`));
      }
    };
    xhr.onerror = () => reject(new Error("Network upload failed."));
    xhr.send(input.file);
  });
}

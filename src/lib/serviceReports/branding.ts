import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";

export const REPORT_LOGO_INPUT_MAX_BYTES = 2 * 1024 * 1024;
export const REPORT_LOGO_OUTPUT_MAX_BYTES = 512 * 1024;
export const REPORT_LOGO_MAX_PIXELS = 4_000_000;
export const REPORT_LOGO_MAX_EDGE = 512;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

export class ReportBrandingError extends Error {
  constructor(readonly code: "invalid_image" | "image_too_large" | "invalid_path" | "unavailable", readonly status: 400 | 413 | 503 = 400) {
    super(code);
    this.name = "ReportBrandingError";
  }
}

export function isOwnedReportLogoPath(customerId: string, path: unknown): path is string {
  if (!uuid.test(customerId) || typeof path !== "string") return false;
  const prefix = `${customerId}/profile/report-logo/`;
  return path.startsWith(prefix) && path.endsWith(".png") && uuid.test(path.slice(prefix.length, -4));
}

export function createReportLogoPath(customerId: string, imageId: string = randomUUID()) {
  const path = `${customerId}/profile/report-logo/${imageId}.png`;
  if (!isOwnedReportLogoPath(customerId, path)) throw new ReportBrandingError("invalid_path");
  return path;
}

export function normalizeReportLogoContentType(value: string | null) {
  const type = value?.split(";", 1)[0].trim().toLowerCase();
  if (type !== "image/png" && type !== "image/jpeg") throw new ReportBrandingError("invalid_image");
  return type;
}

/** Bound actual streamed bytes, not only a caller-controlled Content-Length. */
export async function readReportLogoBody(request: Request, options: { maxBytes?: number; timeoutMs?: number } = {}) {
  const maxBytes = options.maxBytes ?? REPORT_LOGO_INPUT_MAX_BYTES;
  const timeoutMs = options.timeoutMs ?? 10_000;
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0 || !Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new TypeError("Invalid body limit.");
  const declared = request.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > maxBytes)) throw new ReportBrandingError("image_too_large", 413);
  if (!request.body) throw new ReportBrandingError("invalid_image");
  const reader = request.body.getReader();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      timedOut = true;
      reject(new ReportBrandingError("invalid_image"));
      void reader.cancel().catch(() => undefined);
    }, timeoutMs);
  });
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await Promise.race([reader.read(), deadline]);
      if (timedOut) throw new ReportBrandingError("invalid_image");
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new ReportBrandingError("image_too_large", 413);
      }
      chunks.push(value);
    }
    if (total === 0 || (declared !== null && Number(declared) !== total)) throw new ReportBrandingError("invalid_image");
    return Buffer.concat(chunks, total);
  } finally {
    if (timer) clearTimeout(timer);
    reader.releaseLock();
  }
}

/** Only decoded raster pixels survive. EXIF, profiles, SVG and external URLs do not. */
export async function normalizeReportLogo(input: Uint8Array, contentType: string) {
  const type = normalizeReportLogoContentType(contentType);
  if (!input.byteLength || input.byteLength > REPORT_LOGO_INPUT_MAX_BYTES) throw new ReportBrandingError("image_too_large", 413);
  const bytes = Buffer.from(input);
  const png = bytes.subarray(0, 8).equals(pngSignature);
  const jpeg = bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if ((type === "image/png" && !png) || (type === "image/jpeg" && !jpeg)) throw new ReportBrandingError("invalid_image");
  try {
    const image = sharp(bytes, { limitInputPixels: REPORT_LOGO_MAX_PIXELS, failOn: "warning", sequentialRead: true });
    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height || metadata.width > 4096 || metadata.height > 4096
      || metadata.width * metadata.height > REPORT_LOGO_MAX_PIXELS || (metadata.pages ?? 1) !== 1
      || metadata.format !== (type === "image/png" ? "png" : "jpeg")) throw new ReportBrandingError("invalid_image");
    const output = await image.rotate().resize({ width: REPORT_LOGO_MAX_EDGE, height: REPORT_LOGO_MAX_EDGE, fit: "inside", withoutEnlargement: true })
      .png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer();
    if (output.length > REPORT_LOGO_OUTPUT_MAX_BYTES) throw new ReportBrandingError("image_too_large", 413);
    return output;
  } catch (error) {
    if (error instanceof ReportBrandingError) throw error;
    throw new ReportBrandingError("invalid_image");
  }
}

export type ReportBrandingStore = {
  readPath(customerId: string): Promise<string | null>;
  writePath(customerId: string, path: string | null): Promise<void>;
  upload(path: string, bytes: Buffer): Promise<void>;
  download(path: string): Promise<Blob>;
};

export function createReportBrandingStore(admin: SupabaseClient): ReportBrandingStore {
  return {
    async readPath(customerId) {
      const { data, error } = await admin.from("customer_report_branding").select("logo_path").eq("customer_id", customerId).maybeSingle();
      if (error) throw new ReportBrandingError("unavailable", 503);
      return data?.logo_path ?? null;
    },
    async writePath(customerId, path) {
      const { error } = await admin.from("customer_report_branding").upsert({ customer_id: customerId, logo_path: path, updated_at: new Date().toISOString() }, { onConflict: "customer_id" });
      if (error) throw new ReportBrandingError("unavailable", 503);
    },
    async upload(path, bytes) {
      const { error } = await admin.storage.from("customer-files").upload(path, bytes, { contentType: "image/png", upsert: false, cacheControl: "3600" });
      if (error) throw new ReportBrandingError("unavailable", 503);
    },
    async download(path) {
      const { data, error } = await admin.storage.from("customer-files").download(path);
      if (error || !data) throw new ReportBrandingError("unavailable", 503);
      return data;
    },
  };
}

export async function loadReportLogoDataUrl(store: ReportBrandingStore, customerId: string, path: unknown): Promise<string | null> {
  if (path === null || path === undefined) return null;
  if (!isOwnedReportLogoPath(customerId, path)) throw new ReportBrandingError("invalid_path");
  const image = await store.download(path);
  if (image.size > REPORT_LOGO_OUTPUT_MAX_BYTES) throw new ReportBrandingError("image_too_large", 413);
  const clean = await normalizeReportLogo(new Uint8Array(await image.arrayBuffer()), "image/png");
  return `data:image/png;base64,${clean.toString("base64")}`;
}

export async function readReportBranding(store: ReportBrandingStore, customerId: string) {
  if (!uuid.test(customerId)) throw new ReportBrandingError("invalid_path");
  return { logoDataUrl: await loadReportLogoDataUrl(store, customerId, await store.readPath(customerId)) };
}

export async function saveReportBranding(store: ReportBrandingStore, customerId: string, input: Uint8Array, contentType: string) {
  const path = createReportLogoPath(customerId);
  const bytes = await normalizeReportLogo(input, contentType);
  await store.upload(path, bytes);
  await store.writePath(customerId, path);
  // Old immutable objects remain available to already-issued report snapshots.
  return { logoDataUrl: `data:image/png;base64,${bytes.toString("base64")}` };
}

export async function removeReportBranding(store: ReportBrandingStore, customerId: string) {
  if (!uuid.test(customerId)) throw new ReportBrandingError("invalid_path");
  await store.writePath(customerId, null);
  return { logoDataUrl: null };
}

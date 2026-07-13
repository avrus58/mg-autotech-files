export const allowedExtensions = [".bin", ".ori", ".mod", ".frf", ".hex", ".zip", ".sgo"] as const;
export const maxUploadBytes = 32 * 1024 * 1024;

export type FileValidationResult =
  | { ok: true }
  | { ok: false; error: string };

export function validateUploadFile(file: Pick<File, "name" | "size">): FileValidationResult {
  const lower = file.name.toLowerCase();
  if (!allowedExtensions.some((extension) => lower.endsWith(extension))) {
    return { ok: false, error: "Unsupported file type. Allowed: .bin, .ori, .mod, .frf, .hex, .zip, .sgo." };
  }
  if (!Number.isFinite(file.size) || file.size <= 0) {
    return { ok: false, error: "The file is empty or invalid." };
  }
  if (file.size > maxUploadBytes) {
    return { ok: false, error: "The file must be 32 MB or smaller." };
  }
  return { ok: true };
}

export async function sha256ArrayBuffer(buffer: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function sha256File(file: File) {
  return sha256ArrayBuffer(await file.arrayBuffer());
}

export function createIdempotencyKey() {
  const random = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `desktop-${Date.now()}-${random}`.replace(/[^a-zA-Z0-9._-]/g, "");
}

export function safeUploadPayload(value: unknown, options: { maxStringLength?: number } = {}) {
  const FileCtor = globalThis.File;
  const maxStringLength = options.maxStringLength ?? 1000;
  return JSON.parse(JSON.stringify(value, (_key, nested) => {
    if (typeof FileCtor !== "undefined" && nested instanceof FileCtor) return undefined;
    if (typeof nested === "string" && nested.length > maxStringLength) return nested.slice(0, maxStringLength);
    return nested;
  }));
}

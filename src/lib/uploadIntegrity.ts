import { createHmac, timingSafeEqual } from "node:crypto";

export const uploadIntegrityMaxBytes = 32 * 1024 * 1024;
export const uploadIntegrityContractTtlSeconds = 15 * 60;

export type UploadIntegrityKind = "desktop_request" | "additional_file";

export type UploadIntegrityPayload = {
  version: 1;
  kind: UploadIntegrityKind;
  userId: string;
  resourceId: string;
  path: string;
  fileName: string;
  fileSize: number;
  contentType: string;
  sha256: string | null;
  nonce: string;
  expiresAt: number;
};

export class UploadIntegrityError extends Error {
  constructor(message = "The upload verification session is invalid or expired.") {
    super(message);
    this.name = "UploadIntegrityError";
  }
}

function configuredSecret(environment: Readonly<Record<string, string | undefined>> = process.env) {
  const secret = environment.UPLOAD_INTEGRITY_SECRET?.trim() ?? "";
  if (secret.length < 32) {
    throw new UploadIntegrityError("Secure upload verification is not configured.");
  }
  return secret;
}

function signatureFor(encodedPayload: string, secret: string) {
  return createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

function safeString(value: unknown, maximum: number) {
  return typeof value === "string" && value.length > 0 && value.length <= maximum;
}

export function normalizeUploadContentType(value: string | null | undefined) {
  const normalized = (value || "application/octet-stream")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (!/^[a-z0-9][a-z0-9!#$&^_.+-]{0,126}\/[a-z0-9][a-z0-9!#$&^_.+-]{0,126}$/.test(normalized)) {
    throw new UploadIntegrityError("The file content type is invalid.");
  }
  return normalized;
}

export function isCompatibleFirmwareUpload(fileName: string, contentType: string) {
  let normalized: string;
  try {
    normalized = normalizeUploadContentType(contentType);
  } catch {
    return false;
  }
  const lowerName = fileName.toLowerCase();
  if (lowerName.endsWith(".zip")) {
    return ["application/octet-stream", "application/zip", "application/x-zip-compressed"].includes(normalized);
  }
  if (lowerName.endsWith(".hex")) {
    return ["application/octet-stream", "application/x-binary", "text/plain"].includes(normalized);
  }
  return ["application/octet-stream", "application/x-binary"].includes(normalized);
}

export function isSafeSupportingUpload(fileName: string, contentType: string) {
  let normalized: string;
  try {
    normalized = normalizeUploadContentType(contentType);
  } catch {
    return false;
  }
  const activeTypes = new Set([
    "text/html",
    "application/xhtml+xml",
    "image/svg+xml",
    "application/javascript",
    "text/javascript",
  ]);
  return !activeTypes.has(normalized) && !/\.(?:html?|xhtml|svg|m?js)$/i.test(fileName);
}

function normalizePayload(input: Omit<UploadIntegrityPayload, "version" | "expiresAt"> & {
  expiresAt?: number;
}): UploadIntegrityPayload {
  const expiresAt = input.expiresAt ?? Math.floor(Date.now() / 1000) + uploadIntegrityContractTtlSeconds;
  const payload: UploadIntegrityPayload = {
    version: 1,
    kind: input.kind,
    userId: input.userId,
    resourceId: input.resourceId,
    path: input.path,
    fileName: input.fileName,
    fileSize: input.fileSize,
    contentType: normalizeUploadContentType(input.contentType),
    sha256: input.sha256?.toLowerCase() ?? null,
    nonce: input.nonce,
    expiresAt,
  };

  if (
    !["desktop_request", "additional_file"].includes(payload.kind) ||
    !safeString(payload.userId, 128) ||
    !safeString(payload.resourceId, 160) ||
    !safeString(payload.path, 700) ||
    !safeString(payload.fileName, 240) ||
    !safeString(payload.nonce, 128) ||
    !Number.isInteger(payload.fileSize) ||
    payload.fileSize <= 0 ||
    payload.fileSize > uploadIntegrityMaxBytes ||
    !Number.isInteger(payload.expiresAt) ||
    (payload.sha256 !== null && !/^[a-f0-9]{64}$/.test(payload.sha256)) ||
    (payload.kind === "desktop_request" && payload.sha256 === null) ||
    (payload.kind === "additional_file" && payload.sha256 !== null)
  ) {
    throw new UploadIntegrityError();
  }
  splitStoragePath(payload.path);
  return payload;
}

export function createUploadIntegrityContract(
  input: Omit<UploadIntegrityPayload, "version" | "expiresAt"> & { expiresAt?: number },
  options: { secret?: string } = {}
) {
  const payload = normalizePayload(input);
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const secret = options.secret ?? configuredSecret();
  if (secret.length < 32) throw new UploadIntegrityError("Secure upload verification is not configured.");
  return `${encodedPayload}.${signatureFor(encodedPayload, secret)}`;
}

function isPayload(value: unknown): value is UploadIntegrityPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const payload = value as Partial<UploadIntegrityPayload>;
  if (
    payload.version !== 1 ||
    typeof payload.expiresAt !== "number" ||
    !Number.isInteger(payload.expiresAt) ||
    (payload.sha256 !== null && typeof payload.sha256 !== "string")
  ) return false;
  try {
    const normalized = normalizePayload({
      kind: payload.kind as UploadIntegrityKind,
      userId: payload.userId ?? "",
      resourceId: payload.resourceId ?? "",
      path: payload.path ?? "",
      fileName: payload.fileName ?? "",
      fileSize: payload.fileSize ?? 0,
      contentType: payload.contentType ?? "",
      sha256: payload.sha256 ?? null,
      nonce: payload.nonce ?? "",
      expiresAt: payload.expiresAt,
    });
    return JSON.stringify(payload) === JSON.stringify(normalized);
  } catch {
    return false;
  }
}

export function verifyUploadIntegrityContract(
  token: string,
  expected: Partial<Pick<UploadIntegrityPayload,
    "kind" | "userId" | "resourceId" | "path" | "fileName" | "fileSize" | "contentType" | "sha256"
  >>,
  options: { secret?: string; nowSeconds?: number } = {}
) {
  if (token.length > 4096) throw new UploadIntegrityError();
  const [encodedPayload, encodedSignature, extra] = token.split(".");
  if (!encodedPayload || !encodedSignature || extra) throw new UploadIntegrityError();

  const secret = options.secret ?? configuredSecret();
  if (secret.length < 32) throw new UploadIntegrityError("Secure upload verification is not configured.");
  const expectedSignature = Buffer.from(signatureFor(encodedPayload, secret));
  const suppliedSignature = Buffer.from(encodedSignature);
  if (
    expectedSignature.length !== suppliedSignature.length ||
    !timingSafeEqual(expectedSignature, suppliedSignature)
  ) {
    throw new UploadIntegrityError();
  }

  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  } catch {
    throw new UploadIntegrityError();
  }
  if (!isPayload(payload)) throw new UploadIntegrityError();
  const nowSeconds = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (
    payload.expiresAt <= nowSeconds ||
    payload.expiresAt > nowSeconds + uploadIntegrityContractTtlSeconds + 5
  ) {
    throw new UploadIntegrityError();
  }

  for (const [key, expectedValue] of Object.entries(expected)) {
    const actualValue = payload[key as keyof UploadIntegrityPayload];
    const normalizedExpected = key === "contentType"
      ? normalizeUploadContentType(String(expectedValue))
      : key === "sha256" && typeof expectedValue === "string"
        ? expectedValue.toLowerCase()
        : expectedValue;
    if (actualValue !== normalizedExpected) throw new UploadIntegrityError();
  }
  return payload;
}

export function splitStoragePath(path: string) {
  if (!path || path.includes("\\") || path.includes("\0") || path.startsWith("/") || path.endsWith("/")) {
    throw new UploadIntegrityError("The upload path is invalid.");
  }
  const parts = path.split("/");
  if (parts.length < 2 || parts.some((part) => !part || part === "." || part === "..")) {
    throw new UploadIntegrityError("The upload path is invalid.");
  }
  const name = parts.pop() as string;
  return { folder: parts.join("/"), name };
}

export function isExpectedFileExpertStoragePath(path: string | null, userId: string, jobId: string) {
  if (!path) return true;
  try {
    const { folder } = splitStoragePath(path);
    return folder === `${userId}/${jobId}`;
  } catch {
    return false;
  }
}

export type StoredObjectMetadata = {
  size: number;
  contentType: string;
};

export function exactStoredObjectMetadata(objects: unknown, objectName: string): StoredObjectMetadata | null {
  if (!Array.isArray(objects)) return null;
  const match = objects.find((item) => {
    return Boolean(item && typeof item === "object" && (item as { name?: unknown }).name === objectName);
  }) as { metadata?: Record<string, unknown> } | undefined;
  const metadata = match?.metadata;
  if (!metadata) return null;
  const size = Number(metadata.size ?? metadata.contentLength);
  const rawContentType = metadata.mimetype ?? metadata.contentType ?? metadata.content_type;
  if (!Number.isInteger(size) || size <= 0 || typeof rawContentType !== "string") return null;
  try {
    return { size, contentType: normalizeUploadContentType(rawContentType) };
  } catch {
    return null;
  }
}

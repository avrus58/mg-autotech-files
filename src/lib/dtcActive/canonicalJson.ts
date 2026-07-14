import { createHash } from "node:crypto";

type CanonicalJsonValue =
  | null
  | boolean
  | number
  | string
  | CanonicalJsonValue[]
  | { [key: string]: CanonicalJsonValue };

export function canonicalizeJson(value: unknown): string {
  return stringifyCanonical(value, "$");
}

export function sha256Hex(input: string | Buffer) {
  return createHash("sha256").update(input).digest("hex");
}

export function canonicalDocumentSha256(value: unknown) {
  return sha256Hex(canonicalizeJson(value));
}

export function canonicalDocumentDigest(value: unknown) {
  return `sha256:${canonicalDocumentSha256(value)}`;
}

export function documentWithoutDigest<T extends Record<string, unknown>>(
  document: T,
  digestKey: "contentDigest" | "manifestDigestSha256"
) {
  const copy = { ...document };
  delete copy[digestKey];
  return copy;
}

function stringifyCanonical(value: unknown, path: string): string {
  if (value === null) return "null";

  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string") return JSON.stringify(value);

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(`Non-finite number cannot be canonicalized at ${path}.`);
    }
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item, index) => stringifyCanonical(item, `${path}[${index}]`)).join(",")}]`;
  }

  if (typeof value === "object" && value) {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));

    return `{${entries
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${stringifyCanonical(entryValue, `${path}.${key}`)}`)
      .join(",")}}`;
  }

  throw new Error(`Unsupported value cannot be canonicalized at ${path}.`);
}

export function assertCanonicalJsonValue(value: unknown): asserts value is CanonicalJsonValue {
  canonicalizeJson(value);
}

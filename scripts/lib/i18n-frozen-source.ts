import { createHash } from "node:crypto";

export function normalizedSourceFingerprint(source: string) {
  return createHash("sha256")
    .update(source.replace(/\r\n?/gu, "\n"))
    .digest("hex");
}

export function auditFrozenSource(
  source: string,
  expectedFingerprint: string,
) {
  const actualFingerprint = normalizedSourceFingerprint(source);
  return {
    actualFingerprint,
    matches: actualFingerprint === expectedFingerprint,
  };
}

import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { normalizeDomainInput } from "@/lib/widget/domain";

const BLOCKED_HOSTS = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
]);

const BLOCKED_SUFFIXES = [
  ".internal",
  ".invalid",
  ".lan",
  ".local",
  ".localhost",
  ".test",
];

export type PublicWidgetDomainValidation =
  | { valid: true; domain: string }
  | { valid: false; domain: string; reason: string };

export function validatePublicWidgetDomain(value: string): PublicWidgetDomainValidation {
  const domain = normalizeDomainInput(value);
  if (!domain || domain.length > 253) {
    return { valid: false, domain, reason: "Enter a valid public website domain." };
  }
  if (domain.includes("*") || domain.includes("_") || isIP(domain) !== 0) {
    return { valid: false, domain, reason: "IP addresses, wildcards and internal hostnames are not supported." };
  }
  if (BLOCKED_HOSTS.has(domain) || BLOCKED_SUFFIXES.some((suffix) => domain.endsWith(suffix))) {
    return { valid: false, domain, reason: "Enter a public website domain." };
  }

  const labels = domain.split(".");
  if (labels.length < 2 || labels.some((label) => !label || label.length > 63 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label))) {
    return { valid: false, domain, reason: "Enter a valid public website domain." };
  }
  const topLevelDomain = labels.at(-1) ?? "";
  if (topLevelDomain.length < 2 || /^\d+$/.test(topLevelDomain)) {
    return { valid: false, domain, reason: "Enter a valid public website domain." };
  }
  return { valid: true, domain };
}

export function widgetAbuseSubject(...parts: Array<string | null | undefined>) {
  return createHash("sha256")
    .update(parts.map((part) => part?.trim().toLowerCase() ?? "").join("\u0000"))
    .digest("hex")
    .slice(0, 32);
}

export function widgetRuntimeSecurityState(
  environment: Readonly<Record<string, string | undefined>> = process.env,
) {
  const sessionSecret = environment.WIDGET_SESSION_SECRET ?? "";
  const ipHashSalt = environment.WIDGET_IP_HASH_SALT ?? "";
  const distributedUrl = environment.UPSTASH_REDIS_REST_URL || environment.KV_REST_API_URL || "";
  const distributedToken = environment.UPSTASH_REDIS_REST_TOKEN || environment.KV_REST_API_TOKEN || "";
  const distributedSalt = environment.SECURITY_RATE_LIMIT_SALT ?? "";

  return {
    dedicated_session_secret: sessionSecret.length >= 32,
    dedicated_ip_hash_salt: ipHashSalt.length >= 32,
    distributed_rate_limit:
      environment.SECURITY_DISTRIBUTED_RATE_LIMIT_ENABLED === "true" &&
      distributedUrl.startsWith("https://") &&
      Boolean(distributedToken) &&
      distributedSalt.length >= 16,
  };
}

export function getWidgetSessionSecret(
  environment: Readonly<Record<string, string | undefined>> = process.env,
) {
  const secret = environment.WIDGET_SESSION_SECRET ?? "";
  if (secret.length < 32) {
    throw new Error("WIDGET_SESSION_SECRET must contain at least 32 characters.");
  }
  return secret;
}

export function getWidgetIpHashSalt(
  environment: Readonly<Record<string, string | undefined>> = process.env,
) {
  const secret = environment.WIDGET_IP_HASH_SALT ?? "";
  if (secret.length < 32) {
    throw new Error("WIDGET_IP_HASH_SALT must contain at least 32 characters.");
  }
  return secret;
}

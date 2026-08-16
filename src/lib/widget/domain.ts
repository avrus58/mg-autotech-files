import { domainToASCII } from "node:url";

function hostnameFromValue(value: string) {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "null") return "";

  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    return url.hostname;
  } catch {
    return trimmed.split("/")[0]?.split(":")[0] ?? "";
  }
}

export function normalizeHostname(hostname: string | null | undefined) {
  if (!hostname) return "";
  const clean = hostnameFromValue(hostname).toLowerCase().replace(/\.+$/, "");
  return domainToASCII(clean) || clean;
}

export function normalizeDomainInput(value: string) {
  return normalizeHostname(value);
}

/**
 * Domain allocations treat the conventional www host and the apex host as
 * one billing/security boundary. Keep this in sync with the
 * widget_clients canonical-domain trigger.
 */
export function canonicalWidgetDomain(value: string | null | undefined) {
  const normalized = normalizeHostname(value);
  return normalized.startsWith("www.") ? normalized.slice(4) : normalized;
}

export function extractRequestOrigin(headers: Headers) {
  const origin = headers.get("origin");
  if (origin && origin !== "null") {
    try {
      const parsed = new URL(origin);
      return `${parsed.protocol}//${parsed.host}`;
    } catch {
      return "";
    }
  }

  const referer = headers.get("referer");
  if (referer) {
    try {
      const parsed = new URL(referer);
      return `${parsed.protocol}//${parsed.host}`;
    } catch {
      return "";
    }
  }

  return "";
}

export function extractRequestDomain(headers: Headers) {
  const origin = extractRequestOrigin(headers);
  return origin ? normalizeHostname(origin) : "";
}

export function isDomainAllowed(
  requestDomain: string,
  allowedDomain: string,
  allowWwwAlias: boolean,
  allowSubdomains: boolean
) {
  const request = normalizeHostname(requestDomain);
  const allowed = normalizeHostname(allowedDomain);
  if (!request || !allowed) return false;
  if (request === allowed) return true;

  const allowedWithoutWww = allowed.startsWith("www.") ? allowed.slice(4) : allowed;
  const requestWithoutWww = request.startsWith("www.") ? request.slice(4) : request;

  if (allowWwwAlias && requestWithoutWww === allowedWithoutWww) return true;
  if (!allowSubdomains) return false;

  return request.endsWith(`.${allowedWithoutWww}`) && request !== allowedWithoutWww;
}

export function allowedOriginForDomain(domain: string, requestOrigin?: string) {
  const normalized = normalizeHostname(domain);
  if (!normalized) return "";
  if (requestOrigin) {
    try {
      const parsed = new URL(requestOrigin);
      if (normalizeHostname(parsed.hostname) === normalized) return `${parsed.protocol}//${parsed.host}`;
    } catch {
      // Fall through to the HTTPS origin.
    }
  }
  return `https://${normalized}`;
}


import { createHash, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import { normalizeCountryCode } from "@/lib/countries";

export type RequestNetworkProvider = "vercel" | "cloudflare-caddy" | "none";

export type RequestNetworkEnvironment = Readonly<
  Record<string, string | undefined>
>;

export type TrustedRequestNetwork = {
  provider: RequestNetworkProvider;
  trusted: boolean;
  clientIp: string;
  countryCode: string | null;
};

export const trustedProxyHeaders = Object.freeze({
  proof: "x-mg-proxy-secret",
  clientIp: "x-mg-client-ip",
  country: "x-mg-country",
});

const minimumProxySecretLength = 32;

function configuredProvider(
  environment: RequestNetworkEnvironment
): RequestNetworkProvider {
  const configured = environment.REQUEST_NETWORK_PROVIDER
    ?.trim()
    .toLowerCase();

  if (configured === "none") return "none";
  if (configured === "cloudflare-caddy") return "cloudflare-caddy";
  if (configured === "vercel") {
    return environment.VERCEL === "1" ? "vercel" : "none";
  }

  // Vercel owns and sanitizes its platform headers. Outside Vercel, an
  // explicit trusted-proxy mode is required and arbitrary forwarding headers
  // are ignored.
  return !configured && environment.VERCEL === "1" ? "vercel" : "none";
}

function normalizeIpCandidate(value: string | null, allowForwardedList: boolean) {
  if (!value || value.length > 256) return null;
  const raw = allowForwardedList ? value.split(",", 1)[0] : value;
  let candidate = raw.trim();
  if (!candidate || candidate.length > 80) return null;

  const bracketedIpv6 = candidate.match(/^\[([^\]]+)\](?::\d{1,5})?$/);
  if (bracketedIpv6) {
    candidate = bracketedIpv6[1];
  } else {
    const ipv4WithPort = candidate.match(/^(\d{1,3}(?:\.\d{1,3}){3}):\d{1,5}$/);
    if (ipv4WithPort) candidate = ipv4WithPort[1];
  }

  return isIP(candidate) ? candidate.toLowerCase() : null;
}

function validProxyProof(
  headers: Headers,
  environment: RequestNetworkEnvironment
) {
  const expected = environment.REQUEST_NETWORK_PROXY_SECRET ?? "";
  const supplied = headers.get(trustedProxyHeaders.proof) ?? "";
  if (
    expected.length < minimumProxySecretLength ||
    supplied.length < minimumProxySecretLength ||
    expected.length > 512 ||
    supplied.length > 512
  ) {
    return false;
  }

  const expectedDigest = createHash("sha256").update(expected).digest();
  const suppliedDigest = createHash("sha256").update(supplied).digest();
  return timingSafeEqual(expectedDigest, suppliedDigest);
}

export function resolveTrustedRequestNetwork(
  headers: Headers,
  environment: RequestNetworkEnvironment = process.env
): TrustedRequestNetwork {
  const provider = configuredProvider(environment);

  if (provider === "vercel") {
    return {
      provider,
      trusted: true,
      clientIp:
        normalizeIpCandidate(headers.get("x-vercel-forwarded-for"), true) ??
        "unknown",
      countryCode: normalizeCountryCode(
        headers.get("x-vercel-ip-country")
      ),
    };
  }

  if (provider === "cloudflare-caddy" && validProxyProof(headers, environment)) {
    return {
      provider,
      trusted: true,
      clientIp:
        normalizeIpCandidate(headers.get(trustedProxyHeaders.clientIp), false) ??
        "unknown",
      countryCode: normalizeCountryCode(
        headers.get(trustedProxyHeaders.country)
      ),
    };
  }

  return {
    provider,
    trusted: false,
    clientIp: "unknown",
    countryCode: null,
  };
}

export function getTrustedClientIp(
  request: Pick<Request, "headers">,
  environment: RequestNetworkEnvironment = process.env
) {
  return resolveTrustedRequestNetwork(request.headers, environment).clientIp;
}

export function getTrustedCountryCode(
  request: Pick<Request, "headers">,
  environment: RequestNetworkEnvironment = process.env
) {
  return resolveTrustedRequestNetwork(request.headers, environment).countryCode;
}

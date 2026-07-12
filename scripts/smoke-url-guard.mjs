export const NON_LOCAL_SMOKE_OVERRIDE_ENV = "ALLOW_NON_LOCAL_SMOKE";

const LOOPBACK_IPV4_PATTERN = /^127(?:\.\d{1,3}){3}$/;
const OVERRIDE_ENABLED_PATTERN = /^(1|true|yes)$/i;

export function isLocalSmokeUrl(value) {
  const url = value instanceof URL ? value : new URL(value);
  const hostname = url.hostname.toLowerCase();

  return (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "0.0.0.0" ||
    hostname === "::1" ||
    hostname === "[::1]" ||
    LOOPBACK_IPV4_PATTERN.test(hostname)
  );
}

export function isNonLocalSmokeOverrideEnabled(env = process.env) {
  return OVERRIDE_ENABLED_PATTERN.test(env[NON_LOCAL_SMOKE_OVERRIDE_ENV] || "");
}

export function resolveSmokeBaseUrl({
  defaultUrl = "http://localhost:3000",
  env = process.env,
  envVarName = "BASE_URL",
  scriptName = "smoke script",
} = {}) {
  const rawBaseUrl = (env[envVarName] || defaultUrl).trim();
  const normalizedBaseUrl = rawBaseUrl.replace(/\/+$/, "");
  let url;

  try {
    url = new URL(normalizedBaseUrl);
  } catch {
    throw new Error(`${scriptName}: ${envVarName} must be an absolute http(s) URL, got "${rawBaseUrl}".`);
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error(`${scriptName}: ${envVarName} must use http or https, got "${url.protocol}".`);
  }

  if (!isLocalSmokeUrl(url) && !isNonLocalSmokeOverrideEnabled(env)) {
    throw new Error(
      `${scriptName}: refusing non-local smoke target ${url.origin}. ` +
        `Use ${NON_LOCAL_SMOKE_OVERRIDE_ENV}=1 only for human-controlled production smoke runs.`
    );
  }

  return normalizedBaseUrl;
}

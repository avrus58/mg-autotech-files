export type AuthCaptchaStatus = "off" | "ready" | "misconfigured";

export type AuthCaptchaConfig = {
  status: AuthCaptchaStatus;
  siteKey: string;
  message: string | null;
};

type AuthCaptchaEnvironment = {
  mode?: string | null;
  siteKey?: string | null;
  nodeEnv?: string | null;
};

const TURNSTILE_TEST_SITE_KEYS = new Set([
  "1x00000000000000000000AA",
  "2x00000000000000000000AB",
  "1x00000000000000000000BB",
  "2x00000000000000000000BB",
  "3x00000000000000000000FF",
]);

export const AUTH_CAPTCHA_CONFIGURATION_MESSAGE =
  "Security verification is temporarily unavailable. Please try again later.";

export const AUTH_CAPTCHA_REQUIRED_MESSAGE =
  "Please complete the security verification before continuing.";

export function isTurnstileTestSiteKey(value: string) {
  return TURNSTILE_TEST_SITE_KEYS.has(value.trim());
}

export function isPlausibleTurnstileSiteKey(value: string) {
  const normalized = value.trim();
  return (
    isTurnstileTestSiteKey(normalized) ||
    /^0x[A-Za-z0-9_-]{20,100}$/.test(normalized)
  );
}

export function resolveAuthCaptchaConfig(
  environment: AuthCaptchaEnvironment
): AuthCaptchaConfig {
  const mode = environment.mode?.trim().toLowerCase() ?? "";
  const siteKey = environment.siteKey?.trim() ?? "";
  const production = environment.nodeEnv === "production";

  if (!mode || mode === "off") {
    if (production) {
      return {
        status: "misconfigured",
        siteKey: "",
        message: AUTH_CAPTCHA_CONFIGURATION_MESSAGE,
      };
    }
    return { status: "off", siteKey: "", message: null };
  }

  if (mode !== "required" || !isPlausibleTurnstileSiteKey(siteKey)) {
    return {
      status: "misconfigured",
      siteKey: "",
      message: AUTH_CAPTCHA_CONFIGURATION_MESSAGE,
    };
  }

  if (production && isTurnstileTestSiteKey(siteKey)) {
    return {
      status: "misconfigured",
      siteKey: "",
      message: AUTH_CAPTCHA_CONFIGURATION_MESSAGE,
    };
  }

  return { status: "ready", siteKey, message: null };
}

export function getPublicAuthCaptchaConfig() {
  return resolveAuthCaptchaConfig({
    mode: process.env.NEXT_PUBLIC_AUTH_CAPTCHA_MODE,
    siteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
    nodeEnv: process.env.NODE_ENV,
  });
}

export function getHostedTurnstileConfig() {
  return resolveAuthCaptchaConfig({
    mode: "required",
    siteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
    nodeEnv: process.env.NODE_ENV,
  });
}

export function authCaptchaBlocksSubmission(
  config: AuthCaptchaConfig,
  token: string | null
) {
  return (
    config.status === "misconfigured" ||
    (config.status === "ready" && !token?.trim())
  );
}

export function getAuthCaptchaToken(
  config: AuthCaptchaConfig,
  token: string | null
) {
  if (config.status === "off") return undefined;
  if (config.status === "misconfigured") {
    throw new Error(config.message ?? AUTH_CAPTCHA_CONFIGURATION_MESSAGE);
  }

  const normalizedToken = token?.trim();
  if (!normalizedToken) throw new Error(AUTH_CAPTCHA_REQUIRED_MESSAGE);
  return normalizedToken;
}

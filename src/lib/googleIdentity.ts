export type GoogleIdentityConfig =
  | { status: "ready"; clientId: string; message: null }
  | { status: "off"; clientId: ""; message: null }
  | { status: "misconfigured"; clientId: ""; message: string };

type GoogleIdentityEnvironment = {
  clientId?: string | null;
  nodeEnv?: string | null;
};

export const GOOGLE_IDENTITY_CONFIGURATION_MESSAGE =
  "Google sign-in is temporarily unavailable. You can continue with e-mail.";

const GOOGLE_CLIENT_ID_PATTERN =
  /^\d{6,}-[a-z0-9_-]{8,}\.apps\.googleusercontent\.com$/i;

export function isGoogleIdentityClientId(value: string) {
  return GOOGLE_CLIENT_ID_PATTERN.test(value.trim());
}

export function resolveGoogleIdentityConfig(
  environment: GoogleIdentityEnvironment
): GoogleIdentityConfig {
  const clientId = environment.clientId?.trim() ?? "";
  const production = environment.nodeEnv === "production";

  if (!clientId) {
    return production
      ? {
          status: "misconfigured",
          clientId: "",
          message: GOOGLE_IDENTITY_CONFIGURATION_MESSAGE,
        }
      : { status: "off", clientId: "", message: null };
  }

  if (!isGoogleIdentityClientId(clientId)) {
    return {
      status: "misconfigured",
      clientId: "",
      message: GOOGLE_IDENTITY_CONFIGURATION_MESSAGE,
    };
  }

  return { status: "ready", clientId, message: null };
}

export function getPublicGoogleIdentityConfig() {
  return resolveGoogleIdentityConfig({
    clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
    nodeEnv: process.env.NODE_ENV,
  });
}

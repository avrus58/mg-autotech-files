export const learningFlywheelEngineVersion = "learning-flywheel-ingestion-v2";
export const learningFlywheelCaptureTimeoutMs = 12_000;

export type LearningFlywheelFlags = {
  fileCandidatesEnabled: boolean;
  pairCandidatesEnabled: boolean;
  approvalEnabled: boolean;
  backfillEnabled: boolean;
};

export type LearningAuthorizationConfig = {
  captureEnabled: boolean;
  available: boolean;
  termsVersion: string | null;
  termsUrl: string | null;
};

type ServerEnv = Record<string, string | undefined>;

function strictFlag(value: string | undefined) {
  return value === "true";
}

function validTermsVersion(value: string | undefined) {
  const normalized = value?.trim() ?? "";
  return /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/.test(normalized) ? normalized : null;
}

function validTermsUrl(value: string | undefined) {
  try {
    const url = new URL(value?.trim() ?? "");
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function resolveLearningFlywheelFlags(env: ServerEnv = process.env): LearningFlywheelFlags {
  return {
    fileCandidatesEnabled: strictFlag(env.LEARNING_FLYWHEEL_FILE_CANDIDATES_ENABLED),
    pairCandidatesEnabled: strictFlag(env.LEARNING_FLYWHEEL_PAIR_CANDIDATES_ENABLED),
    approvalEnabled: strictFlag(env.LEARNING_FLYWHEEL_APPROVAL_ENABLED),
    backfillEnabled: strictFlag(env.LEARNING_FLYWHEEL_BACKFILL_ENABLED),
  };
}

export function resolveLearningAuthorizationConfig(env: ServerEnv = process.env): LearningAuthorizationConfig {
  const captureEnabled = strictFlag(env.LEARNING_AUTHORIZATION_CAPTURE_ENABLED);
  const termsVersion = validTermsVersion(env.LEARNING_AUTHORIZATION_TERMS_VERSION);
  const termsUrl = validTermsUrl(env.LEARNING_AUTHORIZATION_TERMS_URL);
  return {
    captureEnabled,
    available: captureEnabled && Boolean(termsVersion && termsUrl),
    termsVersion,
    termsUrl,
  };
}

export function getLearningAuthorizationPublicConfig(env: ServerEnv = process.env) {
  const config = resolveLearningAuthorizationConfig(env);
  return {
    available: config.available,
    termsVersion: config.available ? config.termsVersion : null,
    termsUrl: config.available ? config.termsUrl : null,
    choiceRequiredForPurchase: false,
    defaultChoice: null,
  } as const;
}

export function getLearningFlywheelStaffState(env: ServerEnv = process.env) {
  return {
    ...resolveLearningFlywheelFlags(env),
    authorization: resolveLearningAuthorizationConfig(env),
    engineVersion: learningFlywheelEngineVersion,
    captureTimeoutMs: learningFlywheelCaptureTimeoutMs,
  };
}

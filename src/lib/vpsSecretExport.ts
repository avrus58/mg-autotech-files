import {
  constants,
  createCipheriv,
  createHash,
  createHmac,
  publicEncrypt,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import vpsSecretExportEnvironmentNames from "./vpsSecretExportAllowlist.json";

export const VPS_SECRET_EXPORT_ENV_NAMES = Object.freeze(
  vpsSecretExportEnvironmentNames
);

export type VpsSecretExportEnvironmentName = string;

export type VpsSecretExportPayload = {
  version: 1;
  generatedAt: string;
  variables: Partial<Record<VpsSecretExportEnvironmentName, string>>;
};

export type VpsSecretExportEnvelope = {
  version: 1;
  alg: "RSA-OAEP-SHA256";
  enc: "AES-256-GCM";
  aad: string;
  encryptedKey: string;
  iv: string;
  tag: string;
  ciphertext: string;
};

const RECIPIENT_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBojANBgkqhkiG9w0BAQEFAAOCAY8AMIIBigKCAYEAzeRN6OyBXiK982+uIxBf
Czlwyttrkroa7VOd6sbJwiSZKvP6z/wyOn1aAMmbersaWQmPiXmCKD2nzRVAocWw
aFOmQ4e9gcVmFhyRpI+j0xbh7Uo7wKFHnXfBa+cr7S4UGPP9m95Xmr9nyTrx9yvG
5rpe0+JR+MOmLYktSpxLr95UW8rWdEsyQiKFY4ziVjy7PXRKqV5fclw/69b9EsN0
eIzJ6rs3adBGJ0YiEvupEi8nHHsmWU6O3tmYzr1KPsace8GBVjOCQkEyj15YBk8v
WbC7eZCY9i4L0J/NkPgYSgoJdMwpFBwj3aERr5b5AltZqNoMwMFaLuZc5/qOeOKb
dWXDJCh8i7sDY0XiwGz2UjZOBMICfS2wUVhEZWa08zAyfE92Q6tfoGsX6oGtssP0
/z4s1g3F5Ywm0Byhij9Bi41SVGr75s9r4gIUuRk5bdQeNRzJCcqV4T1UOhJac3ea
e9a3QAuKm04YAH+Gm3xSl25I1rekeoddFEvbsuRy56xTAgMBAAE=
-----END PUBLIC KEY-----`;

const SECRET_EXPORT_AAD = "mg-autotech:vps-secret-export:v1";
const SECRET_EXPORT_AUTH_CONTEXT = "mg-autotech:vps-secret-export:auth:v1";
const MAX_AUTHORIZATION_BYTES = 8 * 1024;
const MAX_ENV_VALUE_BYTES = 16 * 1024;
const MAX_PLAINTEXT_BYTES = 64 * 1024;
const MAX_ENVELOPE_BYTES = 128 * 1024;

function byteLength(value: string) {
  return Buffer.byteLength(value, "utf8");
}

export function isAuthorizedVpsSecretExport(
  authorization: string | null,
  expectedServiceRoleKey: string | undefined
) {
  if (
    !authorization ||
    !expectedServiceRoleKey ||
    byteLength(authorization) > MAX_AUTHORIZATION_BYTES ||
    byteLength(expectedServiceRoleKey) > MAX_AUTHORIZATION_BYTES ||
    !authorization.startsWith("Bearer ")
  ) {
    return false;
  }

  const suppliedKey = authorization.slice("Bearer ".length);
  if (!suppliedKey) return false;

  const expectedExportToken = deriveVpsSecretExportToken(expectedServiceRoleKey);
  const suppliedDigest = createHash("sha256").update(suppliedKey, "utf8").digest();
  const expectedDigest = createHash("sha256")
    .update(expectedExportToken, "utf8")
    .digest();

  return timingSafeEqual(suppliedDigest, expectedDigest);
}

export function deriveVpsSecretExportToken(serviceRoleKey: string) {
  return createHmac("sha256", serviceRoleKey)
    .update(SECRET_EXPORT_AUTH_CONTEXT, "utf8")
    .digest("base64url");
}

export function buildVpsSecretExportPayload(
  environment: Readonly<Record<string, string | undefined>>,
  now = new Date()
): VpsSecretExportPayload {
  const variables: Partial<Record<VpsSecretExportEnvironmentName, string>> = {};

  for (const name of VPS_SECRET_EXPORT_ENV_NAMES) {
    const value = environment[name];
    if (!value) continue;
    if (byteLength(value) > MAX_ENV_VALUE_BYTES) {
      throw new Error("Secret export payload exceeds its safety boundary.");
    }
    variables[name] = value;
  }

  const payload: VpsSecretExportPayload = {
    version: 1,
    generatedAt: now.toISOString(),
    variables,
  };

  if (byteLength(JSON.stringify(payload)) > MAX_PLAINTEXT_BYTES) {
    throw new Error("Secret export payload exceeds its safety boundary.");
  }

  return payload;
}

export function encryptVpsSecretExportPayload(
  payload: VpsSecretExportPayload,
  recipientPublicKey = RECIPIENT_PUBLIC_KEY
): VpsSecretExportEnvelope {
  const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
  if (plaintext.byteLength > MAX_PLAINTEXT_BYTES) {
    plaintext.fill(0);
    throw new Error("Secret export payload exceeds its safety boundary.");
  }

  const contentKey = randomBytes(32);
  const iv = randomBytes(12);
  const aad = Buffer.from(SECRET_EXPORT_AAD, "utf8");

  try {
    const cipher = createCipheriv("aes-256-gcm", contentKey, iv);
    cipher.setAAD(aad);
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();
    const encryptedKey = publicEncrypt(
      {
        key: recipientPublicKey,
        oaepHash: "sha256",
        padding: constants.RSA_PKCS1_OAEP_PADDING,
      },
      contentKey
    );

    const envelope: VpsSecretExportEnvelope = {
      version: 1,
      alg: "RSA-OAEP-SHA256",
      enc: "AES-256-GCM",
      aad: aad.toString("base64"),
      encryptedKey: encryptedKey.toString("base64"),
      iv: iv.toString("base64"),
      tag: tag.toString("base64"),
      ciphertext: ciphertext.toString("base64"),
    };

    if (byteLength(JSON.stringify(envelope)) > MAX_ENVELOPE_BYTES) {
      throw new Error("Secret export envelope exceeds its safety boundary.");
    }

    return envelope;
  } finally {
    plaintext.fill(0);
    contentKey.fill(0);
  }
}

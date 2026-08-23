#!/usr/bin/env node

import {
  constants as cryptoConstants,
  createDecipheriv,
  privateDecrypt,
  randomBytes,
} from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { chmod, link, lstat, open, readFile, unlink } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ENVELOPE_MAX_BYTES = 128 * 1024;
const PRIVATE_KEY_MAX_BYTES = 16 * 1024;
const PLAINTEXT_MAX_BYTES = 64 * 1024;
const ENV_VALUE_MAX_BYTES = 16 * 1024;
const EXPECTED_AAD = Buffer.from("mg-autotech:vps-secret-export:v1", "utf8");
const EXACT_ENVELOPE_KEYS = [
  "aad",
  "alg",
  "ciphertext",
  "enc",
  "encryptedKey",
  "iv",
  "tag",
  "version",
];
const EXACT_PAYLOAD_KEYS = ["generatedAt", "variables", "version"];
const ALLOWLIST_PATH = fileURLToPath(
  new URL("../../src/lib/vpsSecretExportAllowlist.json", import.meta.url)
);

function fail() {
  throw new Error("Invalid VPS secret export.");
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(value, expectedKeys) {
  if (!isRecord(value)) return false;
  const actualKeys = Object.keys(value).sort();
  return (
    actualKeys.length === expectedKeys.length &&
    actualKeys.every((key, index) => key === expectedKeys[index])
  );
}

function decodeCanonicalBase64(value, minimumBytes, maximumBytes) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > Math.ceil(maximumBytes / 3) * 4 + 4 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      value
    )
  ) {
    fail();
  }

  const decoded = Buffer.from(value, "base64");
  if (
    decoded.byteLength < minimumBytes ||
    decoded.byteLength > maximumBytes ||
    decoded.toString("base64") !== value
  ) {
    decoded.fill(0);
    fail();
  }
  return decoded;
}

async function readBoundedRegularFile(path, maximumBytes) {
  const metadata = await lstat(path);
  if (!metadata.isFile() || metadata.size <= 0 || metadata.size > maximumBytes) {
    fail();
  }
  const content = await readFile(path);
  if (content.byteLength <= 0 || content.byteLength > maximumBytes) {
    content.fill(0);
    fail();
  }
  return content;
}

async function loadAllowlist() {
  const source = await readBoundedRegularFile(ALLOWLIST_PATH, 32 * 1024);
  try {
    const parsed = JSON.parse(source.toString("utf8"));
    if (
      !Array.isArray(parsed) ||
      parsed.length === 0 ||
      parsed.length > 128 ||
      parsed.some(
        (name) =>
          typeof name !== "string" ||
          !/^[A-Z][A-Z0-9_]{0,127}$/.test(name)
      ) ||
      new Set(parsed).size !== parsed.length
    ) {
      fail();
    }
    return new Set(parsed);
  } finally {
    source.fill(0);
  }
}

function parseEnvelope(source) {
  let envelope;
  try {
    envelope = JSON.parse(source.toString("utf8"));
  } catch {
    fail();
  }

  if (
    !hasExactKeys(envelope, EXACT_ENVELOPE_KEYS) ||
    envelope.version !== 1 ||
    envelope.alg !== "RSA-OAEP-SHA256" ||
    envelope.enc !== "AES-256-GCM"
  ) {
    fail();
  }

  const aad = decodeCanonicalBase64(envelope.aad, EXPECTED_AAD.byteLength, EXPECTED_AAD.byteLength);
  if (!aad.equals(EXPECTED_AAD)) {
    aad.fill(0);
    fail();
  }

  return {
    aad,
    encryptedKey: decodeCanonicalBase64(envelope.encryptedKey, 128, 1024),
    iv: decodeCanonicalBase64(envelope.iv, 12, 12),
    tag: decodeCanonicalBase64(envelope.tag, 16, 16),
    ciphertext: decodeCanonicalBase64(
      envelope.ciphertext,
      1,
      PLAINTEXT_MAX_BYTES
    ),
  };
}

function validatePayload(plaintext, allowlist) {
  let payload;
  try {
    payload = JSON.parse(plaintext.toString("utf8"));
  } catch {
    fail();
  }

  if (
    !hasExactKeys(payload, EXACT_PAYLOAD_KEYS) ||
    payload.version !== 1 ||
    typeof payload.generatedAt !== "string" ||
    !isRecord(payload.variables)
  ) {
    fail();
  }

  let normalizedTimestamp;
  try {
    normalizedTimestamp = new Date(payload.generatedAt).toISOString();
  } catch {
    fail();
  }
  if (normalizedTimestamp !== payload.generatedAt) fail();

  const variableEntries = Object.entries(payload.variables);
  if (variableEntries.length > allowlist.size) fail();
  for (const [name, value] of variableEntries) {
    if (
      !allowlist.has(name) ||
      typeof value !== "string" ||
      value.length === 0 ||
      Buffer.byteLength(value, "utf8") > ENV_VALUE_MAX_BYTES
    ) {
      fail();
    }
  }

  return payload;
}

async function writeProtectedAtomically(outputPath, content) {
  const directory = dirname(outputPath);
  const temporaryPath = resolve(
    directory,
    `.${basename(outputPath)}.${process.pid}.${randomBytes(8).toString("hex")}.tmp`
  );
  let temporaryExists = false;

  try {
    const handle = await open(
      temporaryPath,
      fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY,
      0o600
    );
    temporaryExists = true;
    try {
      await handle.writeFile(content);
      await handle.sync();
      await handle.chmod(0o600);
    } finally {
      await handle.close();
    }

    await link(temporaryPath, outputPath);
    await chmod(outputPath, 0o600);
    await unlink(temporaryPath);
    temporaryExists = false;
  } finally {
    if (temporaryExists) {
      await unlink(temporaryPath).catch(() => undefined);
    }
  }
}

export async function decryptVpsSecretExport(
  envelopePathInput,
  privateKeyPathInput,
  outputPathInput
) {
  const envelopePath = resolve(envelopePathInput);
  const privateKeyPath = resolve(privateKeyPathInput);
  const outputPath = resolve(outputPathInput);
  if (
    outputPath === envelopePath ||
    outputPath === privateKeyPath ||
    envelopePath === privateKeyPath
  ) {
    fail();
  }

  const [envelopeSource, privateKey, allowlist] = await Promise.all([
    readBoundedRegularFile(envelopePath, ENVELOPE_MAX_BYTES),
    readBoundedRegularFile(privateKeyPath, PRIVATE_KEY_MAX_BYTES),
    loadAllowlist(),
  ]);
  let contentKey;
  let plaintext;
  let output;
  const decoded = [];

  try {
    const envelope = parseEnvelope(envelopeSource);
    decoded.push(
      envelope.aad,
      envelope.encryptedKey,
      envelope.iv,
      envelope.tag,
      envelope.ciphertext
    );

    contentKey = privateDecrypt(
      {
        key: privateKey,
        oaepHash: "sha256",
        padding: cryptoConstants.RSA_PKCS1_OAEP_PADDING,
      },
      envelope.encryptedKey
    );
    if (contentKey.byteLength !== 32) fail();

    const decipher = createDecipheriv("aes-256-gcm", contentKey, envelope.iv);
    decipher.setAAD(envelope.aad);
    decipher.setAuthTag(envelope.tag);
    plaintext = Buffer.concat([
      decipher.update(envelope.ciphertext),
      decipher.final(),
    ]);
    if (plaintext.byteLength <= 0 || plaintext.byteLength > PLAINTEXT_MAX_BYTES) {
      fail();
    }

    const payload = validatePayload(plaintext, allowlist);
    output = Buffer.from(`${JSON.stringify(payload, null, 2)}\n`, "utf8");
    if (output.byteLength > PLAINTEXT_MAX_BYTES) fail();
    await writeProtectedAtomically(outputPath, output);
    return Object.keys(payload.variables).length;
  } finally {
    envelopeSource.fill(0);
    privateKey.fill(0);
    contentKey?.fill(0);
    plaintext?.fill(0);
    output?.fill(0);
    for (const value of decoded) value.fill(0);
  }
}

async function main() {
  if (process.argv.length !== 5) {
    process.stderr.write(
      "Usage: node decrypt-vps-secret-export.mjs ENVELOPE PRIVATE_KEY OUTPUT\n"
    );
    process.exitCode = 64;
    return;
  }

  try {
    const count = await decryptVpsSecretExport(
      process.argv[2],
      process.argv[3],
      process.argv[4]
    );
    process.stdout.write(`Decrypted ${count} variables to protected output.\n`);
  } catch {
    process.stderr.write("VPS secret export decryption failed.\n");
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  await main();
}

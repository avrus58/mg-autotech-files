import assert from "node:assert/strict";
import {
  constants,
  createDecipheriv,
  createHash,
  generateKeyPairSync,
  privateDecrypt,
  randomBytes,
} from "node:crypto";
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import {
  GET,
  createVpsSecretExportHandler,
} from "../src/app/api/internal/vps-secret-export/route";
import {
  VPS_SECRET_EXPORT_ENV_NAMES,
  buildVpsSecretExportPayload,
  encryptVpsSecretExportPayload,
  verifyVpsSecretExportAuthorization,
} from "../src/lib/vpsSecretExport";

function makeExportToken() {
  return randomBytes(32).toString("base64url");
}

function tokenDigest(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

async function loadDecryptCli() {
  const scriptUrl = pathToFileURL(
    resolve(process.cwd(), "scripts/vps/decrypt-vps-secret-export.mjs")
  ).href;
  return import(scriptUrl);
}

test("export authorization accepts only the canonical random token before expiry", () => {
  const token = makeExportToken();
  const wrongToken = makeExportToken();
  const now = new Date("2026-08-23T12:00:00.000Z");
  const expiresAtUtc = "2026-08-23T12:05:00.000Z";
  const expectedTokenSha256Hex = tokenDigest(token);

  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(
    verifyVpsSecretExportAuthorization({
      authorization: `Bearer ${token}`,
      expectedTokenSha256Hex,
      expiresAtUtc,
      now,
    }),
    "authorized"
  );
  for (const authorization of [
    `Bearer ${wrongToken}`,
    `bearer ${token}`,
    `Bearer ${token}=`,
    `Bearer ${token} `,
    "Bearer short",
    null,
  ]) {
    assert.equal(
      verifyVpsSecretExportAuthorization({
        authorization,
        expectedTokenSha256Hex,
        expiresAtUtc,
        now,
      }),
      "unauthorized"
    );
  }
  assert.equal(
    verifyVpsSecretExportAuthorization({
      authorization: `Bearer ${token}`,
      expectedTokenSha256Hex,
      expiresAtUtc,
      now: new Date(expiresAtUtc),
    }),
    "expired"
  );
  assert.equal(
    verifyVpsSecretExportAuthorization({
      authorization: `Bearer ${token}`,
      expectedTokenSha256Hex: "not-a-digest",
      expiresAtUtc,
      now,
    }),
    "unavailable"
  );
  assert.equal(
    verifyVpsSecretExportAuthorization({
      authorization: `Bearer ${token}`,
      expectedTokenSha256Hex,
      expiresAtUtc: "2026-08-23T12:15:00.001Z",
      now,
    }),
    "unavailable"
  );
});

test("payload exports only current allowlisted values", () => {
  const generatedAt = new Date("2026-08-23T12:00:00.000Z");
  const payload = buildVpsSecretExportPayload(
    {
      NEXT_PUBLIC_SITE_URL: "https://file.mgautotech.de",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-sentinel",
      UPLOAD_INTEGRITY_SECRET: "upload-integrity-sentinel",
      STRIPE_SECRET_KEY: "",
      CUSTOMER_DEVICE_HMAC_SECRET: "vps-only-must-not-export",
      REQUEST_NETWORK_PROXY_SECRET: "vps-only-must-not-export",
      FILE_EXPERT_ANALYZER_TOKEN: "vps-only-must-not-export",
      VERCEL_AUTOMATION_BYPASS_SECRET: "must-not-export",
    },
    generatedAt
  );

  assert.deepEqual(payload, {
    version: 1,
    generatedAt: generatedAt.toISOString(),
    variables: {
      NEXT_PUBLIC_SITE_URL: "https://file.mgautotech.de",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-sentinel",
      UPLOAD_INTEGRITY_SECRET: "upload-integrity-sentinel",
    },
  });
  assert.equal(VPS_SECRET_EXPORT_ENV_NAMES.includes("UPLOAD_INTEGRITY_SECRET"), true);
  for (const excluded of [
    "NEXT_PUBLIC_AUTH_CAPTCHA_ALLOW_TEST_KEY",
    "CUSTOMER_DEVICE_HMAC_SECRET",
    "REQUEST_NETWORK_PROXY_SECRET",
    "FILE_EXPERT_ANALYZER_TOKEN",
    "VERCEL",
  ]) {
    assert.equal(VPS_SECRET_EXPORT_ENV_NAMES.includes(excluded), false);
  }
});

test("payload boundaries reject an oversized value before encryption", () => {
  assert.throws(
    () =>
      buildVpsSecretExportPayload({
        SUPABASE_SERVICE_ROLE_KEY: "x".repeat(16 * 1024 + 1),
      }),
    /safety boundary/
  );
});

test("hybrid envelope decrypts only with RSA-OAEP-SHA256 and AES-256-GCM", () => {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  const expectedPayload = buildVpsSecretExportPayload(
    {
      NEXT_PUBLIC_SUPABASE_URL: "https://project-ref.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "encrypted-service-role-sentinel",
    },
    new Date("2026-08-23T12:00:00.000Z")
  );
  const envelope = encryptVpsSecretExportPayload(
    expectedPayload,
    publicKey.export({ type: "spki", format: "pem" }).toString()
  );

  const contentKey = privateDecrypt(
    {
      key: privateKey,
      oaepHash: "sha256",
      padding: constants.RSA_PKCS1_OAEP_PADDING,
    },
    Buffer.from(envelope.encryptedKey, "base64")
  );
  const decipher = createDecipheriv(
    "aes-256-gcm",
    contentKey,
    Buffer.from(envelope.iv, "base64")
  );
  decipher.setAAD(Buffer.from(envelope.aad, "base64"));
  decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, "base64")),
    decipher.final(),
  ]);

  assert.equal(envelope.alg, "RSA-OAEP-SHA256");
  assert.equal(envelope.enc, "AES-256-GCM");
  assert.deepEqual(JSON.parse(plaintext.toString("utf8")), expectedPayload);
  plaintext.fill(0);
  contentKey.fill(0);
});

test("decrypt contract rejects stale, future, and non-allowlisted payloads", async () => {
  const cli = await loadDecryptCli();
  const now = new Date("2026-08-23T12:10:00.000Z");
  const allowlist = new Set(VPS_SECRET_EXPORT_ENV_NAMES);
  const fresh = Buffer.from(
    JSON.stringify({
      version: 1,
      generatedAt: "2026-08-23T12:09:59.000Z",
      variables: { UPLOAD_INTEGRITY_SECRET: "fresh-sentinel" },
    })
  );
  const stale = Buffer.from(
    JSON.stringify({
      version: 1,
      generatedAt: "2026-08-23T12:04:59.999Z",
      variables: { UPLOAD_INTEGRITY_SECRET: "stale-sentinel" },
    })
  );
  const future = Buffer.from(
    JSON.stringify({
      version: 1,
      generatedAt: "2026-08-23T12:10:30.001Z",
      variables: { UPLOAD_INTEGRITY_SECRET: "future-sentinel" },
    })
  );
  const unknown = Buffer.from(
    JSON.stringify({
      version: 1,
      generatedAt: "2026-08-23T12:09:59.000Z",
      variables: { REQUEST_NETWORK_PROXY_SECRET: "vps-only-sentinel" },
    })
  );

  try {
    assert.deepEqual(cli.validatePayload(fresh, allowlist, now).variables, {
      UPLOAD_INTEGRITY_SECRET: "fresh-sentinel",
    });
    assert.throws(() => cli.validatePayload(stale, allowlist, now));
    assert.throws(() => cli.validatePayload(future, allowlist, now));
    assert.throws(() => cli.validatePayload(unknown, allowlist, now));
  } finally {
    fresh.fill(0);
    stale.fill(0);
    future.fill(0);
    unknown.fill(0);
  }
});

test("decrypt contract enforces root-owned 0600 key and rejects symlink metadata", async () => {
  const cli = await loadDecryptCli();
  const protectedMetadata = {
    isFile: () => true,
    size: 2048,
    uid: 0,
    gid: 0,
    mode: 0o100600,
  };

  assert.doesNotThrow(() =>
    cli.assertProtectedPrivateKeyMetadata(protectedMetadata)
  );
  assert.throws(() =>
    cli.assertProtectedPrivateKeyMetadata({ ...protectedMetadata, uid: 1000 })
  );
  assert.throws(() =>
    cli.assertProtectedPrivateKeyMetadata({ ...protectedMetadata, gid: 1000 })
  );
  assert.throws(() =>
    cli.assertProtectedPrivateKeyMetadata({ ...protectedMetadata, mode: 0o100640 })
  );
  assert.throws(() =>
    cli.assertProtectedPrivateKeyMetadata({
      ...protectedMetadata,
      isFile: () => false,
    })
  );
});

test("decrypt contract rejects authenticated-ciphertext tampering", async () => {
  const cli = await loadDecryptCli();
  const { publicKey, privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  const payload = buildVpsSecretExportPayload(
    { UPLOAD_INTEGRITY_SECRET: "tamper-sentinel" },
    new Date()
  );
  const envelope = encryptVpsSecretExportPayload(
    payload,
    publicKey.export({ type: "spki", format: "pem" }).toString()
  );
  const ciphertext = Buffer.from(envelope.ciphertext, "base64");
  ciphertext[0] ^= 1;
  const tampered = Buffer.from(
    JSON.stringify({ ...envelope, ciphertext: ciphertext.toString("base64") })
  );
  const privateKeyPem = Buffer.from(
    privateKey.export({ type: "pkcs8", format: "pem" })
  );

  try {
    assert.throws(() => cli.decryptEnvelope(tampered, privateKeyPem));
  } finally {
    ciphertext.fill(0);
    tampered.fill(0);
    privateKeyPem.fill(0);
  }
});

test("atomic writer creates protected output and never clobbers its target", async () => {
  const cli = await loadDecryptCli();
  const temporaryDirectory = mkdtempSync(
    join(tmpdir(), "mg-vps-secret-export-test-")
  );
  const outputPath = join(temporaryDirectory, "decrypted.json");
  const content = Buffer.from("complete-output");
  const replacement = Buffer.from("must-not-clobber");

  try {
    await cli.writeProtectedAtomically(outputPath, content);
    assert.equal(readFileSync(outputPath, "utf8"), "complete-output");
    if (process.platform !== "win32") {
      assert.equal(statSync(outputPath).mode & 0o777, 0o600);
    }
    await assert.rejects(() =>
      cli.writeProtectedAtomically(outputPath, replacement)
    );
    assert.equal(readFileSync(outputPath, "utf8"), "complete-output");
    assert.deepEqual(readdirSync(temporaryDirectory), ["decrypted.json"]);
  } finally {
    content.fill(0);
    replacement.fill(0);
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});

test("route is fail-closed by default and returns 410 at compile-time expiry", async () => {
  const response = GET(
    new Request("https://file.mgautotech.de/api/internal/vps-secret-export")
  );
  assert.equal(response.status, 410);
  assert.equal(await response.text(), '{"error":"Gone."}');
  assert.equal(response.headers.get("cache-control")?.includes("no-store"), true);
});

test("reviewed handler returns only a bounded encrypted envelope", async () => {
  const token = makeExportToken();
  const now = new Date("2026-08-23T12:00:00.000Z");
  const handler = createVpsSecretExportHandler({
    expectedTokenSha256Hex: tokenDigest(token),
    expiresAtUtc: "2026-08-23T12:05:00.000Z",
    now: () => now,
    environment: {
      SUPABASE_SERVICE_ROLE_KEY: "route-service-role-sentinel",
      UPLOAD_INTEGRITY_SECRET: "route-upload-integrity-sentinel",
    },
  });

  const unauthorized = handler(
    new Request("https://file.mgautotech.de/api/internal/vps-secret-export", {
      headers: { Authorization: `Bearer ${makeExportToken()}` },
    })
  );
  assert.equal(unauthorized.status, 401);

  const authorized = handler(
    new Request("https://file.mgautotech.de/api/internal/vps-secret-export", {
      headers: { Authorization: `Bearer ${token}` },
    })
  );
  const responseText = await authorized.text();
  assert.equal(authorized.status, 200);
  assert.equal(authorized.headers.get("vercel-cdn-cache-control"), "no-store");
  assert.ok(Buffer.byteLength(responseText, "utf8") < 128 * 1024);
  assert.doesNotMatch(responseText, /route-(?:service-role|upload-integrity)-sentinel/);
  assert.doesNotMatch(responseText, new RegExp(token));
  assert.equal(JSON.parse(responseText).alg, "RSA-OAEP-SHA256");
});

test("source contains only fail-closed auth patch points and the public RSA key", () => {
  const helper = readFileSync(
    resolve(process.cwd(), "src/lib/vpsSecretExport.ts"),
    "utf8"
  );
  const route = readFileSync(
    resolve(process.cwd(), "src/app/api/internal/vps-secret-export/route.ts"),
    "utf8"
  );
  const cli = readFileSync(
    resolve(process.cwd(), "scripts/vps/decrypt-vps-secret-export.mjs"),
    "utf8"
  );
  const combined = `${helper}\n${route}`;

  assert.match(helper, /BEGIN PUBLIC KEY/);
  assert.doesNotMatch(combined, /BEGIN (?:RSA )?PRIVATE KEY/);
  for (const forbiddenName of [
    `create${"Hmac"}`,
    `derive${"VpsSecretExportToken"}`,
    `process.env.${"SUPABASE_SERVICE_ROLE_KEY"}`,
  ]) {
    assert.equal(combined.includes(forbiddenName), false);
  }
  assert.match(route, /"0{64}"/);
  assert.match(route, /1970-01-01T00:00:00\.000Z/);
  assert.match(route, /runtime = "nodejs"/);
  assert.match(route, /Vercel-CDN-Cache-Control/);
  assert.doesNotMatch(combined, /console\.|logger\.|request\.url/);
  assert.match(cli, /O_NOFOLLOW/);
  assert.match(cli, /metadata\.uid !== 0/);
  assert.match(cli, /metadata\.gid !== 0/);
  assert.match(cli, /metadata\.mode & 0o777/);
});

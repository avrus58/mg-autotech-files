import assert from "node:assert/strict";
import {
  constants,
  createDecipheriv,
  generateKeyPairSync,
  privateDecrypt,
} from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { GET } from "../src/app/api/internal/vps-secret-export/route";
import {
  VPS_SECRET_EXPORT_ENV_NAMES,
  buildVpsSecretExportPayload,
  deriveVpsSecretExportToken,
  encryptVpsSecretExportPayload,
  isAuthorizedVpsSecretExport,
} from "../src/lib/vpsSecretExport";

test("secret export authorization uses a purpose-scoped derived Bearer token", () => {
  const expected = "service-role-test-value";
  const exportToken = deriveVpsSecretExportToken(expected);

  assert.match(exportToken, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(exportToken, expected);
  assert.equal(isAuthorizedVpsSecretExport(`Bearer ${exportToken}`, expected), true);
  assert.equal(isAuthorizedVpsSecretExport(`Bearer ${expected}`, expected), false);
  assert.equal(isAuthorizedVpsSecretExport(`bearer ${exportToken}`, expected), false);
  assert.equal(isAuthorizedVpsSecretExport(`Bearer ${exportToken} `, expected), false);
  assert.equal(isAuthorizedVpsSecretExport("Bearer wrong", expected), false);
  assert.equal(isAuthorizedVpsSecretExport(null, expected), false);
  assert.equal(isAuthorizedVpsSecretExport(`Bearer ${exportToken}`, undefined), false);
  assert.equal(isAuthorizedVpsSecretExport(`Bearer ${"x".repeat(9 * 1024)}`, expected), false);
});

test("payload contains only non-empty allowlisted environment values", () => {
  const generatedAt = new Date("2026-08-23T12:34:56.000Z");
  const payload = buildVpsSecretExportPayload(
    {
      NEXT_PUBLIC_SITE_URL: "https://file.mgautotech.de",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-sentinel",
      STRIPE_SECRET_KEY: "",
      VERCEL_AUTOMATION_BYPASS_SECRET: "must-not-export",
      UNRELATED_SECRET: "must-not-export",
    },
    generatedAt
  );

  assert.deepEqual(payload, {
    version: 1,
    generatedAt: generatedAt.toISOString(),
    variables: {
      NEXT_PUBLIC_SITE_URL: "https://file.mgautotech.de",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-sentinel",
    },
  });
  assert.equal(VPS_SECRET_EXPORT_ENV_NAMES.includes("VERCEL" as never), false);
  assert.equal(
    VPS_SECRET_EXPORT_ENV_NAMES.includes("NEXT_PUBLIC_AUTH_CAPTCHA_ALLOW_TEST_KEY" as never),
    false
  );
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
      RESEND_API_KEY: "encrypted-resend-sentinel",
    },
    new Date("2026-08-23T12:34:56.000Z")
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

  assert.equal(envelope.version, 1);
  assert.equal(envelope.alg, "RSA-OAEP-SHA256");
  assert.equal(envelope.enc, "AES-256-GCM");
  assert.deepEqual(JSON.parse(plaintext.toString("utf8")), expectedPayload);

  plaintext.fill(0);
  contentKey.fill(0);
});

test("decrypt CLI validates the envelope and atomically writes protected JSON", () => {
  const temporaryDirectory = mkdtempSync(
    join(tmpdir(), "mg-vps-secret-export-test-")
  );
  const envelopePath = join(temporaryDirectory, "envelope.json");
  const privateKeyPath = join(temporaryDirectory, "recipient.key");
  const outputPath = join(temporaryDirectory, "decrypted.json");
  const invalidEnvelopePath = join(temporaryDirectory, "invalid-envelope.json");
  const invalidOutputPath = join(temporaryDirectory, "invalid-output.json");
  const scriptPath = resolve(
    process.cwd(),
    "scripts/vps/decrypt-vps-secret-export.mjs"
  );

  try {
    const { publicKey, privateKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
    });
    const payload = buildVpsSecretExportPayload(
      {
        NEXT_PUBLIC_SITE_URL: "https://file.mgautotech.de",
        SUPABASE_SERVICE_ROLE_KEY: "cli-service-role-sentinel",
      },
      new Date("2026-08-23T13:00:00.000Z")
    );
    const envelope = encryptVpsSecretExportPayload(
      payload,
      publicKey.export({ type: "spki", format: "pem" }).toString()
    );
    writeFileSync(envelopePath, JSON.stringify(envelope), { mode: 0o600 });
    writeFileSync(
      privateKeyPath,
      privateKey.export({ type: "pkcs8", format: "pem" }),
      { mode: 0o600 }
    );

    const result = spawnSync(
      process.execPath,
      [scriptPath, envelopePath, privateKeyPath, outputPath],
      { encoding: "utf8" }
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, "Decrypted 2 variables to protected output.\n");
    assert.equal(result.stderr, "");
    assert.deepEqual(JSON.parse(readFileSync(outputPath, "utf8")), payload);
    assert.doesNotMatch(result.stdout, /cli-service-role-sentinel/);
    if (process.platform !== "win32") {
      assert.equal(statSync(outputPath).mode & 0o777, 0o600);
    }

    writeFileSync(
      invalidEnvelopePath,
      JSON.stringify({ ...envelope, alg: "RSA-OAEP-SHA1" }),
      { mode: 0o600 }
    );
    const invalid = spawnSync(
      process.execPath,
      [scriptPath, invalidEnvelopePath, privateKeyPath, invalidOutputPath],
      { encoding: "utf8" }
    );
    assert.equal(invalid.status, 1);
    assert.equal(invalid.stdout, "");
    assert.equal(invalid.stderr, "VPS secret export decryption failed.\n");
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});

test("route is fail-closed, no-store, and never returns plaintext values", async () => {
  const previousServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const sentinel = "route-service-role-sentinel";
  const exportToken = deriveVpsSecretExportToken(sentinel);
  process.env.SUPABASE_SERVICE_ROLE_KEY = sentinel;

  try {
    const unauthorized = GET(
      new Request("https://file.mgautotech.de/api/internal/vps-secret-export")
    );
    assert.equal(unauthorized.status, 401);
    assert.equal(unauthorized.headers.get("cache-control")?.includes("no-store"), true);
    assert.equal(await unauthorized.text(), '{"error":"Unauthorized."}');

    const authorized = GET(
      new Request("https://file.mgautotech.de/api/internal/vps-secret-export", {
        headers: { Authorization: `Bearer ${exportToken}` },
      })
    );
    const responseText = await authorized.text();
    assert.equal(authorized.status, 200);
    assert.equal(authorized.headers.get("cache-control")?.includes("no-store"), true);
    assert.equal(authorized.headers.get("vercel-cdn-cache-control"), "no-store");
    assert.ok(Buffer.byteLength(responseText, "utf8") < 128 * 1024);
    assert.doesNotMatch(responseText, new RegExp(sentinel));
    assert.equal(JSON.parse(responseText).alg, "RSA-OAEP-SHA256");
  } finally {
    if (previousServiceRole === undefined) {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    } else {
      process.env.SUPABASE_SERVICE_ROLE_KEY = previousServiceRole;
    }
  }
});

test("temporary route embeds no private key and contains no application logging", () => {
  const helper = readFileSync(
    resolve(process.cwd(), "src/lib/vpsSecretExport.ts"),
    "utf8"
  );
  const route = readFileSync(
    resolve(process.cwd(), "src/app/api/internal/vps-secret-export/route.ts"),
    "utf8"
  );
  const combined = `${helper}\n${route}`;

  assert.match(helper, /BEGIN PUBLIC KEY/);
  assert.doesNotMatch(combined, /BEGIN (?:RSA )?PRIVATE KEY/);
  assert.doesNotMatch(combined, /console\.|logger\.|request\.url/);
  assert.match(route, /runtime = "nodejs"/);
  assert.match(route, /Vercel-CDN-Cache-Control/);
});

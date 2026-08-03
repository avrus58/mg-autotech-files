import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  CUSTOMER_REPLACEMENT_PASSWORD_MAX_LENGTH,
  CUSTOMER_REPLACEMENT_PASSWORD_MIN_LENGTH,
  generateCustomerReplacementPassword,
  validateCustomerReplacementPassword,
} from "../src/lib/customerPasswordSecurity";

function readProjectFile(...segments: string[]) {
  return readFileSync(resolve(process.cwd(), ...segments), "utf8");
}

test("customer replacement passwords require a strong bounded value", () => {
  assert.equal(validateCustomerReplacementPassword("StrongAdmin#482").valid, true);
  assert.equal(validateCustomerReplacementPassword("short1!A").valid, false);
  assert.equal(validateCustomerReplacementPassword("alllowercase123!").valid, false);
  assert.equal(validateCustomerReplacementPassword("ALLUPPERCASE123!").valid, false);
  assert.equal(validateCustomerReplacementPassword("NoNumbersHere!").valid, false);
  assert.equal(validateCustomerReplacementPassword("NoSymbolsHere123").valid, false);
  assert.equal(validateCustomerReplacementPassword("Spaces AreNot1!").valid, false);
  assert.equal(validateCustomerReplacementPassword("Password123!").valid, false);
  assert.equal(
    validateCustomerReplacementPassword("A1!".padEnd(CUSTOMER_REPLACEMENT_PASSWORD_MAX_LENGTH + 1, "x")).valid,
    false
  );
});

test("generated customer replacement passwords satisfy the same policy", () => {
  for (let index = 0; index < 20; index += 1) {
    const password = generateCustomerReplacementPassword();
    assert.equal(password.length, 18);
    assert.equal(validateCustomerReplacementPassword(password).valid, true);
  }

  assert.equal(
    generateCustomerReplacementPassword(4).length,
    CUSTOMER_REPLACEMENT_PASSWORD_MIN_LENGTH
  );
  assert.equal(generateCustomerReplacementPassword(500).length, 64);
});

test("customer password controls are protected, audited and fail closed", () => {
  const route = readProjectFile(
    "src",
    "app",
    "api",
    "admin",
    "customers",
    "[id]",
    "password",
    "route.ts"
  );

  assert.match(route, /requireStaffPermission\(request, "customers\.manage"\)/);
  assert.match(route, /!isPrimaryOwner\(auth\.access\)/);
  assert.match(route, /\["admin", "staff"\]\.includes/);
  assert.match(route, /auth\.admin\.getUserById/);
  assert.match(route, /auth\.admin\.generateLink/);
  assert.match(route, /type: "recovery"/);
  assert.match(route, /sendCustomerPasswordRecoveryEmail/);
  assert.doesNotMatch(route, /auth\.resetPasswordForEmail/);
  assert.match(route, /auth\.admin\.updateUserById/);
  assert.match(route, /\.from\("staff_audit_log"\)/);
  assert.match(route, /Security audit is unavailable\. No credential action was performed\./);
  assert.match(route, /"Cache-Control": "private, no-store, max-age=0"/);
  assert.doesNotMatch(route, /export async function GET/);
  assert.doesNotMatch(route, /auth\.admin\.listUsers/);
  assert.doesNotMatch(route, /password_hash|encrypted_password/);
  assert.doesNotMatch(route, /return response\(\{\s*password:/);
  assert.doesNotMatch(route, /\baction_link\s*:/);
});

test("password recovery email validates the generated link and keeps it out of metadata", async () => {
  const { validateRecoveryActionLink } = await import("../src/lib/email/recovery");
  const valid = "https://example.supabase.co/auth/v1/verify?token=hashed-token&type=recovery&redirect_to=https%3A%2F%2Ffile.mgautotech.de%2Fauth%2Fcallback";

  assert.equal(validateRecoveryActionLink(valid), valid);
  assert.equal(validateRecoveryActionLink("http://example.supabase.co/auth/v1/verify?token=x&type=recovery"), null);
  assert.equal(validateRecoveryActionLink("https://example.supabase.co/auth/v1/verify?token=x&type=invite"), null);
  assert.equal(validateRecoveryActionLink("https://example.supabase.co/auth/v1/verify?type=recovery"), null);
  assert.equal(validateRecoveryActionLink("javascript:alert(1)"), null);

  const recovery = readProjectFile("src", "lib", "email", "recovery.ts");
  const metadata = recovery.split("metadata:")[1]?.split("},")[0] || "";
  assert.notEqual(metadata, "");
  assert.doesNotMatch(metadata, /recoveryUrl|action_link|token/i);
  assert.match(recovery, /customer_password_reset:\$\{input\.customerId\}:\$\{input\.auditId\}/);
});

test("credential audit metadata never contains the submitted password", () => {
  const route = readProjectFile(
    "src",
    "app",
    "api",
    "admin",
    "customers",
    "[id]",
    "password",
    "route.ts"
  );
  const auditInsert = route.split('.from("staff_audit_log")')[1]?.split('.select("id")')[0] || "";

  assert.notEqual(auditInsert, "");
  assert.doesNotMatch(auditInsert, /parsed\.data\.password/);
  assert.match(auditInsert, /password_logged: false/);
  assert.match(auditInsert, /password_returned: false/);
});

test("admin UI explains password non-retrievability and separates recovery paths", () => {
  const adminPage = readProjectFile("src", "app", "admin", "page.tsx");

  assert.match(adminPage, /Current password/);
  assert.match(adminPage, /Not retrievable/);
  assert.match(adminPage, /one-way password hash/);
  assert.match(adminPage, /blur-\[2px\]/);
  assert.match(adminPage, /Send Password Reset Email/);
  assert.match(adminPage, /Owner-only replacement/);
  assert.match(adminPage, /Primary Owner only/);
  assert.match(adminPage, /send_reset_email/);
  assert.match(adminPage, /set_replacement_password/);
  assert.doesNotMatch(adminPage, /Show current password|Reveal current password/);
});

test("anonymous requests cannot trigger customer credential actions", async () => {
  const { POST } = await import(
    "../src/app/api/admin/customers/[id]/password/route"
  );
  const response = await POST(
    new Request(
      "http://localhost/api/admin/customers/00000000-0000-4000-8000-000000000001/password",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send_reset_email" }),
      }
    ),
    { params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000001" }) }
  );

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "Unauthorized" });
});

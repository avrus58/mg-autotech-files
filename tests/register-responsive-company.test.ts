import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const registerPage = readFileSync(
  resolve(process.cwd(), "src", "app", "register", "page.tsx"),
  "utf8"
);
const authCallback = readFileSync(
  resolve(process.cwd(), "src", "app", "auth", "callback", "page.tsx"),
  "utf8"
);
const oauthFinalizeRoute = readFileSync(
  resolve(process.cwd(), "src", "app", "api", "auth", "oauth-registration", "finalize", "route.ts"),
  "utf8"
);
const registrationCompletion = readFileSync(
  resolve(process.cwd(), "src", "lib", "registrationCompletion.ts"),
  "utf8"
);

test("registration keeps one focused card without the redundant marketing column", () => {
  assert.match(registerPage, /overflow-x-hidden/);
  assert.doesNotMatch(registerPage, /<main className="[^"]*overflow-hidden[^"]*"/);
  assert.match(registerPage, /max-w-\[760px\]/);
  assert.equal(registerPage.match(/<h1\b/g)?.length, 1);
  assert.match(registerPage, /<h1[^>]*>[\s\S]*?Create Account[\s\S]*?<\/h1>/);
  assert.doesNotMatch(registerPage, /FeatureCard/);
  assert.doesNotMatch(registerPage, /Smart Vehicle Database/);
  assert.doesNotMatch(registerPage, /Premium File Workflow/);
  assert.doesNotMatch(registerPage, /lg:grid-cols-\[0\.84fr_1\.16fr\]/);
  assert.match(registerPage, /h-11 w-full rounded-xl/);
});

test("company registration requires and persists a bounded company identity", () => {
  assert.match(registerPage, /if \(accountType === "company" && !cleanCompanyName\)/);
  assert.match(registerPage, /setMessage\("Please enter your company name\."\)/);
  assert.match(registerPage, /company_name: accountType === "company" \? cleanCompanyName : null/);
  assert.match(registerPage, /vat_id: accountType === "company" \? taxNumber\.trim\(\) \|\| null : null/);
  assert.match(registerPage, /label="Company Name"[\s\S]*?autoComplete="organization"/);
  assert.match(registerPage, /label="Company Name"[\s\S]*?maxLength=\{120\}/);
  assert.match(registerPage, /aria-pressed=\{accountType === item\.id\}/);
});

test("Google registration carries the validated customer and company profile", () => {
  assert.match(registerPage, /if \(!validateAccountStep\(\)\)/);
  assert.match(registerPage, /createRegistrationProfileDraft\(\{/);
  assert.match(registerPage, /country: selectedCountry/);
  assert.match(registerPage, /OAUTH_REGISTRATION_PROFILE_KEY/);
  assert.match(authCallback, /parseRegistrationProfileDraft/);
  assert.match(
    authCallback,
    /oauthSignupProvider === "google" &&[\s\S]*oauthProfile &&[\s\S]*isGoogleRegistrationProfileFinalizationWindowOpen/
  );
  assert.match(authCallback, /JSON\.stringify\(\{ profile: oauthProfile \}\)/);
  assert.match(authCallback, /buildRegistrationCompletionUpdates\(\{/);
  assert.match(authCallback, /country: oauthProfile\.country/);
  assert.match(oauthFinalizeRoute, /buildRegistrationCompletionUpdates\(\{/);
  assert.match(oauthFinalizeRoute, /\.update\(updates\.profile\)/);
  assert.match(oauthFinalizeRoute, /\.eq\("id", auth\.user\.id\)/);
  assert.match(
    oauthFinalizeRoute,
    /isGoogleRegistrationProfileFinalizationWindowOpen\(auth\.user\)/
  );
  assert.match(oauthFinalizeRoute, /\.\.\.updates\.metadata/);
  assert.match(registrationCompletion, /registration_country_required/);
  assert.match(registrationCompletion, /registration_country_confirmed/);
  assert.match(oauthFinalizeRoute, /oauth_registration_finalized: true/);
});

test("private registration keeps company-only controls and metadata out of the account", () => {
  assert.match(registerPage, /\{accountType === "company" && \([\s\S]*?label="Company Name"/);
  assert.match(registerPage, /tax_number: accountType === "company" \? taxNumber\.trim\(\) \|\| null : null/);
});
